import { resolveAuth } from "@/lib/auth/middleware"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { MAX_CONTRACT_FILE_BYTES } from "@/lib/contracts/file-validation"
import { prisma } from "@/lib/db/client"
import {
  authorizedDocumentExportBinding,
  authorizedDocumentExportSource,
  documentExportDownloadPath,
  type DocumentExportArtifactBinding,
} from "@/lib/jobs/document-export-access"
import { storage } from "@/lib/storage"

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string; jobId: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key") return Response.json({ error: "human_session_required" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }

    const artifact = await prisma.documentExportArtifact.findFirst({
      where: {
        jobId: params.jobId,
        contractId: params.id,
        organizationId: ctx.organizationId,
        requestedByMemberId: ctx.memberId,
        requestedById: ctx.userId,
      },
    })
    if (!artifact || (artifact.format !== "docx" && artifact.format !== "pdf")) {
      return new Response("Not Found", { status: 404 })
    }
    if (artifact.expiresAt <= new Date() || artifact.state === "EXPIRING" || artifact.state === "EXPIRED") {
      return new Response("Not Found", { status: 404 })
    }
    const binding: DocumentExportArtifactBinding = {
      jobId: artifact.jobId,
      organizationId: artifact.organizationId,
      contractId: artifact.contractId,
      requestedByMemberId: artifact.requestedByMemberId,
      requestedById: artifact.requestedById,
      documentId: artifact.documentId,
      documentVersion: artifact.documentVersion,
      documentContentHash: artifact.documentContentHash,
      format: artifact.format,
      expiresAt: artifact.expiresAt,
    }
    const authorized = artifact.state === "READY"
      ? Boolean(await authorizedDocumentExportSource(prisma, binding, false))
      : await authorizedDocumentExportBinding(prisma, binding)
    if (!authorized) return new Response("Not Found", { status: 404 })

    if (artifact.state === "READY") {
      if (!artifact.storageKey) return Response.json({ status: "failed", error: "export_failed" })
      if (new URL(req.url).searchParams.get("download") === "1") {
        try {
          const object = await storage.getObject(artifact.storageKey, MAX_CONTRACT_FILE_BYTES)
          const contentType = artifact.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          return new Response(Buffer.from(object.body), {
            headers: {
              "Cache-Control": "private, no-store",
              "Content-Disposition": `attachment; filename="contract-export.${artifact.format}"`,
              "Content-Type": contentType,
              "X-Content-Type-Options": "nosniff",
            },
          })
        } catch {
          return Response.json({ error: "export_failed" }, { status: 404 })
        }
      }
      return Response.json({
        status: "complete",
        downloadUrl: documentExportDownloadPath(artifact.contractId, artifact.jobId),
      })
    }
    if (artifact.state === "FAILED") {
      return Response.json({
        status: "failed",
        error: "export_failed",
      })
    }
    return Response.json({ status: "pending" })
  })
}
