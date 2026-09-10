import crypto from "node:crypto"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasRole, requireRole } from "@/lib/auth/roles"
import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { withTransactionRetry } from "@/lib/db/transaction-retry"
import { storage } from "@/lib/storage"
import { contractExtractQueue, documentConvertQueue } from "@/lib/jobs/queues"
import { enqueueNotification } from "@/lib/notifications/fanout"
import { writeInAppToOrgMembers } from "@/lib/notifications/write-in-app"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { captureServerEvent } from "@/lib/posthog-server"
import { fireAndLog } from "@/lib/utils/fire-and-log"
import { Prisma } from "@prisma/client"
import { detectContractFileMime, MAX_CONTRACT_FILE_BYTES, sanitizeContractFilename } from "@/lib/contracts/file-validation"
import { clearExtractedSourceBinding, invalidateAgentActionsForSourceChange } from "@/lib/contracts/source-binding"

class UploadAuthorizationError extends Error {
  constructor(readonly status: 403 | 404 | 422) {
    super(status === 404 ? "Not Found" : status === 422 ? "read_only_status" : "Forbidden")
  }
}

const READ_ONLY_STATUSES = new Set(["AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"])

async function cleanupStagedUpload(
  contractId: string,
  organizationId: string,
  storageKey: string,
): Promise<void> {
  try {
    const referenced = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "Contract"
        WHERE "id" = ${contractId} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `)
      const rows = await tx.$queryRaw<Array<{ referenced: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM "ContractFile" AS file
          INNER JOIN "Contract" AS contract ON contract."id" = file."contractId"
          WHERE file."contractId" = ${contractId}
            AND file."storageKey" = ${storageKey}
            AND contract."organizationId" = ${organizationId}
        ) AS "referenced"
      `)
      return rows[0]?.referenced
    }, { isolationLevel: "ReadCommitted" })
    if (referenced === false) await storage.delete(storageKey)
  } catch {
    // A transaction may commit even when its acknowledgement is lost. Retain
    // the object whenever the exact durable reference cannot be established.
    logger.error({ contractId }, "[upload] staged object retained after inconclusive cleanup")
  }
}

