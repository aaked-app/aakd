import { QueueEvents } from "bullmq"

import type { RequestContext } from "@/lib/context"
import { getInteractiveAiQueue } from "@/lib/jobs/queues"
import {
  interactiveAiPayloadKey,
  interactiveAiPayloadSchema,
  interactiveAiJobDataSchema,
  interactiveAiResponseSchema,
  interactiveAiResultKey,
  newInteractiveAiJobData,
  type InteractiveAiJobData,
  type InteractiveAiOperation,
  type InteractiveAiPayload,
  type InteractiveAiResponse,
  authorizeInteractiveAiResponse,
} from "@/lib/jobs/interactive-ai"
import { interactiveAiProcessorDependencies } from "@/lib/jobs/interactive-ai-executor"

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"
const connection = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
  ...(REDIS_URL.startsWith("rediss://") ? { tls: {} } : {}),
}

let queueEvents: QueueEvents | null = null

function getInteractiveAiQueueEvents(): QueueEvents {
  return (queueEvents ??= new QueueEvents("ai.request", { connection }))
}

export type InteractiveAiSubmission =
  | { state: "completed"; jobId: string; response: InteractiveAiResponse }
  | { state: "pending"; jobId: string }
  | { state: "failed"; jobId: string }

function principalMatches(data: InteractiveAiJobData, ctx: RequestContext): boolean {
  return data.organizationId === ctx.organizationId
    && data.requestedByUserId === ctx.userId
    && data.requestedByMemberId === ctx.memberId
    && data.source === ctx.source
    && data.apiKeyId === (ctx.apiKeyId ?? null)
}

async function readResult(data: InteractiveAiJobData): Promise<InteractiveAiResponse | null> {
  const queue = getInteractiveAiQueue()
  const client = await queue.client
  const resultKey = interactiveAiResultKey(data)
  const raw = await client.get(resultKey)
  if (raw === null) return null
  try {
    const parsed = interactiveAiResponseSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const authorized = await authorizeInteractiveAiResponse(data, parsed.data, interactiveAiProcessorDependencies)
    const sanitized = JSON.stringify(authorized)
    if (sanitized !== JSON.stringify(parsed.data)) await client.set(resultKey, sanitized, "KEEPTTL")
    return authorized
  } catch {
    await client.del(resultKey).catch(() => {})
    return null
  }
}

export async function enqueueInteractiveAiRequest(
  ctx: RequestContext,
  operation: InteractiveAiOperation,
  contractId: string | null,
  payload: InteractiveAiPayload,
  waitMs: 12_000 | 35_000,
): Promise<InteractiveAiSubmission> {
  if (!ctx.memberId) throw new Error("Current membership required")
  if (payload.operation !== operation) throw new Error("Interactive AI operation mismatch")
  const validatedPayload = interactiveAiPayloadSchema.parse(payload)
  const data = newInteractiveAiJobData({
    operation,
    organizationId: ctx.organizationId,
    requestedByUserId: ctx.userId,
    requestedByMemberId: ctx.memberId,
    source: ctx.source,
    apiKeyId: ctx.apiKeyId ?? null,
    contractId,
  })
  const queue = getInteractiveAiQueue()
  const client = await queue.client
  await client.set(interactiveAiPayloadKey(data), JSON.stringify(validatedPayload), "PXAT", data.expiresAt)
  let job
  try {
    job = await queue.add(operation, data, { jobId: data.jobId })
  } catch (error) {
    await client.del(interactiveAiPayloadKey(data))
    throw error
  }
  try {
    await job.waitUntilFinished(getInteractiveAiQueueEvents(), waitMs)
  } catch {
    const response = await readResult(data)
    if (response) return { state: "completed", jobId: data.jobId, response }
    const state = await job.getState().catch(() => "unknown")
    if (state === "waiting" || state === "active" || state === "delayed" || state === "prioritized") {
      return { state: "pending", jobId: data.jobId }
    }
    return { state: "failed", jobId: data.jobId }
  }
  const response = await readResult(data)
  return response
    ? { state: "completed", jobId: data.jobId, response }
    : { state: "failed", jobId: data.jobId }
}

export async function readInteractiveAiRequest(
  ctx: RequestContext,
  jobId: string,
): Promise<InteractiveAiSubmission | null> {
  const queue = getInteractiveAiQueue()
  const job = await queue.getJob(jobId)
  if (!job) return null
  const parsed = interactiveAiJobDataSchemaSafe(job.data)
  if (!parsed || !principalMatches(parsed, ctx)) return null
  const response = await readResult(parsed)
  if (response) return { state: "completed", jobId, response }
  const state = await job.getState().catch(() => "unknown")
  if (state === "waiting" || state === "active" || state === "delayed" || state === "prioritized") {
    return { state: "pending", jobId }
  }
  return { state: "failed", jobId }
}

export async function waitForInteractiveAiRequest(
  ctx: RequestContext,
  jobId: string,
): Promise<InteractiveAiSubmission | null> {
  const queue = getInteractiveAiQueue()
  const job = await queue.getJob(jobId)
  if (!job) return null
  const parsed = interactiveAiJobDataSchemaSafe(job.data)
  if (!parsed || !principalMatches(parsed, ctx)) return null
  const initial = await readResult(parsed)
  if (initial) return { state: "completed", jobId, response: initial }
  const remainingMs = Math.min(parsed.expiresAt - Date.now(), 35_000)
  if (remainingMs <= 0) return { state: "failed", jobId }
  try {
    await job.waitUntilFinished(getInteractiveAiQueueEvents(), remainingMs)
  } catch {
    const response = await readResult(parsed)
    if (response) return { state: "completed", jobId, response }
    const state = await job.getState().catch(() => "unknown")
    if (state === "waiting" || state === "active" || state === "delayed" || state === "prioritized") {
      return { state: "pending", jobId }
    }
    return { state: "failed", jobId }
  }
  const response = await readResult(parsed)
  return response ? { state: "completed", jobId, response } : { state: "failed", jobId }
}

function interactiveAiJobDataSchemaSafe(value: unknown): InteractiveAiJobData | null {
  const parsed = interactiveAiJobDataSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export async function closeInteractiveAiClient(): Promise<void> {
  await queueEvents?.close()
  queueEvents = null
}
