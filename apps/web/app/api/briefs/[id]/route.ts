import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { SECURE_HEADERS } from "@/lib/api-headers"

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  return requestContext.run(ctx, async () => {
    const brief = await prisma.teamBrief.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId, OR: [{ publishedById: ctx.userId }, { audienceUserId: ctx.userId }] },
      select: { id: true, title: true, status: true, acknowledgedAt: true, createdAt: true, publishedBy: { select: { id: true, name: true } }, audienceUser: { select: { id: true, name: true } }, items: { orderBy: { createdAt: "asc" }, select: { id: true, actionId: true, actionVersion: true, title: true, description: true, condition: true, dueDate: true, sourceText: true, sourcePage: true, confidence: true, assigneeId: true } } },
    })
    if (!brief) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    return Response.json(brief, { headers: SECURE_HEADERS })
  })
}

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  return requestContext.run(ctx, async () => {
    const brief = await prisma.teamBrief.findFirst({ where: { id: params.id, organizationId: ctx.organizationId }, select: { id: true, audienceUserId: true } })
    if (!brief) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (brief.audienceUserId !== ctx.userId) return Response.json({ error: "brief_audience_required" }, { status: 403, headers: SECURE_HEADERS })
    const updated = await prisma.teamBrief.update({ where: { id: brief.id }, data: { acknowledgedAt: new Date() }, select: { id: true, acknowledgedAt: true } })
    return Response.json(updated, { headers: SECURE_HEADERS })
  })
}
