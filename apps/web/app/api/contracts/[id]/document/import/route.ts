import crypto from "node:crypto"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { storage } from "@/lib/storage"
import { getDocumentConvertQueue } from "@/lib/jobs/queues"
import { logger } from "@/lib/logger"

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB (PDFs can be larger than DOCX)
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // PK zip header
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46])  // %PDF

const READ_ONLY_STATUSES = new Set([
  "AWAITING_SIGNATURE",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "ARCHIVED",
])

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.role === "viewer") {
    return Response.json({ error: "viewer role cannot import documents" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true, status: true, document: { select: { version: true } } },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }

    if (READ_ONLY_STATUSES.has(contract.status)) {
      return Response.json({ error: "read_only_status" }, { status: 422 })
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return Response.json({ error: "invalid_form_data" }, { status: 400 })
    }

    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return Response.json({ error: "missing_file" }, { status: 400 })
    }

    const fileSize = (file as File).size
    if (fileSize > MAX_FILE_BYTES) {
      return Response.json({ error: "file_too_large" }, { status: 413 })
    }

    const arrayBuffer = await (file as File).arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Detect file type by magic bytes — never trust the browser MIME type.
    const magic = buffer.subarray(0, 4)
    let fileType: "docx" | "pdf"
    let mimeType: string
    let ext: string

    if (buffer.length >= 4 && magic.equals(DOCX_MAGIC)) {
      fileType = "docx"
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ext = "docx"
    } else if (buffer.length >= 4 && magic.equals(PDF_MAGIC)) {
      fileType = "pdf"
      mimeType = "application/pdf"
      ext = "pdf"
    } else {
      return Response.json({ error: "invalid_file_type" }, { status: 422 })
    }

    const jobId = crypto.randomUUID()
    const tmpKey = `tmp/docx-imports/${params.id}/${jobId}.${ext}`
    try {
      await storage.upload(tmpKey, buffer, mimeType)
    } catch (err) {
      // The UUID-scoped source is not referenced by a job yet, so it is safe
      // to remove even if the failed upload was an acknowledgement loss.
      try {
        await storage.delete(tmpKey)
      } catch {
        logger.error({ contractId: params.id }, "[document.import] failed upload cleanup failed")
      }
      logger.error({ err, contractId: params.id }, "[document.import] temporary source upload failed")
      return Response.json({ error: "import_upload_failed" }, { status: 502 })
    }

    const queue = getDocumentConvertQueue()
    const jobData = {
      contractId: params.id,
      organizationId: ctx.organizationId,
      requestedByMemberId: ctx.memberId,
      apiKeyId: ctx.apiKeyId,
      expectedDocumentVersion: contract.document?.version ?? null,
      storageKey: tmpKey,
      requestedById: ctx.userId,
      fileType,
      jobId,
      deleteSource: true,
    }
    try {
      await queue.add("convert", jobData, { jobId })
    } catch (err) {
      // add() may have committed in Redis before the acknowledgement was lost.
      // Confirm absence before deleting the source owned by this UUID attempt.
      let confirmedAbsent = false
      try {
        const committedJob = await queue.getJob(jobId)
        if (committedJob) return Response.json({ jobId }, { status: 202 })
        confirmedAbsent = true
      } catch {
        logger.error({ contractId: params.id }, "[document.import] queue state unknown; temporary source retained")
      }
      if (confirmedAbsent) {
        try {
          await storage.delete(tmpKey)
        } catch {
          logger.error({ contractId: params.id }, "[document.import] unused temporary source cleanup failed")
        }
      }
      logger.error({ err, contractId: params.id }, "[document.import] conversion enqueue failed")
      return Response.json({ error: "import_enqueue_failed" }, { status: 502 })
    }

    return Response.json({ jobId }, { status: 202 })
  })
}
