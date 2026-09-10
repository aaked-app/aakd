import { randomUUID } from "node:crypto"
import { z } from "zod"
import { requireWriteScope, resolveAuth } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import {
  extractionPreviewStorageKey,
  getExtractionPreviewQueue,
  type ExtractionPreviewJobData,
} from "@/lib/jobs/queues"
import { extractionPreviewResultKey, readExtractionPreviewResult } from "@/lib/jobs/extraction-preview-result"
import { storage } from "@/lib/storage"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { requestContext } from "@/lib/context"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

const MAX_SIZE = 50 * 1024 * 1024
const PREVIEW_TTL_MS = 5 * 60_000
const JobIdSchema = z.string().uuid()

function detectFileType(buffer: Buffer): "pdf" | "docx" | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    return "pdf"
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && buffer.includes(Buffer.from("word/"))) {
    return "docx"
  }
  return null
}

async function deleteOwnedPreviewSource(
  organizationId: string,
  memberId: string,
  jobId: string,
): Promise<void> {
  const key = extractionPreviewStorageKey(organizationId, memberId, jobId)
  await storage.delete(key).catch(() => {})
}

// POST /api/contracts/extract-preview
// Body: multipart FormData with field "file". Parsing and AI run only in the worker.
export async function POST(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req)
  if (!ctx?.memberId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const memberId = ctx.memberId
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (isAgreementAccessEmergencyDenyAll()) return Response.json({ error: "Not Found" }, { status: 404 })

  const rl = await rateLimit(`${ctx.organizationId}:extract-preview`, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  return requestContext.run(ctx, async () => {
  let formData: globalThis.FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const fileField = formData.get("file")
  if (!fileField || !(fileField instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 })
  }
  if (fileField.size > MAX_SIZE) {
    return Response.json({ error: "File exceeds 50 MB limit" }, { status: 413 })
  }

  const buffer = Buffer.from(await fileField.arrayBuffer())
  const fileType = detectFileType(buffer)
  if (!fileType) {
    return Response.json({ error: "unsupported_file_type" }, { status: 400 })
  }

  const jobId = randomUUID()
  const storageKey = extractionPreviewStorageKey(ctx.organizationId, memberId, jobId)
  const createdAt = Date.now()
  const data: ExtractionPreviewJobData = {
    jobId,
    organizationId: ctx.organizationId,
    requestedByUserId: ctx.userId,
    requestedByMemberId: memberId,
    storageKey,
    fileType,
    createdAt,
    expiresAt: createdAt + PREVIEW_TTL_MS,
  }

  try {
    await storage.upload(
      storageKey,
      buffer,
      fileType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    const job = await getExtractionPreviewQueue().add("extract", data, { jobId })
    return Response.json({ jobId: job.id, status: "pending" }, { status: 202 })
  } catch (error) {
    await storage.delete(storageKey).catch(() => {})
    logger.error(
      { organizationId: ctx.organizationId, errorType: error instanceof Error ? error.name : "unknown" },
      "[extract-preview] Failed to enqueue preview",
    )
    return Response.json({ error: "preview_unavailable" }, { status: 503 })
  }
  })
}

// GET /api/contracts/extract-preview?jobId=<uuid>
export async function GET(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req)
  if (!ctx?.memberId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key" && !ctx.scopes?.includes("text_read")) {
    return Response.json({ error: "text_read scope required" }, { status: 403 })
  }
  const memberId = ctx.memberId
  if (isAgreementAccessEmergencyDenyAll()) return Response.json({ error: "Not Found" }, { status: 404 })

  return requestContext.run(ctx, async () => {
  const parsedJobId = JobIdSchema.safeParse(new URL(req.url).searchParams.get("jobId"))
  if (!parsedJobId.success) {
    return Response.json({ error: "Invalid job ID" }, { status: 400 })
  }
  const jobId = parsedJobId.data
  const queue = getExtractionPreviewQueue()
  const job = await queue.getJob(jobId)
  if (!job) {
    await deleteOwnedPreviewSource(ctx.organizationId, memberId, jobId)
    return Response.json({ error: "Preview not found" }, { status: 404 })
  }

  const data = job.data
  if (
    data.jobId !== jobId
    || data.organizationId !== ctx.organizationId
    || data.requestedByUserId !== ctx.userId
    || data.requestedByMemberId !== memberId
    || data.storageKey !== extractionPreviewStorageKey(ctx.organizationId, memberId, jobId)
  ) {
    return Response.json({ error: "Preview not found" }, { status: 404 })
  }

  if (Date.now() >= data.expiresAt) {
    await deleteOwnedPreviewSource(ctx.organizationId, memberId, jobId)
    await (await queue.client).del(extractionPreviewResultKey(data))
    await job.remove().catch(() => {})
    return Response.json({ status: "expired" })
  }

  const state = await job.getState()
  if (state === "completed") {
    const result = await readExtractionPreviewResult(await queue.client, data)
    if (!result) return Response.json({ status: "expired" })
    return Response.json({ status: "completed", result }, { headers: { "Cache-Control": "private, no-store" } })
  }
  if (state === "failed") {
    return Response.json({ status: "failed", error: "preview_failed" })
  }
  return Response.json({ status: "pending" })
  })
}
