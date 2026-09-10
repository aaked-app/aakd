import crypto from "node:crypto"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { getContractExtractQueue, getObligationExtractQueue } from "@/lib/jobs/queues"

const ROLES_CAN_WRITE = new Set(["owner", "admin", "legal", "member"])

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  if (!ROLES_CAN_WRITE.has(ctx.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        extractedText: true,
        files: {
          where: { isLatest: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, storageKey: true },
        },
      },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (!contract.extractedText) {
      const latestFile = contract.files?.[0]
      if (!latestFile) {
        return Response.json({ error: "no_extracted_text" }, { status: 422 })
      }

      // Keep in-flight work, but replace retained terminal jobs: adding their
      // same ID alone would never execute preparation again.
      const jobId = `contract-text-${latestFile.id}`
      const contractExtractQueue = getContractExtractQueue()
      const priorJob = await contractExtractQueue.getJob(jobId)
      if (priorJob) {
        const state = await priorJob.getState()
        if (state === "failed" || state === "completed" || state === "unknown") {
          await priorJob.remove()
        } else {
          return Response.json({ error: "text_processing", queued: true }, { status: 202 })
        }
      }
      await contractExtractQueue.add(
        "extract",
        {
          contractId: contract.id,
          organizationId: ctx.organizationId,
          fileId: latestFile.id,
          storageKey: latestFile.storageKey,
          preserveUserFields: true,
        },
        { jobId },
      )
      return Response.json({ error: "text_processing", queued: true }, { status: 202 })
    }

    // Enqueue — the worker uses the configured provider when available and a
    // deterministic cited fallback otherwise, so first value never requires BYOK.
    const sourceHash = crypto.createHash("sha256").update(contract.extractedText).digest("hex")
    const jobId = `initial-obligation-extract:${contract.id}:${sourceHash}`
    const queue = getObligationExtractQueue()
    const priorJob = await queue.getJob(jobId)
    if (priorJob) {
      const state = await priorJob.getState()
      if (state !== "failed" && state !== "completed" && state !== "unknown") {
        return Response.json({ jobId: priorJob.id })
      }
      // Terminal jobs retain a stale return value. Removing them allows a
      // deliberate retry while preserving deduplication of work in flight.
      await priorJob.remove()
    }
    const job = await queue.add("extract", {
      contractId: contract.id,
      organizationId: ctx.organizationId,
      extractedText: contract.extractedText.slice(0, 100_000),
      requestedById: ctx.userId,
      sourceHash,
    }, { jobId })

    return Response.json({ jobId: job.id })
  })
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key") return Response.json({ error: "human_session_required" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    // Verify org membership — don't leak job results across orgs
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { organizationId: true, extractedText: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")
    if (!jobId) {
      return Response.json({ error: "jobId required" }, { status: 400 })
    }

    const queue = getObligationExtractQueue()
    const job = await queue.getJob(jobId)

    if (!job) {
      const currentSourceHash = contract.extractedText
        ? crypto.createHash("sha256").update(contract.extractedText).digest("hex")
        : null
      if (!currentSourceHash) return Response.json({ state: "not_found" })
      const suggestions = (await prisma.contractObligationSuggestion.findMany({
        where: { contractId: params.id, organizationId: ctx.organizationId, status: "pending", sourceHash: currentSourceHash },
        orderBy: { createdAt: "asc" },
      })) ?? []
      return suggestions.length > 0
        ? Response.json({ state: "completed", suggestions })
        : Response.json({ state: "not_found" })
    }

    // BullMQ job IDs are global to the queue. Bind the poll to the same
    // contract and organization before exposing state or return values.
    const jobData = job.data as { contractId?: string; organizationId?: string; sourceHash?: string } | undefined
    if (
      jobData?.contractId !== params.id ||
      jobData?.organizationId !== ctx.organizationId
    ) {
      return Response.json({ state: "not_found" })
    }

    const currentSourceHash = contract.extractedText
      ? crypto.createHash("sha256").update(contract.extractedText).digest("hex")
      : null
    if (!currentSourceHash || jobData?.sourceHash !== currentSourceHash) {
      return Response.json({ state: "not_found" })
    }

    const state = await job.getState()

    if (state === "completed") {
      // The database is canonical. Do not replay BullMQ's retained return
      // value after a reviewer accepted, dismissed, or superseded candidates.
      const suggestions = await prisma.contractObligationSuggestion.findMany({
        where: { contractId: params.id, organizationId: ctx.organizationId, status: "pending", sourceHash: currentSourceHash },
        orderBy: { createdAt: "asc" },
      })
      return Response.json({ state: "completed", suggestions })
    }
    if (state === "failed") {
      return Response.json({ state: "failed", reason: "obligation_extraction_failed" })
    }
    // waiting, active, delayed → still running
    return Response.json({ state: "active" })
  });
}
