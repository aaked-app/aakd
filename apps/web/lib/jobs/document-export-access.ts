import { createHash } from "node:crypto"
import { Prisma } from "@prisma/client"
import { hasAgreementAccess, isAgreementAccessEmergencyDenyAll, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import type { RequestContext } from "@/lib/context"

export const MAX_DOCUMENT_EXPORT_CONTENT_BYTES = 5 * 1024 * 1024

export type DocumentExportTransactionDb = Pick<Prisma.TransactionClient,
  "$queryRaw" | "activity" | "contract" | "contractDocument" | "member" | "contractAccessGrant"
>
export type DocumentExportContent = Prisma.JsonValue

export type BoundDocumentExport = {
  documentId: string
  documentVersion: number
  documentContentHash: string
}

export class DocumentExportAuthorizationError extends Error {
  constructor() {
    super("Document export is not authorized")
    this.name = "DocumentExportAuthorizationError"
  }
}

function canonicalJson(value: Prisma.JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key] as Prisma.JsonValue)}`
  )).join(",")}}`
}

export function documentContentHash(content: Prisma.JsonValue): string {
  return createHash("sha256").update(canonicalJson(content)).digest("hex")
}

export type DocumentExportArtifactBinding = {
  jobId: string
  organizationId: string
  contractId: string
  requestedByMemberId: string
  requestedById: string
  documentId: string
  documentVersion: number
  documentContentHash: string
  format: "docx" | "pdf"
  expiresAt: Date
}

function hasCompleteDocumentExportBinding(data: DocumentExportArtifactBinding): boolean {
  return Boolean(data.organizationId
    && data.requestedByMemberId
    && data.documentId
    && Number.isSafeInteger(data.documentVersion)
    && /^[a-f0-9]{64}$/.test(data.documentContentHash ?? ""))
}

async function hasCurrentDocumentExportPrincipal(
  db: DocumentExportTransactionDb,
  data: DocumentExportArtifactBinding,
  lock: boolean,
): Promise<boolean> {
  if (isAgreementAccessEmergencyDenyAll() || !hasCompleteDocumentExportBinding(data)) return false
  const principal = {
    organizationId: data.organizationId as string,
    memberId: data.requestedByMemberId as string,
    userId: data.requestedById,
  }
  if (lock) return Boolean(await lockCurrentAgreementPermission(db, principal, data.contractId))
  const member = await db.member.findFirst({
    where: {
      id: principal.memberId,
      userId: principal.userId,
      organizationId: principal.organizationId,
    },
    select: { id: true },
  })
  if (!member || !await hasAgreementAccess(db, principal, data.contractId)) return false
  return Boolean(await db.contract.findFirst({
    where: { id: data.contractId, organizationId: principal.organizationId },
    select: { id: true },
  }))
}

function contentWithinLimit(content: Prisma.JsonValue): boolean {
  return Buffer.byteLength(canonicalJson(content), "utf8") <= MAX_DOCUMENT_EXPORT_CONTENT_BYTES
}

export async function bindDocumentExport(
  tx: DocumentExportTransactionDb,
  ctx: Pick<RequestContext, "organizationId" | "memberId" | "userId">,
  contractId: string,
): Promise<BoundDocumentExport | null> {
  const permission = await lockCurrentAgreementPermission(tx, ctx, contractId)
  if (!permission) throw new DocumentExportAuthorizationError()
  const document = await tx.contractDocument.findUnique({
    where: { contractId },
    select: { id: true, content: true, version: true },
  })
  if (!document || !contentWithinLimit(document.content)) return null
  return {
    documentId: document.id,
    documentVersion: document.version,
    documentContentHash: documentContentHash(document.content),
  }
}

export async function authorizedDocumentExportSource(
  db: DocumentExportTransactionDb,
  data: DocumentExportArtifactBinding,
  lock: boolean,
): Promise<Prisma.JsonValue | null> {
  if (!await hasCurrentDocumentExportPrincipal(db, data, lock)) return null

  const document = await db.contractDocument.findUnique({
    where: { contractId: data.contractId },
    select: { id: true, content: true, version: true },
  })
  if (!document
    || document.id !== data.documentId
    || document.version !== data.documentVersion
    || !contentWithinLimit(document.content)
    || documentContentHash(document.content) !== data.documentContentHash) return null
  return document.content
}

export async function authorizedDocumentExportBinding(
  db: DocumentExportTransactionDb,
  data: DocumentExportArtifactBinding,
): Promise<boolean> {
  if (!await hasCurrentDocumentExportPrincipal(db, data, false)) return false
  const document = await db.contractDocument.findUnique({
    where: { contractId: data.contractId },
    select: { id: true, version: true },
  })
  return Boolean(document
    && document.id === data.documentId
    && document.version === data.documentVersion)
}

export function documentExportAttemptStorageKey(data: DocumentExportArtifactBinding, attemptId: string): string {
  return `exports/${encodeURIComponent(data.organizationId)}/${encodeURIComponent(data.contractId)}/${encodeURIComponent(data.jobId)}/${encodeURIComponent(attemptId)}.${data.format}`
}

export function isOwnedDocumentExportStorageKey(key: string, data: Pick<DocumentExportArtifactBinding, "organizationId" | "contractId" | "jobId">): boolean {
  const prefix = `exports/${encodeURIComponent(data.organizationId)}/${encodeURIComponent(data.contractId)}/${encodeURIComponent(data.jobId)}/`
  return key.startsWith(prefix) && key.length > prefix.length && !key.slice(prefix.length).includes("/")
}

export function documentExportDownloadPath(contractId: string, jobId: string): string {
  return `/api/contracts/${encodeURIComponent(contractId)}/document/export/${encodeURIComponent(jobId)}?download=1`
}
