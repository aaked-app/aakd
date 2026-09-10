import { ExtractionPreviewResultSchema, type ExtractionPreviewResult } from "@/lib/ai/extraction-preview-schema"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import type { ExtractionPreviewJobData } from "./queues"

interface ResultStore {
  set(key: string, value: string, mode: "PXAT", expiresAt: number): Promise<unknown>
  get(key: string): Promise<string | null>
  del(key: string): Promise<unknown>
}

export function extractionPreviewResultKey(data: Pick<ExtractionPreviewJobData, "organizationId" | "requestedByMemberId" | "jobId">): string {
  return `aakd:preview-result:${encodeURIComponent(data.organizationId)}:${encodeURIComponent(data.requestedByMemberId)}:${encodeURIComponent(data.jobId)}`
}

export async function storeExtractionPreviewResult(redis: ResultStore, data: ExtractionPreviewJobData, result: ExtractionPreviewResult): Promise<void> {
  const expiresAt = Math.min(data.expiresAt, data.createdAt + 300_000)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || isAgreementAccessEmergencyDenyAll()) {
    throw new Error("Extraction preview unavailable")
  }
  const validated = ExtractionPreviewResultSchema.safeParse(result)
  if (!validated.success) throw new Error("Invalid extraction preview result")
  // Redis enforces expiry without another job, a polling client, or a live worker.
  // Never persist the sensitive result in BullMQ's completed-job returnvalue.
  await redis.set(extractionPreviewResultKey(data), JSON.stringify(validated.data), "PXAT", expiresAt)
}

export async function readExtractionPreviewResult(redis: ResultStore, data: ExtractionPreviewJobData): Promise<ExtractionPreviewResult | null> {
  const key = extractionPreviewResultKey(data)
  if (Date.now() >= Math.min(data.expiresAt, data.createdAt + 300_000) || isAgreementAccessEmergencyDenyAll()) {
    await redis.del(key)
    return null
  }
  const raw = await redis.get(key)
  if (raw === null) return null
  try {
    const parsed = ExtractionPreviewResultSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
