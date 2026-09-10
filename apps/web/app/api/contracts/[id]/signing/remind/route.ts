import { resolveAuth } from "@/lib/auth/middleware"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const { id } = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, id))) return Response.json({ error: "Not Found" }, { status: 404 })
    // Reminder delivery has no proven provider idempotency or reconciliation.
    return Response.json({ error: "signing_reminder_temporarily_unavailable" }, { status: 503 })
  })
}
