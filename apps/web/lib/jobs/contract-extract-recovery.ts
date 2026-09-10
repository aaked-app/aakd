import type { Job, Queue } from "bullmq"
import type { ContractEmbedJobData } from "@/lib/jobs/queues"

export type SourceBoundContractEmbedJobData = ContractEmbedJobData & {
  sourceFileId: string
  sourceFileVersion: number
  sourceHash: string
}

type EmbedQueue = Pick<Queue<ContractEmbedJobData>, "add">
type EmbedJob = Pick<Job<ContractEmbedJobData>, "getState" | "retry" | "updateData">
const DURABLE_EMBED_JOB_STATES = new Set(["active", "completed", "delayed", "prioritized", "waiting", "waiting-children"])

export function contractEmbedJobId(data: SourceBoundContractEmbedJobData) {
  return `contract-embed-${data.contractId}-${data.sourceFileId}-${data.sourceFileVersion}-${data.sourceHash}`
}

/**
 * Reconcile the durable extract-to-embed handoff after an ambiguous or failed
 * queue acknowledgement. BullMQ returns the existing job for a duplicate ID;
 * only a retained terminal failure needs an explicit retry.
 */
export async function ensureContractEmbedQueued(
  queue: EmbedQueue,
  data: SourceBoundContractEmbedJobData,
) {
  const queued = await queue.add("embed", data, { jobId: contractEmbedJobId(data) }) as EmbedJob
  const initialState = await queued.getState()
  if (DURABLE_EMBED_JOB_STATES.has(initialState)) return
  if (initialState !== "failed") throw new Error(`Embedding job did not reach a durable queue state: ${initialState}`)
  try {
    // Queue.add returns the retained job for a duplicate ID without replacing
    // its payload. Refresh only a terminal job so the retried work preserves
    // the current extraction request's review flags and exact source identity.
    await queued.updateData(data)
    await queued.retry()
  } catch (error) {
    const state = await queued.getState()
    if (!DURABLE_EMBED_JOB_STATES.has(state)) throw error
  }
}
