import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { z } from "zod"

const WRITERS = new Set(["owner", "admin", "legal", "member"])
const EvidenceSchema = z.object({
  kind: z.string().min(1).max(80),
  note: z.string().max(4000).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
})
const ReviewSchema = z.object({
  decision: z.enum(["SELF_ATTESTED", "VERIFIED", "REJECTED"]),
  comment: z.string().max(4000).optional(),
})

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  if (!WRITERS.has(ctx.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    const action = await prisma.contractAction.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: { id: true, contractId: true, status: true },
    })
    if (!action) return Response.json({ error: "Not Found" }, { status: 404 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = EvidenceSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

    const evidence = await prisma.$transaction(async (tx) => {
      const created = await tx.contractActionEvidence.create({
        data: {
          actionId: action.id,
          kind: parsed.data.kind,
          note: parsed.data.note,
          sourceUrl: parsed.data.sourceUrl,
          recordedById: ctx.userId,
        },
      })
      await tx.activity.create({
        data: {
          contractId: action.contractId,
          contractActionId: action.id,
          userId: ctx.userId,
          action: "ACTION_EVIDENCE_ADDED",
          detail: "Completion evidence added",
          metadata: { requestSource: ctx.source, requestId: ctx.requestId, evidenceId: created.id },
        },
      })
      return created
    })

    return Response.json({
      id: evidence.id,
      kind: evidence.kind,
      note: evidence.note,
      sourceUrl: evidence.sourceUrl,
      recordedById: evidence.recordedById,
      createdAt: evidence.createdAt,
    }, { status: 201, headers: SECURE_HEADERS })
  })
}

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  if (!WRITERS.has(ctx.role)) return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })

  return requestContext.run(ctx, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: SECURE_HEADERS })
    }
    const parsed = ReviewSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })
    if (parsed.data.decision === "REJECTED" && !parsed.data.comment?.trim()) {
      return Response.json({ error: "review_comment_required" }, { status: 422, headers: SECURE_HEADERS })
    }

    const evidence = await prisma.contractActionEvidence.findFirst({
      where: { id: params.id, action: { organizationId: ctx.organizationId } },
      select: { id: true, actionId: true, reviewStatus: true, action: { select: { contractId: true, assigneeId: true } } },
    })
    if (!evidence) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (parsed.data.decision === "SELF_ATTESTED" && evidence.action.assigneeId !== ctx.userId) {
      return Response.json({ error: "assignee_self_attestation_required" }, { status: 403, headers: SECURE_HEADERS })
    }
    if (parsed.data.decision === "SELF_ATTESTED" && evidence.reviewStatus !== "SUBMITTED") {
      return Response.json({ error: "self_attestation_only_for_submitted_evidence" }, { status: 409, headers: SECURE_HEADERS })
    }

    const reviewed = await prisma.$transaction(async (tx) => {
      await tx.contractActionEvidenceReview.create({
        data: {
          evidenceId: evidence.id,
          status: parsed.data.decision,
          comment: parsed.data.comment?.trim() || null,
          reviewedById: ctx.userId,
        },
      })
      const updated = await tx.contractActionEvidence.update({
        where: { id: evidence.id },
        data: { reviewStatus: parsed.data.decision },
        select: { id: true, reviewStatus: true },
      })
      await tx.activity.create({
        data: {
          contractId: evidence.action.contractId,
          contractActionId: evidence.actionId,
          userId: ctx.userId,
          action: parsed.data.decision === "VERIFIED" ? "ACTION_EVIDENCE_VERIFIED" : parsed.data.decision === "SELF_ATTESTED" ? "ACTION_EVIDENCE_SELF_ATTESTED" : "ACTION_EVIDENCE_REJECTED",
          detail: `Completion evidence ${parsed.data.decision.toLowerCase()}`,
          metadata: { evidenceId: evidence.id, comment: parsed.data.comment?.trim() || null, requestSource: ctx.source, requestId: ctx.requestId },
        },
      })
      return updated
    })

    return Response.json(reviewed, { headers: SECURE_HEADERS })
  })
}
