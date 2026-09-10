import { MAX_CONTRACT_FILE_BYTES } from "@/lib/contracts/file-validation"

export const DEFAULT_DOCUMENT_EXPORT_RETENTION_SECONDS = 86_400
export const DOCUMENT_EXPORT_CLEANUP_CRON = "*/5 * * * *"
export const DOCUMENT_EXPORT_CLEANUP_BATCH_SIZE = 100
export const DOCUMENT_EXPORT_CLEANUP_LEASE_SECONDS = 300
export const DOCUMENT_EXPORT_CONTENT_LIMIT_BYTES = MAX_CONTRACT_FILE_BYTES

export function getDocumentExportRetentionSeconds(value = process.env.DOCUMENT_EXPORT_RETENTION_SECONDS): number {
  if (value === undefined || value === "") return DEFAULT_DOCUMENT_EXPORT_RETENTION_SECONDS
  if (!/^\d+$/.test(value)) throw new Error("DOCUMENT_EXPORT_RETENTION_SECONDS must be a positive integer")
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("DOCUMENT_EXPORT_RETENTION_SECONDS must be a positive safe integer")
  }
  return parsed
}

export function documentExportExpiresAt(createdAt: Date, retentionSeconds = getDocumentExportRetentionSeconds()): Date {
  const expiresAt = new Date(createdAt.getTime() + retentionSeconds * 1_000)
  if (!Number.isFinite(expiresAt.getTime())) throw new Error("Document export retention exceeds the supported date range")
  return expiresAt
}

export function assertDocumentExportOutputSize(buffer: Buffer): void {
  if (buffer.byteLength > DOCUMENT_EXPORT_CONTENT_LIMIT_BYTES) {
    throw new Error("Document export output exceeds the size limit")
  }
}

export async function registerRequiredDocumentExportCleanup(queue: {
  add(name: string, data: { triggeredAt: string }, options: { repeat: { pattern: string }; jobId: string }): Promise<unknown>
}, now = new Date()): Promise<void> {
  await queue.add(
    "retention-sweep",
    { triggeredAt: now.toISOString() },
    { repeat: { pattern: DOCUMENT_EXPORT_CLEANUP_CRON }, jobId: "document-export-retention" },
  )
}
