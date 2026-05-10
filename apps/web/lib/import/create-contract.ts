/**
 * Shared contract creation utility for M10 import handlers.
 *
 * The worker has no AsyncLocalStorage request context, so we use the
 * unwrapped getWorkerPrisma() client (no org-scope middleware) and set
 * organizationId explicitly. Every import path goes through this single
 * choke point so file sanitization, S3 upload, Activity logging, and
 * extract-job chaining stay consistent.
 */
import { getWorkerPrisma } from "@/lib/db/worker-client"
import { storage } from "@/lib/storage"
import { contractExtractQueue } from "@/lib/jobs/queues"
import type { ContractStatus, ContractType } from "@prisma/client"

const VALID_CONTRACT_TYPES = new Set<ContractType>([
  "NDA",
  "MSA",
  "SOW",
  "EMPLOYMENT",
  "VENDOR",
  "CUSTOMER",
  "OTHER",
])

const VALID_CONTRACT_STATUSES = new Set<ContractStatus>([
  "DRAFT",
  "INTERNAL_REVIEW",
  "PENDING_APPROVAL",
  "AWAITING_SIGNATURE",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "ARCHIVED",
])

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

const MAX_FILE_BYTES = 50 * 1024 * 1024

export function sanitizeFilename(name: string): string {
  // Strip path traversal, replace anything not safe with _, collapse runs of
  // dots so "..\..\evil" can't survive, and cap to 255 bytes.
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
  return VALID_CONTRACT_STATUSES.has(upper as ContractStatus)
    ? (upper as ContractStatus)
    : "DRAFT"
}

export async function createImportedContract(
  data: ImportedContractData,
  context: { organizationId: string; ownerId: string },
): Promise<string> {
  const db = getWorkerPrisma()

  const title = data.title?.trim()
  if (!title) {
    throw new Error("title is required")
  }
  if (title.length > 500) {
    throw new Error("title exceeds 500 characters")
  }

  const contract = await db.contract.create({
    data: {
      organizationId: context.organizationId,
      title,
      contractType: normalizeContractType(data.contractType),
      counterpartyName: data.counterpartyName?.trim() || null,
      counterpartyContact: data.counterpartyContact?.trim() || null,
      value: typeof data.value === "number" && Number.isFinite(data.value) ? data.value : null,
      currency: data.currency?.trim().toUpperCase() || "USD",
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      renewalDate: data.renewalDate ?? null,
      noticePeriodDays:
        typeof data.noticePeriodDays === "number" && data.noticePeriodDays >= 0
          ? Math.trunc(data.noticePeriodDays)
          : null,
      autoRenewal: !!data.autoRenewal,
      notes: data.notes ?? null,
      status: normalizeContractStatus(data.status),
      ownerId: context.ownerId,
    },
  })

  await db.activity.create({
    data: {
      contractId: contract.id,
      userId: null,
      actorLabel: "Import",
      action: "CREATED",
      detail: `Created via import`,
    },
  })

  if (data.file) {
    const { buffer, filename, mimeType, sizeBytes } = data.file
    if (sizeBytes > MAX_FILE_BYTES) {
      throw new Error("file_too_large")
    }
    const safe = sanitizeFilename(filename)

    // Create the ContractFile row first to get a stable id; storageKey is
    // updated immediately after S3 upload so we never end up with a dangling
    // pointer to an object that doesn't exist.
    const fileRecord = await db.contractFile.create({
      data: {
        contractId: contract.id,
        filename: safe,
        mimeType,
        sizeBytes,
        storageKey: "",
        isLatest: true,
        uploadedById: context.ownerId,
      },
    })

    const storageKey = `contracts/${context.organizationId}/${contract.id}/files/${fileRecord.id}/${safe}`
    await storage.upload(storageKey, buffer, mimeType)

    await db.contractFile.update({
      where: { id: fileRecord.id },
      data: { storageKey },
    })

    // The downstream pipeline (extract → embed → ai_extract) handles itself
    // once contract.extract is enqueued; AI features degrade gracefully when
    // no provider is configured.
    await contractExtractQueue.add(`extract-${contract.id}`, {
      contractId: contract.id,
      fileId: fileRecord.id,
      storageKey,
    })
  }

  return contract.id
}