// GET /api/contracts/[id]/upload?fileId=... — return a same-origin file URL or stream the file
export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key" && !ctx.scopes?.includes("text_read")) return Response.json({ error: "text_read scope required" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId)
      return Response.json({ error: "Not Found" }, { status: 404 })

    const url = new URL(req.url)
    const fileId = url.searchParams.get("fileId")
    if (!fileId) return Response.json({ error: "fileId required" }, { status: 400 })

    const file = await prisma.contractFile.findUnique({
      where: { id: fileId },
      select: { id: true, contractId: true, storageKey: true, filename: true, mimeType: true },
    })
    if (!file || file.contractId !== params.id)
      return Response.json({ error: "Not Found" }, { status: 404 })

    const stream = url.searchParams.get("stream") === "1"
    if (stream) {
      try {
        const object = await storage.getObject(file.storageKey)
        const inline = url.searchParams.get("inline") === "1"
        return new Response(Buffer.from(object.body), {
          headers: {
            "Content-Type": object.contentType ?? file.mimeType ?? "application/octet-stream",
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
            "Cache-Control": "private, no-store",
          },
        })
      } catch (error) {
        logger.error({ err: error, contractId: params.id, fileId }, "[upload] file stream failed")
        return Response.json({ error: "File unavailable" }, { status: 404 })
      }
    }

    const proxyUrl = `/api/contracts/${encodeURIComponent(params.id)}/upload?fileId=${encodeURIComponent(fileId)}&stream=1&inline=1`
    return Response.json({ url: proxyUrl })
  })
}

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  // Rate limit: 20 uploads/min per org (file parsing is expensive)
  const rl = await rateLimit(`${ctx.organizationId}:upload`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const existing = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true, title: true },
    })
    // Middleware injects org scope; explicit check for defense-in-depth.
    if (!existing || existing.organizationId !== ctx.organizationId)
      return Response.json({ error: "Not Found" }, { status: 404 })

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return new Response("Invalid form data", { status: 400 })
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return new Response("Missing file field", { status: 400 })
    }

    if (file.size > MAX_CONTRACT_FILE_BYTES) {
      return new Response("File exceeds 50MB limit", { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const mimeType = detectContractFileMime(buffer)
    if (!mimeType) {
      return new Response("Only PDF and DOCX files are accepted", { status: 415 })
    }

    const filename = sanitizeContractFilename(file.name)
    const uploadAttemptId = crypto.randomUUID()
    const key = storage.storageKey(existing.organizationId, params.id, `${uploadAttemptId}_${filename}`)

    try {
      await storage.upload(key, buffer, mimeType)
    } catch (err) {
      // Some object stores may persist an upload even when the acknowledgement
      // is lost. Run the same exact-reference check used after DB failures.
      await cleanupStagedUpload(params.id, ctx.organizationId, key)
      logger.error({ err, contractId: params.id }, "[upload] storage upload failed")
      return new Response("Storage upload failed", { status: 502 })
    }

    // Atomic: find prior latest, flip it, create new file + version row.
    // Without a transaction, a crash between the updateMany and create leaves
    // the contract with zero rows marked isLatest.
    let contractFile: Awaited<ReturnType<typeof prisma.contractFile.create>>
    try {
      contractFile = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
        // This helper locks the contract parent first, then rechecks the current
        // membership role and exact agreement grant before any mutation.
        const permission = await lockCurrentAgreementPermission(tx, ctx, params.id)
        if (!permission) throw new UploadAuthorizationError(404)
        if (!hasRole(permission.role, "member")) throw new UploadAuthorizationError(403)
        const current = await tx.contract.findFirst({
          where: { id: params.id, organizationId: ctx.organizationId },
          select: { status: true },
        })
        if (!current) throw new UploadAuthorizationError(404)
        if (current.status === "ARCHIVED") throw new UploadAuthorizationError(422)
        const latestFile = await tx.contractFile.findFirst({
          where: { contractId: params.id },
          orderBy: { version: "desc" },
          select: { version: true },
        })
        if (READ_ONLY_STATUSES.has(current.status)) {
          // First-use ingestion of an already executed agreement is allowed,
          // but an existing canonical source or approved editor may not change.
          const hasDocument = latestFile ? false : Boolean(await tx.contractDocument.findUnique({
            where: { contractId: params.id }, select: { id: true },
          }))
          if (latestFile || hasDocument) throw new UploadAuthorizationError(422)
        }
        const nextVersion = (latestFile?.version ?? 0) + 1

        await tx.contractFile.updateMany({
          where: { contractId: params.id, isLatest: true },
          data: { isLatest: false },
        })

        const contractFile = await tx.contractFile.create({
          data: {
            contractId: params.id,
            filename,
            storageKey: key,
            mimeType,
            sizeBytes: buffer.byteLength,
            isLatest: true,
            version: nextVersion,
            uploadedById: ctx.userId,
          },
        })

        await tx.contractVersion.create({
          data: {
            contractId: params.id,
            version: nextVersion,
            fileId: contractFile.id,
            createdById: ctx.userId,
            changeNote: `Uploaded ${filename}`,
          },
        })

        // A new file invalidates derived text, risk, and unreviewed AI facts.
        // Keep explicitly accepted metadata, but never present results from the
        // previous document version as if they belonged to this upload.
        await tx.contract.update({
          where: { id: params.id },
          data: {
            extractedText: null,
            ...clearExtractedSourceBinding(),
            isOcrExtracted: false,
            riskScore: null,
            riskScoredAt: null,
            riskDetails: Prisma.JsonNull,
          },
        })
        await invalidateAgentActionsForSourceChange(tx, ctx.organizationId, params.id)
        if (latestFile) {
          // The searchable embedding index is as source-bound as extracted text.
          // Delete it under the parent lock so old jobs cannot be served after
          // this upload; workers repopulate it only after source verification.
          await tx.contractEmbedding.deleteMany({ where: { contractId: params.id } })
          await tx.$executeRaw`DELETE FROM "ContractChunkEmbedding" WHERE "contractId" = ${params.id}`
          await tx.aIExtraction.deleteMany({
            where: { contractId: params.id, status: { not: "accepted" } },
          })
          // Candidates are tied to the exact document text. Accepted obligations
          // are already durable ledger records, but pending suggestions must not
          // survive a replacement upload.
          await tx.contractObligationSuggestion.deleteMany({
            where: { contractId: params.id, status: "pending" },
          })
        }

        await tx.activity.create({
          data: {
            contractId: params.id,
            userId: ctx.userId,
            action: "UPLOADED",
            detail: filename,
            metadata: { fileId: contractFile.id },
          },
        })
        return contractFile
      }, { isolationLevel: "Serializable" }))
    } catch (err) {
      await cleanupStagedUpload(params.id, ctx.organizationId, key)
      if (err instanceof UploadAuthorizationError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      logger.error({ err, contractId: params.id }, "[upload] durable file commit failed")
      return Response.json({ error: "upload_persistence_failed" }, { status: 500 })
    }

    fireAndLog(
      enqueueNotification("contract.uploaded", params.id, ctx.userId, {}),
      "enqueueNotification:contractUploaded",
      ctx.requestId,
    )
    // Write in-app notification directly — does not depend on worker being up
    fireAndLog(
      writeInAppToOrgMembers(
        ctx.organizationId,
        params.id,
        "contract.uploaded",
        "Contract file uploaded",
        `A file was uploaded to "${existing.title}"`,
        ctx.userId, // exclude the uploader
      ),
      "writeInAppToOrgMembers:contractUploaded",
      ctx.requestId,
    )

    // Enqueue text extraction job — heavy work must not block the API route
    let extractionQueued = false
    let conversionQueued = false
    try {
      await contractExtractQueue.add("extract", {
        contractId: params.id,
        organizationId: ctx.organizationId,
        fileId: contractFile.id,
        storageKey: key,
        preserveUserFields: true,
      }, { jobId: `contract-text-${contractFile.id}` })
      extractionQueued = true
    } catch (err) {
      logger.error({ err, contractId: params.id }, "[upload] failed to enqueue extraction job")
    }

    // Enqueue document.convert so the editor tab is populated after upload.
    // This converts the PDF/DOCX to TipTap JSON and saves it as a ContractDocument.
    // The uploaded contract file is durable and must never be cleaned up by the
    // converter (only explicit editor imports use disposable tmp objects).
    const fileType = mimeType === "application/pdf" ? "pdf" : "docx"
    try {
      await documentConvertQueue.add("convert", {
        contractId: params.id,
        organizationId: ctx.organizationId,
        requestedByMemberId: ctx.memberId,
        apiKeyId: ctx.apiKeyId,
        sourceFileId: contractFile.id,
        storageKey: key,
        requestedById: ctx.userId,
        jobId: contractFile.id,
        fileType,
        deleteSource: false,
      }, { jobId: `contract-document-${contractFile.id}` })
      conversionQueued = true
    } catch (err) {
      logger.error({ err, contractId: params.id }, "[upload] failed to enqueue document.convert job")
    }

    const downloadUrl = `/api/contracts/${encodeURIComponent(params.id)}/upload?fileId=${encodeURIComponent(contractFile.id)}&stream=1&download=1`

    captureServerEvent(ctx.userId, "file_uploaded", {
      mimeType,
      version: contractFile.version,
      isFirstFile: contractFile.version === 1,
    })

    return Response.json({ ...contractFile, downloadUrl, extractionQueued, conversionQueued }, { status: 201 })
  });
}
