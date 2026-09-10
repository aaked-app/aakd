import { Prisma, type PrismaClient } from "@prisma/client"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

export type BriefRecipientItem = {
  itemId: string
  actionId: string
  actionVersion: number
  currentVersion: number
  contractId: string
  status: string
}

type BriefRecipientDb = Pick<PrismaClient, "$queryRaw">

/**
 * Locks only the action represented by an explicitly addressed immutable Brief
 * item. This is the bounded recipient entitlement and intentionally does not
 * use the full-agreement Prisma safety net.
 */
export async function lockBriefRecipientItem(
  db: BriefRecipientDb,
  input: { organizationId: string; memberId: string; briefId: string; itemId: string },
): Promise<BriefRecipientItem | null> {
  if (isAgreementAccessEmergencyDenyAll()) return null
  const rows = await db.$queryRaw<BriefRecipientItem[]>(Prisma.sql`
    SELECT
      item."id" AS "itemId",
      item."actionId" AS "actionId",
      item."actionVersion" AS "actionVersion",
      action."version" AS "currentVersion",
      action."contractId" AS "contractId",
      action."status"::text AS "status"
    FROM "TeamBriefItem" AS item
    INNER JOIN "TeamBrief" AS brief ON brief."id" = item."briefId"
    INNER JOIN "ContractAction" AS action ON action."id" = item."actionId"
    WHERE brief."id" = ${input.briefId}
      AND brief."organizationId" = ${input.organizationId}
      AND brief."audienceMemberId" = ${input.memberId}
      AND item."id" = ${input.itemId}
    FOR UPDATE OF action
  `)
  return rows[0] ?? null
}

export function isCurrentBriefRecipientItem(item: BriefRecipientItem, expectedVersion: number) {
  return item.actionVersion === expectedVersion && item.currentVersion === expectedVersion
}
