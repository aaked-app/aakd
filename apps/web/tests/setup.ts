// Prevent MaxListeners warning from ioredis exit handlers in test environment
process.setMaxListeners(50)

import "@testing-library/jest-dom"
import { vi } from "vitest"

const obligationExtractQueueMock = {
  add: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  getJob: vi.fn().mockResolvedValue(null),
}

const extractionPreviewQueueMock = {
  add: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" }),
  close: vi.fn(),
  getJob: vi.fn().mockResolvedValue(null),
}

const contractExtractQueueMock = {
  add: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  getJob: vi.fn().mockResolvedValue(null),
}

const interactiveAiPreviewStore = new Map<string, string>()
const interactiveAiQueueMock = {
  client: {
    set: vi.fn(async (key: string, value: string) => { interactiveAiPreviewStore.set(key, value); return "OK" }),
    get: vi.fn(async (key: string) => interactiveAiPreviewStore.get(key) ?? null),
    del: vi.fn(async (key: string) => Number(interactiveAiPreviewStore.delete(key))),
  },
}

vi.mock("@/lib/jobs/queues", () => ({
  contractExtractQueue: contractExtractQueueMock,
  contractAiExtractQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  contractEmbedQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  alertsCheckQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  signingSyncQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  notificationFanoutQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  notificationDeliverQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  documentConvertQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  documentExportQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  obligationsCheckQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  salesforcePollQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  importProcessQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  obligationExtractQueue: obligationExtractQueueMock,
  contractRiskScoreQueue: { add: vi.fn().mockResolvedValue({ id: "risk-job-1" }), close: vi.fn() },
  extractionPreviewQueue: extractionPreviewQueueMock,
  getObligationExtractQueue: vi.fn(() => obligationExtractQueueMock),
  getContractExtractQueue: vi.fn(() => contractExtractQueueMock),
  getContractRiskScoreQueue: vi.fn(() => ({ getJob: vi.fn().mockResolvedValue(null) })),
  getContractAiExtractQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
  getExtractionPreviewQueue: vi.fn(() => extractionPreviewQueueMock),
  getInteractiveAiQueue: vi.fn(() => interactiveAiQueueMock),
  extractionPreviewStorageKey: vi.fn((organizationId: string, memberId: string, jobId: string) =>
    `previews/${encodeURIComponent(organizationId)}/${encodeURIComponent(memberId)}/${jobId}/source`),
}))

vi.mock("@/lib/db/client", () => {
  const prisma: any = {
    contract: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    contractAccessGrant: { create: vi.fn().mockResolvedValue({ id: "grant-1" }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue({ id: "grant-1" }), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn() },
    activity: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    contractFile: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    contractVersion: { create: vi.fn() },
    contractEmbedding: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    tag: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    folder: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    member: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    invitation: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    notification: { create: vi.fn().mockResolvedValue({ id: "notif-1" }), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    apiKey: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    aIExtraction: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    orgAiConfig: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    signatureIntegration: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    contractAlert: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    approval: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _max: { step: null } }) },
    contractSigner: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    contractObligation: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), count: vi.fn() },
    contractObligationSuggestion: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    contractAction: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 0 }), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    contractActionEvidence: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contractActionEvidenceReview: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    contractActionDelivery: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    teamBrief: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    crmLink: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    crmIntegration: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    googleDriveIntegration: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    importJob: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    importRow: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    orgNotificationChannel: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    outboundWebhook: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    webhookDeliveryLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    userNotificationPreference: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    contractDocument: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    documentSnapshot: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn().mockResolvedValue(0) },
    contractComment: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    contractTemplate: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    obligationSubTask: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    $use: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  }
  // $transaction supports both array form (Promise.all) and callback form
  // (interactive). Keep a default that mirrors real semantics so tests don't
  // need to mock it per-case.
  prisma.$transaction = vi.fn().mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma)
    if (Array.isArray(arg)) return Promise.all(arg)
    return arg
  })
  return { prisma }
})
