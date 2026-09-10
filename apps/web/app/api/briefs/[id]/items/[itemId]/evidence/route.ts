import { SECURE_HEADERS } from "@/lib/api-headers"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { lockBriefRecipientItem, isCurrentBriefRecipientItem } from "@/lib/briefs/recipient-item"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { z } from "zod"

const EvidenceSchema = z.object({
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  kind: z.string().trim().min(1).max(80),
  note: z.string().trim().max(4000).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
})

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string; itemId: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  if (!ctx.memberId) return Response.json({ error: "current_membership_required" }, { status: 403, headers: SECURE_HEADERS })

  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: SECURE_HEADERS }) }
  const parsed = EvidenceSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })

  return requestContext.run(ctx, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const item = await lockBriefRecipientItem(tx, {
        organizationId: ctx.organizationId,
        memberId: ctx.memberId!,
        briefId: params.id,
        itemId: params.itemId,
      })
      if (!item) return { kind: "not_found" as const }
      if (!isCurrentBriefRecipientItem(item, parsed.data.expectedVersion)) return { kind: "stale" as const }

      const evidence = await tx.contractActionEvidence.create({
        data: {
          actionId: item.actionId,
          kind: parsed.data.kind,
          note: parsed.data.note || null,
          sourceUrl: parsed.data.sourceUrl,
          recordedById: ctx.userId,
        },
        select: { id: true, kind: true, note: true, sourceUrl: true, reviewStatus: true, createdAt: true },
      })
      await tx.activity.create({
        data: {
          contractId: item.contractId,
          contractActionId: item.actionId,
          userId: ctx.userId,
          action: "ACTION_EVIDENCE_ADDED",
          detail: "Completion evidence added through Team Brief",
          metadata: { requestId: ctx.requestId, requestSource: ctx.source, briefId: params.id, itemId: params.itemId, evidenceId: evidence.id },
        },
      })
      return { kind: "created" as const, evidence }
    })

    if (result.kind === "not_found") return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (result.kind === "stale") return Response.json({ error: "brief_item_stale" }, { status: 409, headers: SECURE_HEADERS })
    return Response.json(result.evidence, { status: 201, headers: SECURE_HEADERS })
  })
}
