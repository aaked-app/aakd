import { resolveAuth } from "@/lib/auth/middleware"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

// DocuSeal's public API does not document an idempotency key for submission
// creation. Until Aakd has an operator reconciliation flow, fail closed rather
// than risk duplicate irreversible sends after an ambiguous provider response.
export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })
  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }
    return Response.json({
      error: "signing_send_temporarily_unavailable",
      message: "Sending is paused until provider-side idempotency can be reconciled safely.",
    }, { status: 503 })
  })
}
