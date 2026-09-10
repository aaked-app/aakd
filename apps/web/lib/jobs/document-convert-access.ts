import { Prisma } from "@prisma/client"
import { hasAgreementAccess, isAgreementAccessEmergencyDenyAll, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import type { DocumentConvertJobData } from "@/lib/jobs/queues"
import { hasRole } from "@/lib/auth/roles"

type ConversionDb = Pick<Prisma.TransactionClient, "$queryRaw" | "contract" | "contractFile" | "contractDocument" | "member" | "contractAccessGrant" | "apiKey">
const READ_ONLY = new Set(["AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"])

/** Called before reading bytes, then again under the parent lock before save. */
export async function documentConversionReady(db: ConversionDb, data: DocumentConvertJobData, lock = false): Promise<boolean> {
  if (isAgreementAccessEmergencyDenyAll() || !data.organizationId || !data.requestedByMemberId) return false
  const principal = { organizationId: data.organizationId, memberId: data.requestedByMemberId, userId: data.requestedById }
  const permission = lock
    ? await lockCurrentAgreementPermission(db, principal, data.contractId)
    : await db.member.findFirst({
      where: { id: data.requestedByMemberId, userId: data.requestedById, organizationId: data.organizationId },
      select: { role: true },
    })
  if (!permission || !hasRole(permission.role, "member")) return false
  if (!lock && !await hasAgreementAccess(db, principal, data.contractId)) return false
  if (data.apiKeyId) {
    if (lock) await db.$queryRaw(Prisma.sql`SELECT "id" FROM "ApiKey" WHERE "id" = ${data.apiKeyId} FOR UPDATE`)
    const key = await db.apiKey.findFirst({
      where: { id: data.apiKeyId, organizationId: data.organizationId, createdById: data.requestedById },
      select: { revokedAt: true, expiresAt: true, scopes: true },
    })
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date()) || !key.scopes.includes("write")) return false
  }
  const contract = await db.contract.findFirst({
    where: { id: data.contractId, organizationId: data.organizationId }, select: { status: true },
  })
  if (!contract || contract.status === "ARCHIVED") return false
  const document = await db.contractDocument.findUnique({ where: { contractId: data.contractId }, select: { version: true } })
  if (data.deleteSource) {
    // An explicit editor import can replace only the version selected when it
    // was requested, never an edit made while conversion was queued/running.
    return !READ_ONLY.has(contract.status)
      && data.expectedDocumentVersion !== undefined
      && (document?.version ?? null) === data.expectedDocumentVersion
      && data.storageKey.startsWith(`tmp/docx-imports/${data.contractId}/`)
  }
  if (document || !data.sourceFileId) return false
  return Boolean(await db.contractFile.findFirst({
    where: { id: data.sourceFileId, contractId: data.contractId, storageKey: data.storageKey, isLatest: true },
    select: { id: true },
  }))
}
