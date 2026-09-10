import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { actionDetailSelect, toActionDetail } from "@/lib/actions/dto"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { captureServerEvent } from "@/lib/posthog-server"
import { z } from "zod"
import { actionApprovalState } from "@/lib/actions/approval-gate"
import { agreementRelationWhere, lockCurrentAgreementPermission, type AgreementPrincipal } from "@/lib/auth/agreement-access"
import { hasCurrentAgentActionSource } from "@/lib/contracts/source-binding"
import { createHash } from "node:crypto"
import { ACTION_PROPOSAL_KINDS, actionDateSemanticIssue } from "@/lib/actions/agent-proposal-schema"

const WRITERS = new Set(["owner", "admin", "legal", "member"])

const BaseCommandSchema = z.object({ expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1) })
const CommandSchema = z.discriminatedUnion("command", [
  BaseCommandSchema.extend({
    command: z.literal("validate"),
    kind: z.enum(ACTION_PROPOSAL_KINDS).optional(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).nullable().optional(),
    condition: z.string().max(2000).nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    noticeDate: z.string().datetime().nullable().optional(),
    evidenceRequired: z.string().min(1).max(80).nullable().optional(),
  }),
  BaseCommandSchema.extend({ command: z.literal("assign"), assigneeId: z.string().min(1) }),
  BaseCommandSchema.extend({ command: z.literal("acknowledge") }),
  BaseCommandSchema.extend({ command: z.literal("start") }),
  BaseCommandSchema.extend({ command: z.literal("block"), reason: z.string().min(1).max(1000) }),
  BaseCommandSchema.extend({ command: z.literal("complete") }),
  BaseCommandSchema.extend({ command: z.literal("reopen") }),
  BaseCommandSchema.extend({ command: z.literal("dismiss"), reason: z.string().max(1000).optional() }),
])

type Command = z.infer<typeof CommandSchema>

const ALLOWED_FROM: Record<Command["command"], ReadonlySet<string>> = {
  validate: new Set(["PENDING_REVIEW", "STALE"]),
  assign: new Set(["PROPOSED", "ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED"]),
  acknowledge: new Set(["PROPOSED"]),
  start: new Set(["ACKNOWLEDGED", "BLOCKED"]),
  block: new Set(["ACKNOWLEDGED", "IN_PROGRESS"]),
  complete: new Set(["ACKNOWLEDGED", "IN_PROGRESS"]),
  reopen: new Set(["COMPLETED"]),
  dismiss: new Set(["PENDING_REVIEW", "PROPOSED", "ACKNOWLEDGED", "BLOCKED"]),
}

const ACTIVITY_BY_COMMAND = {
  validate: "ACTION_REVIEWED",
  assign: "ACTION_ASSIGNED",
  acknowledge: "ACTION_ACKNOWLEDGED",
  start: "ACTION_STARTED",
  block: "ACTION_BLOCKED",
  complete: "ACTION_COMPLETED",
  reopen: "ACTION_REOPENED",
  dismiss: "ACTION_DISMISSED",
} as const

function canReadSourceText(ctx: { source: "session" | "api_key"; scopes?: string[] }) {
  return ctx.source === "session" || ctx.scopes?.includes("text_read") === true
}

async function findAction(id: string, ctx: AgreementPrincipal, includeSourceText: boolean) {
  return prisma.contractAction.findFirst({
    where: { id, organizationId: ctx.organizationId, contract: agreementRelationWhere(ctx) },
    select: actionDetailSelect(includeSourceText),
  })
}

async function resolveProposalAttribution(
  action: { proposedByPrincipalType?: string | null; proposedByPrincipalId?: string | null },
  ctx: AgreementPrincipal & { source: "session" | "api_key" },
): Promise<string | null> {
  if (ctx.source !== "session" || !action.proposedByPrincipalType || !action.proposedByPrincipalId) return null
  if (action.proposedByPrincipalType === "api_key") {
    const key = await prisma.apiKey.findUnique({
      where: { id: action.proposedByPrincipalId },
      select: { organizationId: true, name: true, prefix: true },
    })
    if (key?.organizationId === ctx.organizationId) return `${key.name} (${key.prefix})`
  } else if (action.proposedByPrincipalType === "session_member") {
    const member = await prisma.member.findFirst({
      where: { id: action.proposedByPrincipalId, organizationId: ctx.organizationId },
      select: { user: { select: { name: true } } },
    })
    if (member) return member.user.name
  }
  return `SHA-256 ${createHash("sha256").update(action.proposedByPrincipalId).digest("hex")}`
}

