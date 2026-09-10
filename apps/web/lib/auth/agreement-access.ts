import { Prisma } from "@prisma/client"
import type { RequestContext } from "@/lib/context"

export type AgreementPrincipal = Pick<RequestContext, "organizationId" | "memberId">

type PermissionMutationPrincipal = AgreementPrincipal & Pick<RequestContext, "userId">

type PermissionMutationDb = Pick<Prisma.TransactionClient,
  "$queryRaw" | "contract" | "member" | "contractAccessGrant"
>

export type CurrentAgreementPermission = {
  contractOwnerId: string
  role: string
}

export function isAgreementAccessEmergencyDenyAll(): boolean {
  const value = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL?.trim()
  if (!value) return false
  return value !== "false"
}

type GrantFindFirstDb = {
  contractAccessGrant: {
    findFirst(args: {
      where: { organizationId: string; memberId: string; contractId: string }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
}

type GrantFindManyDb = {
  contractAccessGrant: {
    findMany(args: {
      where: {
        organizationId: string
        contractId: string
        member: { userId: { in: string[] } }
      }
      select: { member: { select: { userId: true } } }
    }): Promise<Array<{ member: { userId: string } }>>
  }
}

export function agreementRelationWhere(ctx: AgreementPrincipal) {
  if (isAgreementAccessEmergencyDenyAll() || !ctx.memberId) return { AND: [{ id: "__denied__" }, { id: { not: "__denied__" } }] } satisfies Prisma.ContractWhereInput
  return {
    accessGrants: {
      some: { organizationId: ctx.organizationId, memberId: ctx.memberId },
    },
  } satisfies Prisma.ContractWhereInput
}

export function agreementAccessWhere(
  ctx: AgreementPrincipal,
  additionalWhere?: Prisma.ContractWhereInput,
): Prisma.ContractWhereInput {
  const predicates: Prisma.ContractWhereInput[] = [
    { organizationId: ctx.organizationId },
    agreementRelationWhere(ctx),
  ]
  if (additionalWhere && Object.keys(additionalWhere).length > 0) predicates.push(additionalWhere)
  return { AND: predicates }
}

export async function hasAgreementAccess(
  db: GrantFindFirstDb,
  ctx: AgreementPrincipal,
  contractId: string,
): Promise<boolean> {
  if (isAgreementAccessEmergencyDenyAll() || !ctx.memberId) return false
  const grant = await db.contractAccessGrant.findFirst({
    where: {
      organizationId: ctx.organizationId,
      memberId: ctx.memberId,
      contractId,
    },
    select: { id: true },
  })
  return Boolean(grant)
}

export async function requireAgreementAccess(
  db: GrantFindFirstDb,
  ctx: AgreementPrincipal,
  contractId: string,
): Promise<void> {
  if (!(await hasAgreementAccess(db, ctx, contractId))) {
    throw new AgreementNotFoundError()
  }
}

/**
 * Locks and re-reads the caller's contract, membership and exact grant inside
 * a permission-mutation transaction. The lock order is contract, member,
 * grant across permission mutations. Membership removal/role updates may lock
 * Member first; callers must retry the whole serializable transaction after
 * a serialization conflict so authorization observes the committed revocation.
 */
export async function lockCurrentAgreementPermission(
  tx: PermissionMutationDb,
  ctx: PermissionMutationPrincipal,
  contractId: string,
): Promise<CurrentAgreementPermission | null> {
  if (isAgreementAccessEmergencyDenyAll() || !ctx.memberId) return null

  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Contract"
    WHERE "id" = ${contractId} AND "organizationId" = ${ctx.organizationId}
    FOR UPDATE
  `)
  const contract = await tx.contract.findFirst({
    where: { id: contractId, organizationId: ctx.organizationId },
    select: { ownerId: true },
  })
  if (!contract) return null

  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Member"
    WHERE "id" = ${ctx.memberId} AND "userId" = ${ctx.userId}
      AND "organizationId" = ${ctx.organizationId}
    FOR UPDATE
  `)
  const member = await tx.member.findFirst({
    where: { id: ctx.memberId, userId: ctx.userId, organizationId: ctx.organizationId },
    select: { role: true },
  })
  if (!member) return null

  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "ContractAccessGrant"
    WHERE "contractId" = ${contractId} AND "memberId" = ${ctx.memberId}
      AND "organizationId" = ${ctx.organizationId}
    FOR UPDATE
  `)
  const grant = await tx.contractAccessGrant.findFirst({
    where: { contractId, memberId: ctx.memberId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!grant) return null

  return { contractOwnerId: contract.ownerId, role: member.role }
}

export class AgreementNotFoundError extends Error {
  constructor() {
    super("Agreement not found")
    this.name = "AgreementNotFoundError"
  }
}

const CONTRACT_ALIASES = {
  contract: Prisma.raw('"Contract"'),
  c: Prisma.raw('c'),
} as const

export type ContractSqlAlias = keyof typeof CONTRACT_ALIASES

export function agreementAccessSql(alias: ContractSqlAlias, ctx: AgreementPrincipal): Prisma.Sql {
  const contractAlias = CONTRACT_ALIASES[alias]
  if (!contractAlias) throw new Error("Unsupported contract alias")
  if (isAgreementAccessEmergencyDenyAll()) return Prisma.sql`FALSE`
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "ContractAccessGrant" AS access_grant
    WHERE access_grant."contractId" = ${contractAlias}."id"
      AND access_grant."organizationId" = ${ctx.organizationId}
      AND access_grant."memberId" = ${ctx.memberId ?? null}
  )`
}

export async function authorizedAgreementRecipientIds(
  db: GrantFindManyDb,
  organizationId: string,
  contractId: string,
  candidateUserIds: string[],
): Promise<string[]> {
  if (isAgreementAccessEmergencyDenyAll()) return []
  const uniqueCandidateIds = [...new Set(candidateUserIds)]
  if (uniqueCandidateIds.length === 0) return []
  const grants = await db.contractAccessGrant.findMany({
    where: {
      organizationId,
      contractId,
      member: { userId: { in: uniqueCandidateIds } },
    },
    select: { member: { select: { userId: true } } },
  })
  const authorized = new Set((grants ?? []).map((grant) => grant.member.userId))
  return uniqueCandidateIds.filter((userId) => authorized.has(userId))
}
