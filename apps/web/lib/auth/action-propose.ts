import { Prisma } from "@prisma/client"

import { lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { hasRole } from "@/lib/auth/roles"
import type { RequestContext } from "@/lib/context"

type PermissionDb = Pick<Prisma.TransactionClient, "$queryRaw" | "apiKey" | "contract" | "member" | "contractAccessGrant">

export function canProposeActions(ctx: RequestContext): boolean {
  return Boolean(
    ctx.memberId
      && hasRole(ctx.role, "member")
      && (ctx.source === "session" || (
        ctx.scopes?.includes("read")
        && ctx.scopes.includes("action_propose")
      )),
  )
}

export function canProposeWithSourceText(ctx: RequestContext): boolean {
  return canProposeActions(ctx)
    && (ctx.source === "session" || ctx.scopes?.includes("text_read") === true)
}

export function actionProposalPrincipal(ctx: RequestContext): { type: "session_member" | "api_key"; id: string } | null {
  if (!ctx.memberId) return null
  if (ctx.source === "api_key") return ctx.apiKeyId ? { type: "api_key", id: ctx.apiKeyId } : null
  return { type: "session_member", id: ctx.memberId }
}

export async function lockCurrentActionProposalPermission(
  tx: PermissionDb,
  ctx: RequestContext,
  contractId: string,
): Promise<boolean> {
  const permission = await lockCurrentAgreementPermission(tx, ctx, contractId)
  if (!permission || !hasRole(permission.role, "member")) return false
  if (ctx.source !== "api_key") return true
  if (!ctx.apiKeyId) return false

  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "ApiKey"
    WHERE "id" = ${ctx.apiKeyId} AND "organizationId" = ${ctx.organizationId}
    FOR UPDATE
  `)
  const key = await tx.apiKey.findFirst({
    where: {
      id: ctx.apiKeyId,
      organizationId: ctx.organizationId,
      createdById: ctx.userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      AND: [
        { scopes: { has: "read" } },
        { scopes: { has: "action_propose" } },
      ],
    },
    select: { id: true },
  })
  return Boolean(key)
}
