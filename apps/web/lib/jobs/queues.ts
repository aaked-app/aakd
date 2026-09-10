import { Queue } from "bullmq"
import type { InteractiveAiJobData } from "@/lib/jobs/interactive-ai"

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"
const connection = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
  ...(REDIS_URL.startsWith("rediss://") ? { tls: {} } : {}),
}

// ─── Job data types ────────────────────────────────────────────────────────────

export interface ContractExtractJobData {
  contractId: string
  organizationId?: string
  fileId: string
  storageKey: string
  /** Initial uploads already contain user-reviewed metadata from the fast review form. */
  preserveUserFields?: boolean
  /** The create flow already ran the authoritative preview extractor. */
  skipAiExtraction?: boolean
}

export interface ContractAiExtractJobData {
  contractId: string
  organizationId?: string
  extractedText: string
  /** Do not create AI suggestions for metadata the user supplied during upload. */
  preserveUserFields?: boolean
}

export interface AlertsCheckJobData {
  triggeredAt: string
}

export interface ObligationsCheckJobData {
  triggeredAt: string
}

export interface SalesforcePollJobData {
  triggeredAt: string
}

// ─── M10: Import processing ──────────────────────────────────────────────────

export interface ImportProcessJobData {
  importJobId: string
  organizationId: string
  createdById: string
}

export interface ContractEmbedJobData {
  contractId: string
  organizationId?: string
  extractedText: string
  /** Immutable source identity for normal extraction jobs. Operator reindex jobs revalidate their actor separately. */
  sourceFileId?: string
  sourceFileVersion?: number
  sourceHash?: string
  preserveUserFields?: boolean
  skipAiExtraction?: boolean
  /** Operator recovery only: rebuild vectors without regenerating reviewed facts. */
  indexOnly?: boolean
  /** Exact current principal required for every provider call in an index-only job. */
  requestedByUserId?: string
  requestedByMemberId?: string
}

export interface SigningSyncJobData {
  triggeredAt: string
  contractId?: string
  submissionId?: string
  /** Exact DocuSeal instance that owns submissionId. Required for webhook jobs. */
  providerId?: string
  /** Exact organization authenticated by an organization integration webhook. */
  organizationId?: string
}

// Email send queue — covers any transactional email triggered from a route
// or other worker so the API/job that produces the event isn't blocked on
// SMTP latency.
export type EmailJobData =
  | { kind: "alert"; alertId: string }
  | {
      kind: "approval_request"
      contractId: string
      recipientUserId: string
      to: string
      assigneeName: string
      requesterName: string
      contractTitle: string
      message?: string
    }
  | {
      kind: "approval_rejected"
      contractId: string
      recipientUserId: string
      to: string
      requesterName: string
      reviewerName: string
      contractTitle: string
      comment?: string
    }
  | {
      kind: "event_notification"
      recipientUserId: string
      eventName: string
      to: string
      contractId: string
      contractTitle: string
      actorName: string | null
      metadata: Record<string, string | number | boolean | null>
      unsubscribeToken: string
    }
  | {
      kind: "action_delivery"
      contractId: string
      recipientUserId: string
      deliveryId: string
      to: string
      recipientName: string
      actionId: string
      actionTitle: string
      actionUrl: string
      contractTitle: string
      dueDate: string | null
      sourceText: string | null
      sourcePage: number | null
    }

// ─── M7: Obligation AI extraction ────────────────────────────────────────────

export interface ObligationExtractJobData {
  contractId: string
  organizationId: string
  extractedText: string  // passed in so the worker doesn't need a DB read
  requestedById: string | null
  sourceHash: string
}

export interface ContractRiskScoreJobData {
  contractId: string
  organizationId: string
  requestedById: string
  extractedText: string
  sourceHash: string
}

export interface ExtractionPreviewJobData {
  jobId: string
  organizationId: string
  requestedByUserId: string
  requestedByMemberId: string
  storageKey: string
  fileType: "pdf" | "docx"
  createdAt: number
  expiresAt: number
}

export function extractionPreviewStorageKey(
  organizationId: string,
  memberId: string,
  jobId: string,
): string {
  return `previews/${encodeURIComponent(organizationId)}/${encodeURIComponent(memberId)}/${jobId}/source`
}

// ─── M6: Authoring (Word import / DOCX+PDF export) ───────────────────────────

export interface DocumentConvertJobData {
  contractId: string
  organizationId?: string
  requestedByMemberId?: string
  apiKeyId?: string
  sourceFileId?: string
  expectedDocumentVersion?: number | null
  storageKey: string
  requestedById: string
  jobId: string
  fileType: "docx" | "pdf"
  /** Only document-import uploads live under a disposable tmp key. */
  deleteSource?: boolean
}

export interface DocumentExportJobData {
  jobId: string
}

export interface DocumentExportCleanupJobData {
  triggeredAt: string
}

// ─── M5: Notification fan-out + delivery ──────────────────────────────────────

