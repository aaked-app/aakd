import { isAgreementAccessEmergencyDenyAll, type AgreementPrincipal } from "./agreement-access"

type ImportAccessDb = {
  importRow: {
    findMany(args: {
      where: { jobId: string }
      select: { contractId: true }
      distinct: ["contractId"]
    }): Promise<Array<{ contractId: string | null }>>
  }
  contractAccessGrant: {
    findMany(args: {
      where: { organizationId: string; memberId: string; contractId: { in: string[] } }
      select: { contractId: true }
    }): Promise<Array<{ contractId: string }>>
  }
}

export async function hasImportJobAccess(
  db: ImportAccessDb,
  ctx: AgreementPrincipal & { userId: string },
  job: { id: string; createdById: string },
): Promise<boolean> {
  if (isAgreementAccessEmergencyDenyAll() || !ctx.memberId) return false
  const isCreator = job.createdById === ctx.userId
  const rows = await db.importRow.findMany({
    where: { jobId: job.id },
    select: { contractId: true },
    distinct: ["contractId"],
  })
  const contractIds = rows.flatMap((row) => row.contractId ? [row.contractId] : [])
  if (!isCreator && (rows.length === 0 || rows.some((row) => row.contractId === null))) {
    return false
  }
  if (contractIds.length === 0) return isCreator
  const grants = await db.contractAccessGrant.findMany({
    where: {
      organizationId: ctx.organizationId,
      memberId: ctx.memberId,
      contractId: { in: contractIds },
    },
    select: { contractId: true },
  })
  const grantedIds = new Set(grants.map((grant) => grant.contractId))
  return contractIds.every(contractId => grantedIds.has(contractId))
}
