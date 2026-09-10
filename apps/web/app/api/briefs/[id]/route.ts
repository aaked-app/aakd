import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { SECURE_HEADERS } from "@/lib/api-headers"

function isCurrentBriefItem(item: {
  actionVersion: number
  action: { version: number; status: string; reviewStatus: string }
}) {
  return item.action.version === item.actionVersion
    && item.action.reviewStatus === "reviewed"
    && item.action.status !== "PENDING_REVIEW"
    && item.action.status !== "STALE"
    && item.action.status !== "DISMISSED"
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") {
    return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  }
  if (!ctx.memberId) return Response.json({ error: "current_membership_required" }, { status: 403, headers: SECURE_HEADERS })
  if (isAgreementAccessEmergencyDenyAll()) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
  return requestContext.run(ctx, async () => {
    const brief = await prisma.teamBrief.findFirst({
      where: {
        id: params.id,
        organizationId: ctx.organizationId,
        OR: [
          { audienceMemberId: ctx.memberId },
          {
            publishedById: ctx.userId,
            items: {
              every: {
                action: {
                  contract: {
                    accessGrants: {
                      some: { organizationId: ctx.organizationId, memberId: ctx.memberId },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true, title: true, status: true, acknowledgedAt: true, createdAt: true, audienceMemberId: true, publishedBy: { select: { id: true, name: true } }, audienceUser: { select: { id: true, name: true } }, items: { orderBy: { createdAt: "asc" }, select: { id: true, actionId: true, actionVersion: true, title: true, description: true, condition: true, dueDate: true, sourceText: true, sourcePage: true, confidence: true, assigneeId: true, action: { select: { version: true, status: true, reviewStatus: true } } } } },
    })
    if (!brief) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    const assigneeIds = [...new Set(brief.items.flatMap((item) => item.assigneeId ? [item.assigneeId] : []))]
    const assignees = assigneeIds.length > 0
      ? await prisma.member.findMany({
        where: { organizationId: ctx.organizationId, userId: { in: assigneeIds } },
        select: { userId: true, user: { select: { id: true, name: true } } },
      })
      : []
    const assigneesById = new Map(assignees.map((member) => [member.userId, member.user]))
    const { audienceMemberId: _audienceMemberId, ...briefSnapshot } = brief
    return Response.json({
      ...briefSnapshot,
      canRespond: _audienceMemberId === ctx.memberId,
      items: brief.items.map(({ action, ...item }) => ({
        ...item,
        assignee: item.assigneeId ? assigneesById.get(item.assigneeId) ?? null : null,
        freshness: isCurrentBriefItem({ ...item, action }) ? "CURRENT" : "STALE",
      })),
    }, { headers: SECURE_HEADERS })
  })
}

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  if (!ctx.memberId) return Response.json({ error: "current_membership_required" }, { status: 403, headers: SECURE_HEADERS })
  if (isAgreementAccessEmergencyDenyAll()) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
  return requestContext.run(ctx, async () => {
    const now = new Date()
    const acknowledgement = await prisma.$transaction(async (tx) => {
      const updated = await tx.teamBrief.updateMany({
        where: {
          id: params.id,
          organizationId: ctx.organizationId,
          audienceMemberId: ctx.memberId,
          acknowledgedAt: null,
        },
        data: { acknowledgedAt: now },
      })
      const brief = await tx.teamBrief.findFirst({
        where: { id: params.id, organizationId: ctx.organizationId, audienceMemberId: ctx.memberId },
        select: {
          id: true,
          acknowledgedAt: true,
          items: { select: { action: { select: { contractId: true } } } },
        },
      })
      if (!brief) return null
      if (updated.count > 0) {
        const contractIds = [...new Set(brief.items.map((item) => item.action.contractId))].sort()
        for (const contractId of contractIds) {
          await tx.activity.create({
            data: {
              contractId,
              userId: ctx.userId,
              action: "TEAM_BRIEF_ACKNOWLEDGED",
              metadata: { requestId: ctx.requestId, briefId: brief.id, targetMemberId: ctx.memberId },
            },
          })
        }
      }
      const { items: _items, ...result } = brief
      return { brief: result, alreadyAcknowledged: updated.count === 0 }
    })
    if (!acknowledgement) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (!acknowledgement.brief.acknowledgedAt) {
      return Response.json({ error: "brief_acknowledgement_conflict" }, { status: 409, headers: SECURE_HEADERS })
    }
    return Response.json({
      ...acknowledgement.brief,
      acknowledged: true,
      alreadyAcknowledged: acknowledgement.alreadyAcknowledged,
    }, { headers: SECURE_HEADERS })
  })
}
