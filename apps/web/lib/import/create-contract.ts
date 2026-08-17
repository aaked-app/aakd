/** Transactional contract creation for import rows. */
import { createHash, randomUUID } from "node:crypto"
import type { ContractStatus, ContractType, Prisma } from "@prisma/client"
import { getWorkerPrisma } from "@/lib/db/worker-client"
import { contractExtractQueue } from "@/lib/jobs/queues"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"

const VALID_CONTRACT_TYPES = new Set<ContractType>(["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"])
const VALID_CONTRACT_STATUSES = new Set<ContractStatus>(["DRAFT", "INTERNAL_REVIEW", "PENDING_APPROVAL", "AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"])
const MAX_FILE_BYTES = 50 * 1024 * 1024

export interface ImportedContractFile {
  buffer: Buffer
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface ImportedContractData {
  title: string
  contractType?: string
  counterpartyName?: string
  counterpartyContact?: string
  value?: number
  currency?: string
  startDate?: Date
  endDate?: Date
  renewalDate?: Date
  noticePeriodDays?: number
  autoRenewal?: boolean
  notes?: string
  status?: string
  file?: ImportedContractFile
}

interface ImportedRowIdentity {
  jobId: string
  rowIndex: number
  sourceRef: string
}

interface ImportContext {
  organizationId: string
  ownerId: string
}

function stagedImportStorageKey(
  file: ImportedContractFile,
  context: ImportContext,
  row: ImportedRowIdentity,
): string {
  const digest = createHash("sha256").update(file.buffer).digest("hex")
  const attemptId = randomUUID()
  return `imports/${context.organizationId}/${row.jobId}/rows/${row.rowIndex}/${digest}/${attemptId}/${sanitizeFilename(file.filename)}`
}

async function cleanupStagedObjectIfUnreferenced(
  db: ReturnType<typeof getWorkerPrisma>,
  row: ImportedRowIdentity,
  storageKey: string,
): Promise<void> {
  try {
    const successfulRow = await db.importRow.findUnique({
      where: { jobId_rowIndex: { jobId: row.jobId, rowIndex: row.rowIndex } },
      select: { status: true, contractId: true },
    })
    if (successfulRow?.status === "success" && successfulRow.contractId) {
      const referencedFile = await db.contractFile.findFirst({
        where: { contractId: successfulRow.contractId, storageKey },
        select: { id: true },
      })
      if (referencedFile) return
    }
    await storage.delete(storageKey)
  } catch (cleanupErr) {
    // A transaction can commit even if the client loses its acknowledgement.
    // Retaining an object is safer than deleting one while its DB reference is
    // unknown; operators can reconcile a possible orphan later.
    logger.error({ err: cleanupErr, storageKey }, "[import] staged object retained after inconclusive cleanup")
  }
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\]+/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 255) || "imported"
}

function normalizeContractType(raw?: string): ContractType | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  return VALID_CONTRACT_TYPES.has(upper as ContractType) ? (upper as ContractType) : null
}

function normalizeContractStatus(raw?: string): ContractStatus {
  if (!raw) return "DRAFT"
  const upper = raw.trim().toUpperCase()
  return VALID_CONTRACT_STATUSES.has(upper as ContractStatus) ? (upper as ContractStatus) : "DRAFT"
}

function normalizeInput(data: ImportedContractData) {
  const title = data.title?.trim()
  if (!title) throw new Error("title is required")
  if (title.length > 500) throw new Error("title exceeds 500 characters")
  if (data.file && data.file.sizeBytes > MAX_FILE_BYTES) throw new Error("file_too_large")
  return {
    title,
    contractType: normalizeContractType(data.contractType),
    counterpartyName: data.counterpartyName?.trim() || null,
    counterpartyContact: data.counterpartyContact?.trim() || null,
    value: typeof data.value === "number" && Number.isFinite(data.value) ? data.value : null,
    currency: data.currency?.trim().toUpperCase() || "USD",
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    renewalDate: data.renewalDate ?? null,
    noticePeriodDays: typeof data.noticePeriodDays === "number" && data.noticePeriodDays >= 0 ? Math.trunc(data.noticePeriodDays) : null,
    autoRenewal: !!data.autoRenewal,
    notes: data.notes ?? null,
    status: normalizeContractStatus(data.status),
  }
}

/**
 * Backwards-compatible entry point for import handlers that manage their own
 * ImportRow bookkeeping. New handlers should prefer createImportedContractForRow
 * so contract creation and row state are committed atomically.
 */
