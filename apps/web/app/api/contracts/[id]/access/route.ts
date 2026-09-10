import { Prisma } from "@prisma/client"
import { z } from "zod"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { isTransactionConflict, withTransactionRetry } from "@/lib/db/transaction-retry"

const GrantSchema = z.object({ memberId: z.string().min(1) }).strict()

function canManageAccess(role: string, contractOwnerId: string, userId: string) {
  return contractOwnerId === userId || role === "owner" || role === "admin"
}

async function resolveManagedContract(ctx: NonNullable<Awaited<ReturnType<typeof resolveAuth>>>, contractId: string) {
  if (!(await hasAgreementAccess(prisma, ctx, contractId))) return null
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, ownerId: true, organizationId: true },
  })
  if (!contract || contract.organizationId !== ctx.organizationId) return null
  return contract
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const { id } = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401, headers: SECURE_HEADERS })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })

  return requestContext.run(ctx, async () => {
    const contract = await resolveManagedContract(ctx, id)
    if (!contract) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (!canManageAccess(ctx.role, contract.ownerId, ctx.userId)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
    }
    const grants = await prisma.contractAccessGrant.findMany({
      where: { organizationId: ctx.organizationId, contractId: id },
      select: {
        id: true,
        memberId: true,
        createdAt: true,
        member: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true, image: true } } } },
        grantedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    return Response.json({ grants }, { headers: SECURE_HEADERS })
  })
}

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const { id } = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401, headers: SECURE_HEADERS })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: SECURE_HEADERS }) }
  const parsed = GrantSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })

  return requestContext.run(ctx, async () => {
    const contract = await resolveManagedContract(ctx, id)
    if (!contract) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (!canManageAccess(ctx.role, contract.ownerId, ctx.userId)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
    }

    const result = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const current = await lockCurrentAgreementPermission(tx, ctx, id)
      if (!current) return { kind: "caller_missing" as const }
      if (!canManageAccess(current.role, current.contractOwnerId, ctx.userId)) {
        return { kind: "caller_forbidden" as const }
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Member" WHERE "id" = ${parsed.data.memberId} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`)
      const member = await tx.member.findUnique({ where: { id: parsed.data.memberId }, select: { id: true, userId: true, organizationId: true } })
      if (!member || member.organizationId !== ctx.organizationId) return { kind: "missing" as const }
      const existing = await tx.contractAccessGrant.findUnique({
        where: { contractId_memberId: { contractId: id, memberId: member.id } },
        select: { id: true, memberId: true, createdAt: true },
      })
      if (existing) return { kind: "existing" as const, grant: existing }
      const grant = await tx.contractAccessGrant.create({
        data: { organizationId: ctx.organizationId, contractId: id, memberId: member.id, grantedById: ctx.userId },
        select: { id: true, memberId: true, createdAt: true },
      })
      await tx.activity.create({
        data: {
          contractId: id,
          userId: ctx.userId,
          action: "ACCESS_GRANTED",
          metadata: { requestId: ctx.requestId, grantId: grant.id, targetMemberId: member.id },
        },
      })
      return { kind: "created" as const, grant }
    }, { isolationLevel: "Serializable" })).catch(error => {
      if (isTransactionConflict(error)) return { kind: "conflict" as const }
      throw error
    })

    if (result.kind === "conflict") return Response.json({ error: "agreement_changed_retry" }, { status: 409, headers: SECURE_HEADERS })
    if (result.kind === "caller_missing") return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    if (result.kind === "caller_forbidden") return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
    if (result.kind === "missing") return Response.json({ error: "Member not found" }, { status: 404, headers: SECURE_HEADERS })
    return Response.json(
      { grant: result.grant, alreadyGranted: result.kind === "existing" },
      { status: result.kind === "created" ? 201 : 200, headers: SECURE_HEADERS },
    )
  })
}
