import { createHash } from "node:crypto"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { emailQueue } from "@/lib/jobs/queues"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { actionApprovalState } from "@/lib/actions/approval-gate"
import { Prisma } from "@prisma/client"

const WRITERS = new Set(["owner", "admin", "legal", "member"])

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") {
    return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  }
  if (!WRITERS.has(ctx.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
  }

  return requestContext.run(ctx, async () => {
    const action = await prisma.contractAction.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: {
        id: true,
        contractId: true,
        title: true,
        status: true,
        reviewStatus: true,
        dueDate: true,
        assigneeId: true,
        sourceText: true,
        sourcePage: true,
        version: true,
        approvals: { select: { required: true, status: true, actionVersion: true } },
        contract: { select: { title: true } },
      },
    })
    if (!action) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (action.status === "STALE" || action.reviewStatus !== "reviewed") {
      return Response.json({ error: "action_review_required" }, { status: 409, headers: SECURE_HEADERS })
    }
    if (action.status === "DISMISSED" || action.status === "COMPLETED") {
      return Response.json({ error: "action_not_deliverable" }, { status: 409, headers: SECURE_HEADERS })
    }
    const approvalState = actionApprovalState(action.approvals, action.version)
    if (approvalState !== "allowed") {
      return Response.json(
        { error: approvalState === "rejected" ? "action_approval_rejected" : "action_approval_pending" },
        { status: 409, headers: SECURE_HEADERS },
      )
    }
    if (!action.assigneeId) {
      return Response.json({ error: "action_assignee_required" }, { status: 422, headers: SECURE_HEADERS })
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: ctx.organizationId, userId: action.assigneeId },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    })
    if (!member?.user.email) {
      return Response.json({ error: "action_assignee_email_required" }, { status: 422, headers: SECURE_HEADERS })
    }

    const idempotencyKey = createHash("sha256")
      .update(`${action.id}:email:${action.version}`)
      .digest("hex")
    const priorDelivery = await prisma.contractActionDelivery.findUnique({ where: { idempotencyKey } })
    if (priorDelivery) {
      return Response.json({ delivery: priorDelivery, deduplicated: true }, { headers: SECURE_HEADERS })
    }
    let delivery
    try {
      delivery = await prisma.contractActionDelivery.create({
        data: { actionId: action.id, channel: "email", idempotencyKey, status: "pending" },
      })
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code === "P2002"
        : Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002")
      if (!duplicate) throw error
      const existing = await prisma.contractActionDelivery.findUnique({ where: { idempotencyKey } })
      if (!existing) throw error
      return Response.json({ delivery: existing, deduplicated: true }, { headers: SECURE_HEADERS })
    }
    try {
      await emailQueue.add("send", {
        kind: "action_delivery",
        deliveryId: delivery.id,
        to: member.user.email,
        recipientName: member.user.name,
        actionId: action.id,
        actionTitle: action.title,
        actionUrl: `/actions/${action.id}`,
        contractTitle: action.contract.title,
        dueDate: action.dueDate?.toISOString() ?? null,
        sourceText: action.sourceText,
        sourcePage: action.sourcePage,
      }, { jobId: idempotencyKey })
      await prisma.contractActionDelivery.update({ where: { id: delivery.id }, data: { status: "queued" } })
      await prisma.activity.create({
        data: {
          contractId: action.contractId,
          contractActionId: action.id,
          userId: ctx.userId,
          action: "ACTION_DELIVERY_ATTEMPTED",
          detail: `Action email queued: ${action.title}`,
          metadata: { channel: "email", deliveryId: delivery.id, recipientUserId: member.user.id },
        },
      })
    } catch {
      await prisma.contractActionDelivery.update({
        where: { id: delivery.id },
        data: { status: "failed", errorCode: "email_enqueue_failed" },
      })
      return Response.json({ error: "delivery_failed" }, { status: 503, headers: SECURE_HEADERS })
    }

    return Response.json({ delivery: { ...delivery, status: "queued" } }, { status: 202, headers: SECURE_HEADERS })
  })
}