export async function createImportedContract(
  data: ImportedContractData,
  context: ImportContext,
): Promise<string> {
  const db = getWorkerPrisma()
  const normalized = normalizeInput(data)
  const contract = await db.contract.create({
    data: { organizationId: context.organizationId, ...normalized, ownerId: context.ownerId },
    select: { id: true },
  })

  await db.activity.create({
    data: {
      contractId: contract.id,
      userId: null,
      actorLabel: "Import",
      action: "CREATED",
      detail: "Created via import",
    },
  })

  if (data.file) {
    const safe = sanitizeFilename(data.file.filename)
    const fileRecord = await db.contractFile.create({
      data: {
        contractId: contract.id,
        filename: safe,
        mimeType: data.file.mimeType,
        sizeBytes: data.file.sizeBytes,
        storageKey: "",
        isLatest: true,
        uploadedById: context.ownerId,
      },
      select: { id: true },
    })
    const storageKey = `contracts/${context.organizationId}/${contract.id}/files/${fileRecord.id}/${safe}`
    try {
      await storage.upload(storageKey, data.file.buffer, data.file.mimeType)
      await db.contractFile.update({ where: { id: fileRecord.id }, data: { storageKey } })
      await contractExtractQueue.add(`extract-${contract.id}`, {
        contractId: contract.id,
        fileId: fileRecord.id,
        storageKey,
      })
    } catch (err) {
      logger.error({ err, contractId: contract.id }, "[import] file processing failed after contract commit")
      throw err
    }
  }

  return contract.id
}

export async function createImportedContractForRow(
  data: ImportedContractData,
  context: ImportContext,
  row: ImportedRowIdentity,
): Promise<string> {
  const db = getWorkerPrisma()
  const existing = await db.importRow.findUnique({
    where: { jobId_rowIndex: { jobId: row.jobId, rowIndex: row.rowIndex } },
    select: { status: true, contractId: true },
  })
  if (existing?.status === "success" && existing.contractId) return existing.contractId

  const normalized = normalizeInput(data)
  const stagedFile = data.file
    ? { file: data.file, storageKey: stagedImportStorageKey(data.file, context, row) }
    : null
  let result: { contractId: string; extraction: { fileId: string; storageKey: string } | null }
  try {
    if (stagedFile) {
      await storage.upload(stagedFile.storageKey, stagedFile.file.buffer, stagedFile.file.mimeType)
    }
    result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // A delivery can be retried concurrently by BullMQ. Serialize work for
      // this exact job row even before an ImportRow exists, then re-read via
      // the upsert below. The transaction-scoped lock is released on commit
      // or rollback and prevents two contracts for one source row.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${row.jobId})::int, ${row.rowIndex}::int)`
      const claimed = await tx.importRow.upsert({
        where: { jobId_rowIndex: { jobId: row.jobId, rowIndex: row.rowIndex } },
        create: { jobId: row.jobId, rowIndex: row.rowIndex, sourceRef: row.sourceRef, status: "pending" },
        update: {},
        select: { status: true, contractId: true },
      })
      if (claimed.status === "success" && claimed.contractId) {
        return { contractId: claimed.contractId, extraction: null }
      }

      const contract = await tx.contract.create({
        data: { organizationId: context.organizationId, ...normalized, ownerId: context.ownerId },
        select: { id: true },
      })
      await tx.activity.create({
        data: { contractId: contract.id, userId: null, actorLabel: "Import", action: "CREATED", detail: "Created via import" },
      })

      let extraction: { fileId: string; storageKey: string } | null = null
      if (stagedFile) {
        const safe = sanitizeFilename(stagedFile.file.filename)
        const fileRecord = await tx.contractFile.create({
          data: {
            contractId: contract.id,
            filename: safe,
            mimeType: stagedFile.file.mimeType,
            sizeBytes: stagedFile.file.sizeBytes,
            storageKey: stagedFile.storageKey,
            isLatest: true,
            uploadedById: context.ownerId,
          },
          select: { id: true },
        })
        extraction = { fileId: fileRecord.id, storageKey: stagedFile.storageKey }
      }

      await tx.importRow.update({
        where: { jobId_rowIndex: { jobId: row.jobId, rowIndex: row.rowIndex } },
        data: { sourceRef: row.sourceRef, status: "success", contractId: contract.id, errorMessage: null },
      })
      return { contractId: contract.id, extraction }
    })
  } catch (err) {
    if (stagedFile) {
      await cleanupStagedObjectIfUnreferenced(db, row, stagedFile.storageKey)
    }
    throw err
  }

  if (stagedFile && !result.extraction) {
    await cleanupStagedObjectIfUnreferenced(db, row, stagedFile.storageKey)
  }

  if (result.extraction) {
    try {
      await contractExtractQueue.add(`extract-${result.contractId}`, {
        contractId: result.contractId,
        fileId: result.extraction.fileId,
        storageKey: result.extraction.storageKey,
      })
    } catch (err) {
      logger.error({ err, contractId: result.contractId }, "[import] extraction enqueue failed after commit")
    }
  }
  return result.contractId
}

export async function recordImportRowFailure(row: ImportedRowIdentity, errorMessage: string): Promise<void> {
  const db = getWorkerPrisma()
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.importRow.upsert({
      where: { jobId_rowIndex: { jobId: row.jobId, rowIndex: row.rowIndex } },
      create: { jobId: row.jobId, rowIndex: row.rowIndex, sourceRef: row.sourceRef, status: "failed", errorMessage },
      update: {},
      select: { status: true },
    })
    if (current.status === "success") return
    await tx.importRow.update({
      where: { jobId_rowIndex: { jobId: row.jobId, rowIndex: row.rowIndex } },
      data: { sourceRef: row.sourceRef, status: "failed", errorMessage, contractId: null },
    })
  })
}
