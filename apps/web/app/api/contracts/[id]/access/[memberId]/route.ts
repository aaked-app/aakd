import { Prisma } from "@prisma/client"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { isTransactionConflict, withTransactionRetry } from "@/lib/db/transaction-retry"

function canManageAccess(role: string, contractOwnerId: string, userId: string) {
  return contractOwnerId === userId || role === "owner" || role === "admin"
}

export async function DELETE(
  req: Request,
  props: { params: AsyncRouteParams<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401, headers: SECURE_HEADERS })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, id))) {
      return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    }
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, ownerId: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    }
    if (!canManageAccess(ctx.role, contract.ownerId, ctx.userId)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
    }

    const result = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const current = await lockCurrentAgreementPermission(tx, ctx, id)
      if (!current) return "caller_missing" as const
      if (!canManageAccess(current.role, current.contractOwnerId, ctx.userId)) return "caller_forbidden" as const
      const target = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, userId: true, organizationId: true } })
      if (!target || target.organizationId !== ctx.organizationId) return "missing" as const
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Member" WHERE "id" = ${memberId} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`)
      const grant = await tx.contractAccessGrant.findUnique({
        where: { contractId_memberId: { contractId: id, memberId } },
        select: { id: true },
      })
      if (!grant) return "missing" as const
      if (target.userId === current.contractOwnerId) return "owner" as const
      const grantCount = await tx.contractAccessGrant.count({ where: { contractId: id, organizationId: ctx.organizationId } })
      if (grantCount <= 1) return "last" as const
      await tx.contractAccessGrant.delete({ where: { id: grant.id } })
      await tx.activity.create({
        data: {
          contractId: id,
          userId: ctx.userId,
          action: "ACCESS_REVOKED",
          metadata: { requestId: ctx.requestId, grantId: grant.id, targetMemberId: memberId },
        },
      })
      return "deleted" as const
    }, { isolationLevel: "Serializable" })).catch(error => {
      if (isTransactionConflict(error)) return "conflict" as const
      throw error
    })

    if (result === "conflict") return Response.json({ error: "agreement_changed_retry" }, { status: 409, headers: SECURE_HEADERS })
    if (result === "caller_missing") return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (result === "caller_forbidden") return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
    if (result === "missing") return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (result === "owner") return Response.json({ error: "owner_access_required" }, { status: 409, headers: SECURE_HEADERS })
    if (result === "last") return Response.json({ error: "last_agreement_grant" }, { status: 409, headers: SECURE_HEADERS })
    return new Response(null, { status: 204, headers: SECURE_HEADERS })
  })
}
