import mammoth from "mammoth"
import { z } from "zod"
import { getWorkerPrisma } from "@/lib/db/worker-client"
import { storage } from "@/lib/storage"
import { parsePdf } from "@/lib/pdf"
import { sanitizeZipBuffer } from "@/lib/import/zip-safety"
import { extractDeterministicRenewalTerms } from "@/lib/ai/local-extract"
import { runExtractionPreviewAi } from "@/lib/ai/extraction-preview"
import type { ExtractionPreviewResult } from "@/lib/ai/extraction-preview-schema"
import { extractionPreviewStorageKey, type ExtractionPreviewJobData } from "@/lib/jobs/queues"
import { captureServerEvent } from "@/lib/posthog-server"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_TEXT_CHARS = 8_000

const JobDataSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().min(1).max(200),
  requestedByUserId: z.string().min(1).max(200),
  requestedByMemberId: z.string().min(1).max(200),
  storageKey: z.string().min(1).max(1000),
  fileType: z.enum(["pdf", "docx"]),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
})

function hasPdfMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from("%PDF"))
}

function hasDocxMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && buffer.includes(Buffer.from("word/"))
}

async function assertRequesterIsCurrent(data: ExtractionPreviewJobData): Promise<void> {
  const member = await getWorkerPrisma().member.findFirst({
    where: { id: data.requestedByMemberId, userId: data.requestedByUserId, organizationId: data.organizationId },
    select: { id: true },
  })
  if (!member) throw new Error("Extraction preview requester is no longer authorized")
}

async function deleteSourceWithRetries(storageKey: string): Promise<void> {
  let finalError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await storage.delete(storageKey)
      return
    } catch (error) {
      finalError = error
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
  throw new Error("Extraction preview source cleanup failed", { cause: finalError })
}

async function extractText(buffer: Buffer, fileType: "pdf" | "docx"): Promise<string> {
  if (fileType === "pdf") {
    if (!hasPdfMagic(buffer)) throw new Error("Stored preview file type mismatch")
    return (await parsePdf(buffer)).text
  }
  if (!hasDocxMagic(buffer)) throw new Error("Stored preview file type mismatch")
  const sanitized = Buffer.from(sanitizeZipBuffer(buffer))
  return (await mammoth.extractRawText({ buffer: sanitized })).value
}

export async function processExtractionPreview(rawData: ExtractionPreviewJobData): Promise<ExtractionPreviewResult> {
  const parsed = JobDataSchema.safeParse(rawData)
  if (!parsed.success) throw new Error("Invalid extraction preview job")
  const data = parsed.data
  const expectedStorageKey = extractionPreviewStorageKey(data.organizationId, data.requestedByMemberId, data.jobId)
  if (data.storageKey !== expectedStorageKey) throw new Error("Invalid extraction preview storage key")

  try {
    if (isAgreementAccessEmergencyDenyAll()) throw new Error("Agreement processing disabled by emergency policy")
    await assertRequesterIsCurrent(data)
    if (Date.now() >= data.expiresAt) throw new Error("Extraction preview expired")
    const stored = await storage.getObject(data.storageKey, MAX_FILE_BYTES)
    if (stored.body.byteLength > MAX_FILE_BYTES) throw new Error("Stored preview file exceeds limit")
    const buffer = Buffer.from(stored.body.buffer, stored.body.byteOffset, stored.body.byteLength)

    let text: string
    try {
      text = (await extractText(buffer, data.fileType)).slice(0, MAX_TEXT_CHARS)
    } catch {
      return { error: "text_extraction_failed", partial: true, confidence: {} }
    }
    if (!text.trim()) return { error: "text_extraction_failed", partial: true, confidence: {} }
    if (Date.now() >= data.expiresAt) throw new Error("Extraction preview expired")

    await assertRequesterIsCurrent(data)
    let result: ExtractionPreviewResult
    try {
      result = await runExtractionPreviewAi(text, data.organizationId)
    } catch {
      result = { error: "ai_unavailable", partial: true, confidence: {} }
    }

    const renewal = extractDeterministicRenewalTerms(text)
    if (renewal.autoRenewal) result.autoRenewal = renewal.autoRenewal.value as boolean
    else if (renewal.autoRenewalAmbiguous) delete result.autoRenewal
    if (renewal.noticePeriodDays) result.noticePeriodDays = renewal.noticePeriodDays.value as number
    if (!result.error) {
      captureServerEvent(data.requestedByUserId, "ai_extraction_run", { organizationId: data.organizationId })
    }
    return result
  } finally {
    await deleteSourceWithRetries(data.storageKey)
  }
}
