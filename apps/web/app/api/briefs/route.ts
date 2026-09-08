import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { z } from "zod"

const PUBLISHERS = new Set(["owner", "admin", "legal"])
const CreateBriefSchema = z.object({
  title: z.string().trim().min(1).max(200),
  audienceUserId: z.string().min(1),
  actionIds: z.array(z.string().min(1)).min(1).max(50),
})

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  return requestContext.run(ctx, async () => {
    const briefs = await prisma.teamBrief.findMany({
      where: { organizationId: ctx.organizationId, OR: [{ publishedById: ctx.userId }, { audienceUserId: ctx.userId }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, status: true, acknowledgedAt: true, createdAt: true,
        publishedBy: { select: { id: true, name: true } },
        audienceUser: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    })
    return Response.json({ briefs: briefs.map((brief) => ({ ...brief, itemCount: brief._count.items, _count: undefined })) }, { headers: SECURE_HEADERS })
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session" || !PUBLISHERS.has(ctx.role)) return Response.json({ error: "brief_publisher_required" }, { status: 403, headers: SECURE_HEADERS })

  return requestContext.run(ctx, async () => {
    let body: unknown
    try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: SECURE_HEADERS }) }
    const parsed = CreateBriefSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })
    const actionIds = [...new Set(parsed.data.actionIds)]
    const audience = await prisma.member.findFirst({ where: { organizationId: ctx.organizationId, userId: parsed.data.audienceUserId }, select: { userId: true } })
    if (!audience) return Response.json({ error: "invalid_audience" }, { status: 422, headers: SECURE_HEADERS })
    const actions = await prisma.contractAction.findMany({
      where: { organizationId: ctx.organizationId, id: { in: actionIds } },
      select: { id: true, version: true, title: true, description: true, condition: true, dueDate: true, sourceText: true, sourcePage: true, confidence: true, assigneeId: true, status: true, reviewStatus: true },
    })
    if (actions.length !== actionIds.length) return Response.json({ error: "action_not_found" }, { status: 404, headers: SECURE_HEADERS })
    const invalid = actions.find((action) => action.status === "PENDING_REVIEW" || action.status === "STALE" || action.status === "DISMISSED" || action.reviewStatus !== "reviewed")
    if (invalid) return Response.json({ error: "action_not_reviewed", actionId: invalid.id }, { status: 409, headers: SECURE_HEADERS })
    const brief = await prisma.$transaction(async (tx) => {
      const created = await tx.teamBrief.create({
        data: {
          organizationId: ctx.organizationId,
          title: parsed.data.title,
          publishedById: ctx.userId,
          audienceUserId: parsed.data.audienceUserId,
          items: { create: actions.map((action) => ({ actionId: action.id, actionVersion: action.version, title: action.title, description: action.description, condition: action.condition, dueDate: action.dueDate, sourceText: action.sourceText, sourcePage: action.sourcePage, confidence: action.confidence, assigneeId: action.assigneeId })) },
        },
        select: { id: true, title: true, status: true, createdAt: true, audienceUserId: true },
      })
      await tx.notification.create({ data: { userId: parsed.data.audienceUserId, organizationId: ctx.organizationId, eventName: "team_brief.published", title: parsed.data.title, body: "A reviewed contract brief is ready for you.", actionUrl: `/briefs/${created.id}` } })
      return created
    })
    return Response.json(brief, { status: 201, headers: SECURE_HEADERS })
  })
}