export interface NotificationFanoutJobData {
  eventName: string
  contractId: string
  actorId: string | null
  metadata: Record<string, string | number | boolean | null>
}

export type NotificationDeliverJobData =
  | {
      kind: "slack" | "teams"
      channelId: string
      eventName: string
      contractId: string
      contractTitle: string
      counterpartyName: string | null
      actorName: string | null
      appUrl: string
      metadata: Record<string, string | number | boolean | null>
    }
  | {
      kind: "webhook"
      webhookId: string
      deliveryLogId: string
      attempt: number
      payload: string
      signature: string
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
let _notificationFanoutQueue: Queue<NotificationFanoutJobData> | null = null
let _notificationDeliverQueue: Queue<NotificationDeliverJobData> | null = null
let _documentConvertQueue: Queue<DocumentConvertJobData> | null = null
let _documentExportQueue: Queue<DocumentExportJobData> | null = null
let _documentExportCleanupQueue: Queue<DocumentExportCleanupJobData> | null = null
let _obligationsCheckQueue: Queue<ObligationsCheckJobData> | null = null
let _salesforcePollQueue: Queue<SalesforcePollJobData> | null = null
let _importProcessQueue: Queue<ImportProcessJobData> | null = null
let _obligationExtractQueue: Queue<ObligationExtractJobData> | null = null
let _contractRiskScoreQueue: Queue<ContractRiskScoreJobData> | null = null
let _extractionPreviewQueue: Queue<ExtractionPreviewJobData> | null = null
let _interactiveAiQueue: Queue<InteractiveAiJobData> | null = null

export function getContractExtractQueue(): Queue<ContractExtractJobData> {
  return (_contractExtractQueue ??= new Queue<ContractExtractJobData>("contract.extract", {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  }))
}

export function getContractAiExtractQueue(): Queue<ContractAiExtractJobData> {
  return (_contractAiExtractQueue ??= new Queue<ContractAiExtractJobData>("contract.ai_extract", {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  }))
}

export function getContractEmbedQueue(): Queue<ContractEmbedJobData> {
  return (_contractEmbedQueue ??= new Queue<ContractEmbedJobData>("contract.embed", {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  }))
}

export function getAlertsCheckQueue(): Queue<AlertsCheckJobData> {
  return (_alertsCheckQueue ??= new Queue<AlertsCheckJobData>("alerts.check", {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  }))
}

export function getSigningSyncQueue(): Queue<SigningSyncJobData> {
  return (_signingSyncQueue ??= new Queue<SigningSyncJobData>("signing.sync", {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  }))
}

export function getEmailQueue(): Queue<EmailJobData> {
  // attempts: 1 — sendMail is not idempotent. If the SMTP send succeeds but
  // the worker crashes before BullMQ commits the job result, a retry would
  // duplicate the email. Failed jobs land in the BullMQ failed queue.
  return (_emailQueue ??= new Queue<EmailJobData>("email.send", {
    connection,
    defaultJobOptions: { attempts: 1 },
  }))
}

export function getNotificationFanoutQueue(): Queue<NotificationFanoutJobData> {
  return (_notificationFanoutQueue ??= new Queue<NotificationFanoutJobData>(
    "notification.fanout",
    {
      connection,
      defaultJobOptions: { attempts: 1, removeOnComplete: 200, removeOnFail: 500 },
    }
  ))
}

export function getNotificationDeliverQueue(): Queue<NotificationDeliverJobData> {
  return (_notificationDeliverQueue ??= new Queue<NotificationDeliverJobData>(
    "notification.deliver",
    {
      connection,
      defaultJobOptions: { attempts: 1, removeOnComplete: 500, removeOnFail: 500 },
    }
  ))
}

export function getDocumentConvertQueue(): Queue<DocumentConvertJobData> {
  return (_documentConvertQueue ??= new Queue<DocumentConvertJobData>(
    "document.convert",
    {
      connection,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200, attempts: 1 },
    }
  ))
}

export function getDocumentExportQueue(): Queue<DocumentExportJobData> {
  return (_documentExportQueue ??= new Queue<DocumentExportJobData>(
    "document.export",
    {
      connection,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200, attempts: 1 },
    }
  ))
}

export function getDocumentExportCleanupQueue(): Queue<DocumentExportCleanupJobData> {
  return (_documentExportCleanupQueue ??= new Queue<DocumentExportCleanupJobData>(
    "document.export.cleanup",
    { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200, attempts: 1 } },
  ))
}

export function getObligationsCheckQueue(): Queue<ObligationsCheckJobData> {
  return (_obligationsCheckQueue ??= new Queue<ObligationsCheckJobData>(
    "obligations.check",
    {
      connection,
      defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    },
  ))
}

export function getSalesforcePollQueue(): Queue<SalesforcePollJobData> {
  return (_salesforcePollQueue ??= new Queue<SalesforcePollJobData>(
    "salesforce.poll",
    {
      connection,
      defaultJobOptions: { attempts: 1, removeOnComplete: 50, removeOnFail: 100 },
    },
  ))
}