async function captureActivationReview(ctx: { userId: string }, actionKind: string) {
  // Activation measurement is optional operator telemetry. Never make a
  // reviewed action depend on PostHog availability, and never send contract
  // identifiers, titles, source text, or organization identifiers.
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { createdAt: true },
    })
    if (!user?.createdAt) return
    const minutesSinceSignup = Math.max(0, Math.round((Date.now() - user.createdAt.getTime()) / 60_000))
    captureServerEvent(ctx.userId, "activation_action_reviewed", {
      action_kind: actionKind,
      minutes_since_signup: minutesSinceSignup,
    })
  } catch {
    // Telemetry is non-critical and must never change the action outcome.
  }
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const includeSourceText = canReadSourceText(ctx)
    const action = await findAction(params.id, ctx, includeSourceText)
    if (!action) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    const attribution = await resolveProposalAttribution(action, ctx)
    return Response.json(toActionDetail(action as never, includeSourceText, attribution), { headers: SECURE_HEADERS })
  })
}

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
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
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: SECURE_HEADERS })
    }
    const parsed = CommandSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })
    }

    const command = parsed.data
    const existing = await findAction(params.id, ctx, false)
    if (!existing) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (existing.version !== command.expectedVersion) {
      return Response.json(
        { error: "action_version_conflict", currentVersion: existing.version },
        { status: 409, headers: SECURE_HEADERS },
      )
    }
    if (!ALLOWED_FROM[command.command].has(existing.status)) {
      return Response.json(
        { error: "invalid_action_transition", from: existing.status, command: command.command },
        { status: 409, headers: SECURE_HEADERS },
      )
    }
    const approvalState = actionApprovalState(existing.approvals, existing.version)
    if ((command.command === "complete" || command.command === "start") && approvalState !== "allowed") {
      return Response.json(
        { error: approvalState === "rejected" ? "action_approval_rejected" : "action_approval_pending" },
        { status: 409, headers: SECURE_HEADERS },
      )
    }

    if (command.command === "assign") {
      const member = await prisma.member.findFirst({
        where: {
          userId: command.assigneeId,
          organizationId: ctx.organizationId,
          accessGrants: {
            some: { organizationId: ctx.organizationId, contractId: existing.contractId },
          },
        },
        select: { userId: true },
      })
      if (!member) return Response.json({ error: "action_recipient_access_required" }, { status: 422, headers: SECURE_HEADERS })
    }
    let reviewedKind: (typeof ACTION_PROPOSAL_KINDS)[number] | undefined
    let reviewedNoticeDate: string | null | undefined
    if (command.command === "validate") {
      reviewedKind = command.kind ?? existing.kind as (typeof ACTION_PROPOSAL_KINDS)[number]
      const effectiveDueDate = command.dueDate === undefined ? existing.dueDate : command.dueDate
      const effectiveCondition = command.condition === undefined ? existing.condition : command.condition
      const effectiveEvidence = command.evidenceRequired === undefined ? existing.evidenceRequired : command.evidenceRequired
      reviewedNoticeDate = reviewedKind === "RENEWAL_NOTICE"
        ? command.noticeDate === undefined ? existing.noticeDate?.toISOString() ?? null : command.noticeDate
        : null
      if (!effectiveDueDate && !effectiveCondition) {
        return Response.json({ error: "action_deadline_or_condition_required" }, { status: 422, headers: SECURE_HEADERS })
      }
      if (!effectiveEvidence) {
        return Response.json({ error: "action_evidence_requirement_required" }, { status: 422, headers: SECURE_HEADERS })
      }
      const dateIssue = actionDateSemanticIssue({
        kind: reviewedKind,
        dueDate: effectiveDueDate instanceof Date ? effectiveDueDate.toISOString() : effectiveDueDate,
        noticeDate: reviewedNoticeDate,
      })
      if (dateIssue) return Response.json({ error: dateIssue }, { status: 422, headers: SECURE_HEADERS })
    }
    if (command.command === "acknowledge" && !existing.assigneeId) {
      return Response.json({ error: "action_assignee_required" }, { status: 422, headers: SECURE_HEADERS })
    }
    if (command.command === "complete" && existing.evidenceRequired) {
      const hasRequiredEvidence = existing.evidence.some((item) => item.kind === existing.evidenceRequired && item.reviewStatus === "VERIFIED")
      if (!hasRequiredEvidence) {
        return Response.json(
          { error: "completion_verified_evidence_required", requiredKind: existing.evidenceRequired },
          { status: 422, headers: SECURE_HEADERS },
        )
      }
    }

    const now = new Date()
    const data: Record<string, unknown> = { version: { increment: 1 } }
    switch (command.command) {
      case "validate":
        Object.assign(data, {
          status: "PROPOSED",
          reviewStatus: "reviewed",
          staleAt: null,
          kind: reviewedKind,
          title: command.title,
          description: command.description,
          condition: command.condition,
          dueDate: command.dueDate === undefined ? undefined : command.dueDate ? new Date(command.dueDate) : null,
          noticeDate: reviewedNoticeDate ? new Date(reviewedNoticeDate) : null,
          evidenceRequired: command.evidenceRequired,
        })
        break
      case "assign": data.assigneeId = command.assigneeId; break
      case "acknowledge": data.status = "ACKNOWLEDGED"; data.acknowledgedAt = now; break
      case "start": data.status = "IN_PROGRESS"; data.escalationState = null; break
      case "block": data.status = "BLOCKED"; data.escalationState = command.reason; break
      case "complete": data.status = "COMPLETED"; data.completedAt = now; data.completedById = ctx.userId; break
      case "reopen": data.status = "IN_PROGRESS"; data.completedAt = null; data.completedById = null; break
      case "dismiss": data.status = "DISMISSED"; data.escalationState = command.reason; break
    }

    let currentAccessDenied = false
    let sourceStale = false
    const updated = await prisma.$transaction(async (tx) => {
      if (command.command === "validate" && existing.proposedByPrincipalType) {
        const permission = await lockCurrentAgreementPermission(tx, ctx, existing.contractId)
        if (!permission || !WRITERS.has(permission.role)) {
          currentAccessDenied = true
          return null
        }
        const currentContract = await tx.contract.findFirst({
          where: { id: existing.contractId, organizationId: ctx.organizationId },
          select: {
            extractedText: true,
            extractedSourceFileId: true,
            extractedSourceFileVersion: true,
            extractedSourceHash: true,
            files: { where: { isLatest: true }, select: { id: true, version: true }, take: 1 },
          },
        })
        if (!currentContract || !hasCurrentAgentActionSource(existing, currentContract, currentContract.files[0])) {
          sourceStale = true
          return null
        }
      }
      const result = await tx.contractAction.updateMany({
        where: {
          id: existing.id,
          organizationId: ctx.organizationId,
          version: command.expectedVersion,
          contract: agreementRelationWhere(ctx),
        },
        data: data as never,
      })
      if (result.count !== 1) return null

      if (!["validate", "assign", "reopen"].includes(command.command)) {
        await tx.approval.updateMany({
          where: {
            actionId: existing.id,
            actionVersion: command.expectedVersion,
            status: "approved",
          },
          data: { actionVersion: command.expectedVersion + 1 },
        })
      }

      await tx.activity.create({
        data: {
          contractId: existing.contractId,
          contractActionId: existing.id,
          userId: ctx.userId,
          action: ACTIVITY_BY_COMMAND[command.command],
          detail: `Action ${command.command}: ${existing.title}`,
          metadata: {
            command: command.command,
            fromStatus: existing.status,
            expectedVersion: command.expectedVersion,
            requestSource: ctx.source,
            requestId: ctx.requestId,
          },
        },
      })

      if (existing.sourceObligationId) {
        const obligationStatus = command.command === "complete"
          ? "COMPLETED"
          : command.command === "start" || command.command === "reopen"
            ? "IN_PROGRESS"
            : null
        if (obligationStatus) {
          await tx.contractObligation.updateMany({
            where: { id: existing.sourceObligationId, contractId: existing.contractId, organizationId: ctx.organizationId },
            data: {
              status: obligationStatus,
              completedAt: obligationStatus === "COMPLETED" ? now : null,
              completedById: obligationStatus === "COMPLETED" ? ctx.userId : null,
            },
          })
        }
      }

      return tx.contractAction.findFirst({
        where: { id: existing.id, organizationId: ctx.organizationId, contract: agreementRelationWhere(ctx) },
        select: actionDetailSelect(true),
      })
    })

    if (currentAccessDenied) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (sourceStale) return Response.json({ error: "action_stale_review_required" }, { status: 409, headers: SECURE_HEADERS })
    if (!updated) return Response.json({ error: "action_version_conflict" }, { status: 409, headers: SECURE_HEADERS })
    if (command.command === "validate") {
      await captureActivationReview(ctx, reviewedKind ?? existing.kind)
    }
    const attribution = await resolveProposalAttribution(updated, ctx)
    return Response.json(toActionDetail(updated as never, true, attribution), { headers: SECURE_HEADERS })
  })
}
