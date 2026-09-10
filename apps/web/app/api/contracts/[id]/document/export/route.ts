import { randomUUID } from "node:crypto"
import { resolveAuth } from "@/lib/auth/middleware"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { withTransactionRetry } from "@/lib/db/transaction-retry"
import { bindDocumentExport, DocumentExportAuthorizationError } from "@/lib/jobs/document-export-access"
import { documentExportExpiresAt } from "@/lib/jobs/document-export-lifecycle"
import { documentExportQueue } from "@/lib/jobs/queues"
import { captureServerEvent } from "@/lib/posthog-server"
import { z } from "zod"

const ExportSchema = z.object({
  format: z.enum(["docx", "pdf"]),
})

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key") return Response.json({ error: "human_session_required" }, { status: 403 })
  if (!ctx.memberId) return Response.json({ error: "Not Found" }, { status: 404 })
  const memberId = ctx.memberId

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }
    const parsed = ExportSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    let artifact
    try {
      artifact = await withTransactionRetry(() => prisma.$transaction(
        async (tx) => {
          const document = await bindDocumentExport(tx, ctx, params.id)
          if (!document) return null
          const now = new Date()
          const existing = await tx.documentExportArtifact.findFirst({
            where: {
              organizationId: ctx.organizationId,
              contractId: params.id,
              requestedByMemberId: memberId,
              requestedById: ctx.userId,
              documentId: document.documentId,
              documentVersion: document.documentVersion,
              documentContentHash: document.documentContentHash,
              format: parsed.data.format,
              state: { in: ["QUEUED", "READY"] },
              expiresAt: { gt: now },
            },
            select: { jobId: true, state: true },
          })
          if (existing) return existing
          const jobId = randomUUID()
          return tx.documentExportArtifact.create({
            data: {
              jobId,
              organizationId: ctx.organizationId,
              contractId: params.id,
              requestedByMemberId: memberId,
              requestedById: ctx.userId,
              documentId: document.documentId,
              documentVersion: document.documentVersion,
              documentContentHash: document.documentContentHash,
              format: parsed.data.format,
              expiresAt: documentExportExpiresAt(now),
            },
            select: { jobId: true, state: true },
          })
        },
        { isolationLevel: "Serializable" },
      ))
    } catch (error) {
      if (error instanceof DocumentExportAuthorizationError) {
        return Response.json({ error: "Not Found" }, { status: 404 })
      }
      throw error
    }
    if (!artifact) {
      return Response.json({ error: "no_document" }, { status: 422 })
    }

    if (artifact.state === "QUEUED") {
      await documentExportQueue.add("export", { jobId: artifact.jobId }, { jobId: artifact.jobId })
    }

    captureServerEvent(ctx.userId, "contract_exported", {
      contractId: params.id,
      format: parsed.data.format,
      organizationId: ctx.organizationId,
    })

    return Response.json({ jobId: artifact.jobId }, { status: 202 })
  })
}
