import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { Prisma } from "@prisma/client"
import { z } from "zod"

const PUBLISHERS = new Set(["owner", "admin", "legal"])
const CreateBriefSchema = z.object({
  title: z.string().trim().min(1).max(200),
  audienceUserId: z.string().min(1),
  actionIds: z.array(z.string().min(1)).min(1).max(50),
  expectedVersions: z.record(
    z.string().min(1),
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  ),
}).superRefine((value, refinement) => {
  const actionIds = new Set(value.actionIds)
  if (actionIds.size !== value.actionIds.length) {
    refinement.addIssue({ code: "custom", path: ["actionIds"], message: "Action ids must be unique" })
  }
  const versionIds = Object.keys(value.expectedVersions)
  if (versionIds.length !== actionIds.size || versionIds.some((id) => !actionIds.has(id))) {
    refinement.addIssue({ code: "custom", path: ["expectedVersions"], message: "Expected versions must match action ids" })
  }
})

type BriefAction = {
  id: string
  contractId: string
  version: number
  title: string
  description: string | null
  condition: string | null
  dueDate: Date | null
  sourceText: string | null
  sourcePage: number | null
  confidence: number | null
  assigneeId: string | null
  status: string
  reviewStatus: string
}

function publicationFailure(action: BriefAction) {
  if (
    action.status === "PENDING_REVIEW"
    || action.status === "STALE"
    || action.status === "DISMISSED"
    || action.reviewStatus !== "reviewed"
  ) return "action_not_reviewed"
  // A page number alone is not a reviewable excerpt for a minimized brief.
  // DOCX may lack page numbers, but every published claim needs source text.
  if (!action.sourceText?.trim()) return "action_citation_required"
  if (!action.assigneeId) return "action_assignee_required"
  if (!action.dueDate && !action.condition?.trim()) return "action_deadline_or_condition_required"
  return null
}

function isTransactionConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034"
}

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") {
    return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  }
  if (!ctx.memberId) return Response.json({ error: "current_membership_required" }, { status: 403, headers: SECURE_HEADERS })
  if (isAgreementAccessEmergencyDenyAll()) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
  return requestContext.run(ctx, async () => {
    const briefs = await prisma.teamBrief.findMany({
      where: {
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
  if (!ctx.memberId) return Response.json({ error: "current_membership_required" }, { status: 403, headers: SECURE_HEADERS })
  if (isAgreementAccessEmergencyDenyAll()) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })

  return requestContext.run(ctx, async () => {
    let body: unknown
    try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: SECURE_HEADERS }) }
    const parsed = CreateBriefSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })
    const actionIds = parsed.data.actionIds
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Keep audience validation true through commit if membership is being
        // revoked concurrently with publication.
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "Member"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "userId" = ${parsed.data.audienceUserId}
          FOR UPDATE
        `)
        const audience = await tx.member.findFirst({
          where: { organizationId: ctx.organizationId, userId: parsed.data.audienceUserId },
          select: { id: true, userId: true },
        })
        if (!audience) return { ok: false as const, status: 422, error: "invalid_audience" }

        // Serialize action changes with publication so the snapshot cannot be
        // created from a version that changes between validation and insert.
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "ContractAction"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "id" IN (${Prisma.join([...actionIds].sort())})
          ORDER BY "id"
          FOR UPDATE
        `)
        const actions = await tx.contractAction.findMany({
          where: { organizationId: ctx.organizationId, id: { in: actionIds } },
          select: { id: true, contractId: true, version: true, title: true, description: true, condition: true, dueDate: true, sourceText: true, sourcePage: true, confidence: true, assigneeId: true, status: true, reviewStatus: true },
        })
        if (actions.length !== actionIds.length) return { ok: false as const, status: 404, error: "action_not_found" }

        const contractIds = [...new Set(actions.map((action) => action.contractId))].sort()
        await tx.$queryRaw(Prisma.sql`
          SELECT "contractId" FROM "ContractAccessGrant"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "memberId" = ${ctx.memberId}
            AND "contractId" IN (${Prisma.join(contractIds)})
          ORDER BY "contractId"
          FOR UPDATE
        `)
        const grants = await tx.contractAccessGrant.findMany({
          where: {
            organizationId: ctx.organizationId,
            memberId: ctx.memberId,
            contractId: { in: contractIds },
          },
          select: { contractId: true },
        })
        if (new Set(grants.map((grant) => grant.contractId)).size !== contractIds.length) {
          return { ok: false as const, status: 404, error: "action_not_found" }
        }

        const actionsById = new Map(actions.map((action) => [action.id, action]))
        for (const actionId of actionIds) {
          const action = actionsById.get(actionId)!
          if (action.version !== parsed.data.expectedVersions[actionId]) {
            return { ok: false as const, status: 409, error: "action_version_conflict", actionId }
          }
          const error = publicationFailure(action)
          if (error) return { ok: false as const, status: 409, error, actionId }
        }

        const created = await tx.teamBrief.create({
          data: {
            organizationId: ctx.organizationId,
            title: parsed.data.title,
            publishedById: ctx.userId,
            audienceUserId: parsed.data.audienceUserId,
            audienceMemberId: audience.id,
            items: {
              create: actionIds.map((actionId) => {
                const action = actionsById.get(actionId)!
                return { actionId: action.id, actionVersion: action.version, title: action.title, description: action.description, condition: action.condition, dueDate: action.dueDate, sourceText: action.sourceText, sourcePage: action.sourcePage, confidence: action.confidence, assigneeId: action.assigneeId }
              }),
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            audienceUserId: true,
            audienceMemberId: true,
            items: { select: { id: true, actionId: true, action: { select: { contractId: true } } } },
          },
        })
        for (const contractId of contractIds) {
          const itemIds = created.items
            .filter((item) => item.action.contractId === contractId)
            .map((item) => item.id)
            .sort()
          await tx.activity.create({
            data: {
              contractId,
              userId: ctx.userId,
              action: "TEAM_BRIEF_PUBLISHED",
              metadata: { requestId: ctx.requestId, briefId: created.id, targetMemberId: audience.id, itemIds },
            },
          })
        }
        await tx.notification.create({ data: { userId: parsed.data.audienceUserId, organizationId: ctx.organizationId, eventName: "team_brief.published", title: parsed.data.title, body: "A reviewed contract brief is ready for you.", actionUrl: `/briefs/${created.id}` } })
        const { items: _items, ...brief } = created
        return { ok: true as const, brief }
      }, { isolationLevel: "Serializable" })

      if (!result.ok) {
        const body = "actionId" in result ? { error: result.error, actionId: result.actionId } : { error: result.error }
        return Response.json(body, { status: result.status, headers: SECURE_HEADERS })
      }
      return Response.json(result.brief, { status: 201, headers: SECURE_HEADERS })
    } catch (error) {
      if (isTransactionConflict(error)) {
        return Response.json({ error: "brief_source_changed" }, { status: 409, headers: SECURE_HEADERS })
      }
      throw error
    }
  })
}