export function getObligationExtractQueue(): Queue<ObligationExtractJobData> {
  return (_obligationExtractQueue ??= new Queue<ObligationExtractJobData>(
    "obligations.ai_extract",
    {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }
  ))
}

export function getContractRiskScoreQueue(): Queue<ContractRiskScoreJobData> {
  return (_contractRiskScoreQueue ??= new Queue<ContractRiskScoreJobData>(
    "contract.risk_score",
    { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200, attempts: 2, backoff: { type: "exponential", delay: 5000 } } },
  ))
}

export function getExtractionPreviewQueue(): Queue<ExtractionPreviewJobData> {
  return (_extractionPreviewQueue ??= new Queue<ExtractionPreviewJobData>(
    "contract.extraction_preview",
    {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 300, count: 200 },
        removeOnFail: { age: 300, count: 500 },
      },
    },
  ))
}

export function getInteractiveAiQueue(): Queue<InteractiveAiJobData> {
  return (_interactiveAiQueue ??= new Queue<InteractiveAiJobData>(
    "ai.request",
    {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 300, count: 500 },
        removeOnFail: { age: 300, count: 500 },
      },
    },
  ))
}

export function getImportProcessQueue(): Queue<ImportProcessJobData> {
  // attempts: 1 — partial progress is persisted per ImportRow as the worker
  // streams through the file. A retry would re-process completed rows; instead
  // we expose a manual /api/import/[jobId]/retry endpoint that resets only the
  // failed rows.
  return (_importProcessQueue ??= new Queue<ImportProcessJobData>("import.process", {
    connection,
    defaultJobOptions: { attempts: 1, removeOnComplete: 200, removeOnFail: 500 },
  }))
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
export const notificationFanoutQueue = {
  add: (...a: Parameters<Queue<NotificationFanoutJobData>["add"]>) =>
    getNotificationFanoutQueue().add(...a),
  close: () => _notificationFanoutQueue?.close() ?? Promise.resolve(),
}
export const notificationDeliverQueue = {
  add: (...a: Parameters<Queue<NotificationDeliverJobData>["add"]>) =>
    getNotificationDeliverQueue().add(...a),
  close: () => _notificationDeliverQueue?.close() ?? Promise.resolve(),
}
export const documentConvertQueue = {
  add: (...a: Parameters<Queue<DocumentConvertJobData>["add"]>) =>
    getDocumentConvertQueue().add(...a),
  close: () => _documentConvertQueue?.close() ?? Promise.resolve(),
}
export const documentExportQueue = {
  add: (...a: Parameters<Queue<DocumentExportJobData>["add"]>) =>
    getDocumentExportQueue().add(...a),
  close: () => _documentExportQueue?.close() ?? Promise.resolve(),
}
export const documentExportCleanupQueue = {
  add: (...a: Parameters<Queue<DocumentExportCleanupJobData>["add"]>) =>
    getDocumentExportCleanupQueue().add(...a),
  close: () => _documentExportCleanupQueue?.close() ?? Promise.resolve(),
}
export const obligationsCheckQueue = {
  add: (...a: Parameters<Queue<ObligationsCheckJobData>["add"]>) =>
    getObligationsCheckQueue().add(...a),
  close: () => _obligationsCheckQueue?.close() ?? Promise.resolve(),
}
export const salesforcePollQueue = {
  add: (...a: Parameters<Queue<SalesforcePollJobData>["add"]>) =>
    getSalesforcePollQueue().add(...a),
  close: () => _salesforcePollQueue?.close() ?? Promise.resolve(),
}
export const importProcessQueue = {
  add: (...a: Parameters<Queue<ImportProcessJobData>["add"]>) =>
    getImportProcessQueue().add(...a),
  close: () => _importProcessQueue?.close() ?? Promise.resolve(),
}
export const obligationExtractQueue = {
  add: (...a: Parameters<Queue<ObligationExtractJobData>["add"]>) =>
    getObligationExtractQueue().add(...a),
  close: () => _obligationExtractQueue?.close() ?? Promise.resolve(),
}
export const contractRiskScoreQueue = {
  add: (...a: Parameters<Queue<ContractRiskScoreJobData>["add"]>) => getContractRiskScoreQueue().add(...a),
  close: () => _contractRiskScoreQueue?.close() ?? Promise.resolve(),
}
export const extractionPreviewQueue = {
  add: (...a: Parameters<Queue<ExtractionPreviewJobData>["add"]>) => getExtractionPreviewQueue().add(...a),
  close: () => _extractionPreviewQueue?.close() ?? Promise.resolve(),
}
export const interactiveAiQueue = {
  add: (...a: Parameters<Queue<InteractiveAiJobData>["add"]>) => getInteractiveAiQueue().add(...a),
  close: () => _interactiveAiQueue?.close() ?? Promise.resolve(),
}
