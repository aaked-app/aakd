import { Worker, type Job } from "bullmq"

import {
  interactiveAiPayloadSchema,
  interactiveAiResponseSchema,
  interactiveAiResultKey,
  processInteractiveAiRequest,
  type InteractiveAiJobData,
  type InteractiveAiProcessorDependencies,
} from "@/lib/jobs/interactive-ai"
import { interactiveAiProcessorDependencies } from "@/lib/jobs/interactive-ai-executor"
import { logger } from "@/lib/logger"

interface InteractiveAiRedis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: "PXAT", expiresAt: number): Promise<unknown>
  del(key: string): Promise<unknown>
}

export async function processInteractiveAiJob(
  job: Pick<Job<InteractiveAiJobData>, "data">,
  client: InteractiveAiRedis,
  dependencies: InteractiveAiProcessorDependencies = interactiveAiProcessorDependencies,
): Promise<{ ready: true }> {
  try {
    const response = await processInteractiveAiRequest(
      job.data,
      async (data) => {
        const raw = await client.get(data.payloadKey)
        if (raw === null) throw new Error("Interactive AI payload unavailable")
        return interactiveAiPayloadSchema.parse(JSON.parse(raw))
      },
      dependencies,
    )
    await client.set(
      interactiveAiResultKey(job.data),
      JSON.stringify(interactiveAiResponseSchema.parse(response)),
      "PXAT",
      job.data.expiresAt,
    )
    return { ready: true }
  } finally {
    await client.del(job.data.payloadKey).catch(() => {})
  }
}

export function createInteractiveAiWorker(connection: { url: string }) {
  let worker: Worker<InteractiveAiJobData, { ready: true }>
  worker = new Worker<InteractiveAiJobData, { ready: true }>(
    "ai.request",
    async (job: Job<InteractiveAiJobData>): Promise<{ ready: true }> => {
      try {
        return await processInteractiveAiJob(job, await worker.client)
      } catch {
        throw new Error("Interactive AI request failed")
      }
    },
    {
      connection,
      concurrency: 2,
      removeOnComplete: { age: 300, count: 500 },
      removeOnFail: { age: 300, count: 500 },
    },
  )
  worker.on("completed", (job: Job<InteractiveAiJobData>) => logger.info({ jobId: job.id }, "[ai.request] Job completed"))
  worker.on("failed", (job: Job<InteractiveAiJobData> | undefined, error: Error) => logger.error({ jobId: job?.id, errorType: error.name }, "[ai.request] Job failed"))
  return worker
}
