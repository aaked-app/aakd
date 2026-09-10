import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { hasRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { contractAiExtractQueue } from "@/lib/jobs/queues"
import { plateToPlaintext } from "@/lib/editor/plate-to-plaintext"
import { clearExtractedSourceBinding, invalidateAgentActionsForSourceChange } from "@/lib/contracts/source-binding"

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  if (!hasRole(ctx.role, "legal")) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }

    const document = await prisma.contractDocument.findUnique({
      where: { contractId: params.id },
      select: { content: true },
    })
    if (!document) {
      return Response.json({ error: "no_document" }, { status: 422 })
    }

    const plaintext = plateToPlaintext(document.content)

    if (!plaintext) {
      return Response.json({ error: "empty_document" }, { status: 422 })
    }

    await prisma.$transaction(async tx => {
      await tx.contract.update({
        where: { id: params.id },
        data: { extractedText: plaintext, ...clearExtractedSourceBinding() },
      })
      await invalidateAgentActionsForSourceChange(tx, ctx.organizationId, params.id)
    })

    await contractAiExtractQueue.add("ai_extract", {
      contractId: params.id,
      organizationId: ctx.organizationId,
      extractedText: plaintext,
    })

    await writeActivity(
      params.id,
      ctx.userId,
      "METADATA_EXTRACTED",
      "Editor content sent for AI extraction",
    )

    return Response.json({ queued: true })
  })
}
