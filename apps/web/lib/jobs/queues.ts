import { Queue } from "bullmq"

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
}

// ─── Job data types ────────────────────────────────────────────────────────────

export interface ContractExtractJobData {
  contractId: string
  fileId: string
  storageKey: string
}

export interface ContractAiExtractJobData {
  contractId: string
  extractedText: string
}

export interface AlertsCheckJobData {
  triggeredAt: string
}

export interface ContractEmbedJobData {
  contractId: string
  extractedText: string
}

export interface SigningSyncJobData {
  triggeredAt: string
  contractId?: string
  submissionId?: string
}

// Email send queue — covers any transactional email triggered from a route
// or other worker so the API/job that produces the event isn't blocked on
// SMTP latency.
export type EmailJobData =
  | { kind: "alert"; alertId: string }
  | {
      kind: "approval_request"
      to: string
      assigneeName: string
      requesterName: string
      contractTitle: string
      message?: string
    }

// ─── Lazy queue singletons ────────────────────────────────────────────────────
// Queue instances are created on first use (not at module load time) so that
// Next.js's static-generation phase during `next build` does not attempt a
// Redis connection. Callers should use these getters, not the raw constructors.

let _contractExtractQueue: Queue<ContractExtractJobData> | null = null
let _contractAiExtractQueue: Queue<ContractAiExtractJobData> | null = null
let _contractEmbedQueue: Queue<ContractEmbedJobData> | null = null
let _alertsCheckQueue: Queue<AlertsCheckJobData> | null = null
let _signingSyncQueue: Queue<SigningSyncJobData> | null = null
let _emailQueue: Queue<EmailJobData> | null = null

export function getContractExtractQueue(): Queue<ContractExtractJobData> {
  return (_contractExtractQueue ??= new Queue<ContractExtractJobData>("contract.extract", { connection }))
}

export function getContractAiExtractQueue(): Queue<ContractAiExtractJobData> {
  return (_contractAiExtractQueue ??= new Queue<ContractAiExtractJobData>("contract.ai_extract", { connection }))
}

export function getContractEmbedQueue(): Queue<ContractEmbedJobData> {
  return (_contractEmbedQueue ??= new Queue<ContractEmbedJobData>("contract.embed", { connection }))
}

export function getAlertsCheckQueue(): Queue<AlertsCheckJobData> {
  return (_alertsCheckQueue ??= new Queue<AlertsCheckJobData>("alerts.check", { connection }))
}

export function getSigningSyncQueue(): Queue<SigningSyncJobData> {
  return (_signingSyncQueue ??= new Queue<SigningSyncJobData>("signing.sync", { connection }))
}

export function getEmailQueue(): Queue<EmailJobData> {
  return (_emailQueue ??= new Queue<EmailJobData>("email.send", { connection }))
}

// ─── Legacy named exports (kept for backward compat) ─────────────────────────
// These are getters so the Queue is still created lazily. We proxy both `add`
// (used by API routes / worker handlers) and `close` (used by graceful shutdown).
export const contractExtractQueue = {
  add: (...a: Parameters<Queue<ContractExtractJobData>["add"]>) => getContractExtractQueue().add(...a),
  close: () => _contractExtractQueue?.close() ?? Promise.resolve(),
}
export const contractAiExtractQueue = {
  add: (...a: Parameters<Queue<ContractAiExtractJobData>["add"]>) => getContractAiExtractQueue().add(...a),
  close: () => _contractAiExtractQueue?.close() ?? Promise.resolve(),
}
export const contractEmbedQueue = {
  add: (...a: Parameters<Queue<ContractEmbedJobData>["add"]>) => getContractEmbedQueue().add(...a),
  close: () => _contractEmbedQueue?.close() ?? Promise.resolve(),
}
export const alertsCheckQueue = {
  add: (...a: Parameters<Queue<AlertsCheckJobData>["add"]>) => getAlertsCheckQueue().add(...a),
  close: () => _alertsCheckQueue?.close() ?? Promise.resolve(),
}
export const signingSyncQueue = {
  add: (...a: Parameters<Queue<SigningSyncJobData>["add"]>) => getSigningSyncQueue().add(...a),
  close: () => _signingSyncQueue?.close() ?? Promise.resolve(),
}
export const emailQueue = {
  add: (...a: Parameters<Queue<EmailJobData>["add"]>) => getEmailQueue().add(...a),
  close: () => _emailQueue?.close() ?? Promise.resolve(),
}
