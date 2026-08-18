import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { z } from "zod"

const WRITERS = new Set(["owner", "admin", "legal", "member"])
const Schema = z.object({
  assignedToId: z.string().min(1),
  comment: z.string().max(2000).optional(),
  expectedVersion: z.number().int().nonnegative(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })
  if (!WRITERS.has(ctx.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    const action = await prisma.contractAction.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: { id: true, contractId: true, title: true, status: true, reviewStatus: true, version: true },
    })
    if (!action) return Response.json({ error: "Not Found" }, { status: 404 })
    if (action.status === "STALE") return Response.json({ error: "action_stale_review_required" }, { status: 409 })
    if (action.status !== "PROPOSED" || action.reviewStatus !== "reviewed") {
      return Response.json({ error: "action_not_ready_for_approval" }, { status: 409 })
    }

    let body: unknown
    try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }) }
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    if (action.version !== parsed.data.expectedVersion) {
      return Response.json({ error: "action_version_conflict", currentVersion: action.version }, { status: 409 })
    }

    const member = await prisma.member.findFirst({
      where: { userId: parsed.data.assignedToId, organizationId: ctx.organizationId },
      select: { userId: true },
    })
    if (!member) return Response.json({ error: "invalid_assignee" }, { status: 422 })

    const existing = await prisma.approval.findFirst({
      where: { actionId: action.id, requestedById: ctx.userId, assignedToId: parsed.data.assignedToId, status: "pending" },
      select: { id: true },
    })
    if (existing) return Response.json({ approval: existing, deduplicated: true })

    const approval = await prisma.$transaction(async (tx) => {
      const bumped = await tx.contractAction.updateMany({
        where: {
          id: action.id,
          organizationId: ctx.organizationId,
          status: "PROPOSED",
          version: parsed.data.expectedVersion,
        },
        data: { version: { increment: 1 } },
      })
      if (bumped.count !== 1) return null
      const created = await tx.approval.create({
        data: {
          contractId: action.contractId,
          actionId: action.id,
          actionVersion: parsed.data.expectedVersion + 1,
          requestedById: ctx.userId,
          assignedToId: parsed.data.assignedToId,
          status: "pending",
          required: true,
          comment: parsed.data.comment,
        },
      })
      await tx.activity.create({
        data: {
          contractId: action.contractId,
          contractActionId: action.id,
          userId: ctx.userId,
          action: "ACTION_PROPOSED",
          detail: `Approval requested for action: ${action.title}`,
          metadata: { requestSource: ctx.source, requestId: ctx.requestId, approvalId: created.id },
        },
      })
      return created
    })
    if (!approval) return Response.json({ error: "action_version_conflict" }, { status: 409 })

    return Response.json({ approval, actionId: action.id }, { status: 201 })
  })
}
