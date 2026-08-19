import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { captureServerEvent } from "@/lib/posthog-server"
import { z } from "zod"

const USER_SELECT = { id: true, name: true, email: true, image: true } as const
const COMPLETED_BY_SELECT = { id: true, name: true } as const

const ROLES_CAN_WRITE = new Set(["owner", "admin", "legal", "member"])
const ROLES_CAN_DELETE = new Set(["owner", "admin", "legal"])

const OBLIGATION_INCLUDE = {
  assignee: { select: USER_SELECT },
  completedBy: { select: COMPLETED_BY_SELECT },
  createdBy: { select: COMPLETED_BY_SELECT },
  subTasks: {
    orderBy: [{ createdAt: "asc" }] as { createdAt: "asc" }[],
    include: { completedBy: { select: COMPLETED_BY_SELECT } },
  },
}

// Status is restricted to PENDING/IN_PROGRESS/COMPLETED on the client path —
// OVERDUE is reserved for the daily cron so client clock skew can't bypass it.
const PatchObligationSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  clauseReference: z.string().max(200).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().nullable().optional(),
  reminderDays: z.number().int().min(1).max(30).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
})

export async function GET(
  req: Request,
  props: { params: AsyncRouteParams<{ id: string; obligationId: string }> }
) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const obligation = await prisma.contractObligation.findUnique({
      where: { id: params.obligationId },
      include: {
        ...OBLIGATION_INCLUDE,
        contract: { select: { organizationId: true } },
      },
    })
    if (
      !obligation ||
      obligation.contractId !== params.id ||
      obligation.contract.organizationId !== ctx.organizationId
    ) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contract: _contract, ...obligationData } = obligation
    return Response.json(obligationData)
  })
}

export async function PATCH(
  req: Request,
  props: { params: AsyncRouteParams<{ id: string; obligationId: string }> }
) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (!ROLES_CAN_WRITE.has(ctx.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    const existing = await prisma.contractObligation.findUnique({
      where: { id: params.obligationId },
      select: {
        id: true,
        contractId: true,
        status: true,
        title: true,
        contract: { select: { organizationId: true } },
      },
    })
    if (
      !existing ||
      existing.contractId !== params.id ||
      existing.contract.organizationId !== ctx.organizationId
    ) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = PatchObligationSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const data = parsed.data

    if (data.assigneeId) {
      const assigneeMember = await prisma.member.findFirst({
        where: { userId: data.assigneeId, organizationId: ctx.organizationId },
        select: { userId: true },
      })
      if (!assigneeMember) {
        return Response.json({ error: "invalid_assignee" }, { status: 422 })
      }
    }

    const linkedAction = await prisma.contractAction.findFirst({
      where: { organizationId: ctx.organizationId, sourceObligationId: existing.id },
      select: { id: true, version: true, title: true },
    })
    if (linkedAction && data.status !== undefined) {
      return Response.json(
        { error: "linked_action_command_required", actionId: linkedAction.id },
        { status: 409 },
      )
    }

    const completing = data.status === "COMPLETED" && existing.status !== "COMPLETED"
    const reopening =
      data.status && data.status !== "COMPLETED" && existing.status === "COMPLETED"

    let updated
    try {
      updated = await prisma.$transaction(async (tx) => {
        const obligation = await tx.contractObligation.update({
          where: { id: params.obligationId },
          data: {
        title: data.title,
        description: data.description === undefined ? undefined : data.description,
        clauseReference:
          data.clauseReference === undefined ? undefined : data.clauseReference,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        reminderSentAt: data.dueDate !== undefined ? null : undefined,
        assigneeId:
          data.assigneeId === undefined ? undefined : data.assigneeId,
        reminderDays: data.reminderDays,
        status: data.status,
        completedAt: completing ? new Date() : reopening ? null : undefined,
        completedById: completing ? ctx.userId : reopening ? null : undefined,
          },
          include: OBLIGATION_INCLUDE,
        })
        if (linkedAction) {
          const synced = await tx.contractAction.updateMany({
            where: { id: linkedAction.id, organizationId: ctx.organizationId, version: linkedAction.version },
            data: {
              title: obligation.title,
              description: obligation.description,
              condition: obligation.clauseReference,
              dueDate: obligation.dueDate,
              assigneeId: obligation.assigneeId,
              version: { increment: 1 },
            },
          })
          if (synced.count !== 1) throw new Error("action_version_conflict")
          await tx.activity.create({
            data: {
              contractId: params.id,
              contractActionId: linkedAction.id,
              userId: ctx.userId,
              action: data.assigneeId !== undefined ? "ACTION_ASSIGNED" : "ACTION_REVIEWED",
              detail: `Linked obligation updated: ${obligation.title}`,
              metadata: { obligationId: obligation.id, expectedVersion: linkedAction.version },
            },
          })
        }
        const changedFields = Object.keys(parsed.data).join(", ")
        await tx.activity.create({
          data: {
            contractId: params.id,
            userId: ctx.userId,
            action: completing ? "OBLIGATION_COMPLETED" : "OBLIGATION_UPDATED",
            detail: completing
              ? `Obligation completed: ${obligation.title}`
              : `Obligation updated: ${obligation.title}${changedFields ? ` (${changedFields})` : ""}`,
            metadata: { obligationId: obligation.id },
          },
        })
        return obligation
      })
    } catch (error) {
      if (error instanceof Error && error.message === "action_version_conflict") {
        return Response.json({ error: "action_version_conflict" }, { status: 409 })
      }
      throw error
    }
    if (completing) captureServerEvent(ctx.userId, "obligation_completed")

    return Response.json(updated)
  })
}

export async function DELETE(
  req: Request,
  props: { params: AsyncRouteParams<{ id: string; obligationId: string }> }
) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (!ROLES_CAN_DELETE.has(ctx.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    const existing = await prisma.contractObligation.findUnique({
      where: { id: params.obligationId },
      select: {
        id: true,
        contractId: true,
        title: true,
        contract: { select: { organizationId: true } },
      },
    })
    if (
      !existing ||
      existing.contractId !== params.id ||
      existing.contract.organizationId !== ctx.organizationId
    ) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const linkedAction = await prisma.contractAction.findFirst({
      where: { organizationId: ctx.organizationId, sourceObligationId: existing.id },
      select: { id: true, version: true },
    })
    try {
      await prisma.$transaction(async (tx) => {
        if (linkedAction) {
          const dismissed = await tx.contractAction.updateMany({
            where: { id: linkedAction.id, organizationId: ctx.organizationId, version: linkedAction.version },
            data: { sourceObligationId: null, status: "DISMISSED", version: { increment: 1 } },
          })
          if (dismissed.count !== 1) throw new Error("action_version_conflict")
          await tx.activity.create({
            data: {
              contractId: params.id,
              contractActionId: linkedAction.id,
              userId: ctx.userId,
              action: "ACTION_DISMISSED",
              detail: `Source obligation deleted: ${existing.title}`,
              metadata: { obligationId: existing.id, expectedVersion: linkedAction.version },
            },
          })
        }
        await tx.contractObligation.delete({ where: { id: params.obligationId } })
        await tx.activity.create({
          data: {
            contractId: params.id,
            userId: ctx.userId,
            action: "OBLIGATION_DELETED",
            detail: `Obligation deleted: ${existing.title}`,
            metadata: { obligationId: existing.id },
          },
        })
      })
    } catch (error) {
      if (error instanceof Error && error.message === "action_version_conflict") {
        return Response.json({ error: "action_version_conflict" }, { status: 409 })
      }
      throw error
    }

    return new Response(null, { status: 204 })
  })
}
