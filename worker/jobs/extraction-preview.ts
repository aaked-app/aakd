import { Worker, type Job } from "bullmq"
import { processExtractionPreview } from "@/lib/jobs/extraction-preview-processor"
import { storeExtractionPreviewResult } from "@/lib/jobs/extraction-preview-result"
import type { ExtractionPreviewJobData } from "@/lib/jobs/queues"
import { logger } from "@/lib/logger"

export function createExtractionPreviewWorker(connection: { url: string }) {
  const worker = new Worker<ExtractionPreviewJobData, { ready: true }>(
    "contract.extraction_preview",
    async (job: Job<ExtractionPreviewJobData>) => {
      try {
        const result = await processExtractionPreview(job.data)
        await storeExtractionPreviewResult(await worker.client, job.data, result)
        return { ready: true }
      } catch {
        // Redis/parse/provider exceptions may contain private URLs or content.
        throw new Error("Extraction preview failed")
      }
    },
    { connection, concurrency: 1, removeOnComplete: { age: 300, count: 200 }, removeOnFail: { age: 300, count: 500 } },
  )
  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "[extract-preview] Job completed")
  })
  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, errorType: error.name }, "[extract-preview] Job failed")
  })
  return worker
}
