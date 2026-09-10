import { Prisma } from "@prisma/client"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { lockBriefRecipientItem, isCurrentBriefRecipientItem } from "@/lib/briefs/recipient-item"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { z } from "zod"

const BlockerSchema = z.object({
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  reason: z.string().trim().min(1).max(1000),
})
const BLOCKABLE_STATUSES = new Set(["ACKNOWLEDGED", "IN_PROGRESS"])

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
  const parsed = BlockerSchema.safeParse(body)
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
      if (!BLOCKABLE_STATUSES.has(item.status)) return { kind: "invalid_transition" as const, status: item.status }

      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE "ContractAction"
        SET "status" = 'BLOCKED'::"ContractActionStatus",
            "escalationState" = ${parsed.data.reason},
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${item.actionId}
          AND "organizationId" = ${ctx.organizationId}
          AND "version" = ${parsed.data.expectedVersion}
      `)
      if (updated !== 1) return { kind: "stale" as const }

      await tx.$executeRaw(Prisma.sql`
        UPDATE "Approval"
        SET "actionVersion" = ${parsed.data.expectedVersion + 1},
            "updatedAt" = NOW()
        WHERE "actionId" = ${item.actionId}
          AND "actionVersion" = ${parsed.data.expectedVersion}
          AND "status" = 'approved'
      `)
      await tx.activity.create({
        data: {
          contractId: item.contractId,
          contractActionId: item.actionId,
          userId: ctx.userId,
          action: "ACTION_BLOCKED",
          detail: "Action blocked through Team Brief",
          metadata: {
            requestId: ctx.requestId,
            requestSource: ctx.source,
            briefId: params.id,
            itemId: params.itemId,
            fromStatus: item.status,
            expectedVersion: parsed.data.expectedVersion,
          },
        },
      })
      return { kind: "updated" as const, itemId: item.itemId, status: "BLOCKED" as const, version: parsed.data.expectedVersion + 1 }
    })

    if (result.kind === "not_found") return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (result.kind === "stale") return Response.json({ error: "brief_item_stale" }, { status: 409, headers: SECURE_HEADERS })
    if (result.kind === "invalid_transition") return Response.json({ error: "invalid_action_transition", from: result.status, command: "block" }, { status: 409, headers: SECURE_HEADERS })
    return Response.json({ itemId: result.itemId, status: result.status, version: result.version }, { headers: SECURE_HEADERS })
  })
}
