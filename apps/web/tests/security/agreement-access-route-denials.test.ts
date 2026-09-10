import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

const sideEffects = vi.hoisted(() => ({
  activity: vi.fn(),
  capture: vi.fn(),
  docusealAddFields: vi.fn(),
  docusealArchive: vi.fn(),
  docusealCreateSubmission: vi.fn(),
  docusealCreateTemplate: vi.fn(),
  docusealRemind: vi.fn(),
  enqueueNotification: vi.fn(),
  fireAndLog: vi.fn(),
  getDocuSealConfig: vi.fn(),
  inApp: vi.fn(),
  inAppToOrg: vi.fn(),
  obligationQueue: vi.fn(),
  signingQueue: vi.fn(),
  storageDelete: vi.fn(),
  storageDownload: vi.fn(),
  storageGet: vi.fn(),
  storageUpload: vi.fn(),
}))

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(), requireWriteScope: vi.fn() }))
vi.mock("@/lib/context", () => ({ requestContext: { run: vi.fn((_ctx, fn) => fn()) } }))
vi.mock("@/lib/db/activity", () => ({ writeActivity: sideEffects.activity }))
vi.mock("@/lib/docuseal", () => ({
  addFieldsToTemplate: sideEffects.docusealAddFields,
  archiveSubmission: sideEffects.docusealArchive,
  createSubmission: sideEffects.docusealCreateSubmission,
  createTemplate: sideEffects.docusealCreateTemplate,
  remindSubmitter: sideEffects.docusealRemind,
}))
vi.mock("@/lib/jobs/queues", () => ({
  contractExtractQueue: { add: sideEffects.obligationQueue },
  emailQueue: { add: sideEffects.enqueueNotification },
  getObligationExtractQueue: () => ({ add: sideEffects.obligationQueue }),
  notificationFanoutQueue: { add: sideEffects.enqueueNotification },
  signingSyncQueue: { add: sideEffects.signingQueue },
}))
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  requestLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))
vi.mock("@/lib/notifications/fanout", () => ({ enqueueNotification: sideEffects.enqueueNotification }))
vi.mock("@/lib/notifications/write-in-app", () => ({
  writeInApp: sideEffects.inApp,
  writeInAppToOrgMembers: sideEffects.inAppToOrg,
}))
vi.mock("@/lib/posthog-server", () => ({ captureServerEvent: sideEffects.capture }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
  rateLimitResponse: vi.fn(() => new Response("rate limited", { status: 429 })),
}))
vi.mock("@/lib/signature/config", () => ({ getDocuSealConfig: sideEffects.getDocuSealConfig }))
vi.mock("@/lib/storage", () => ({
  storage: {
    delete: sideEffects.storageDelete,
    download: sideEffects.storageDownload,
    getObject: sideEffects.storageGet,
    upload: sideEffects.storageUpload,
  },
}))
vi.mock("@/lib/utils/fire-and-log", () => ({ fireAndLog: sideEffects.fireAndLog }))

const authContext = {
  userId: "user-admin",
  organizationId: "org-1",
  memberId: "member-admin",
  role: "admin",
  source: "session" as const,
  requestId: "agreement-denial-matrix",
}

function invalidJson(url: string, method: "PATCH" | "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{",
  })
}

function deletion(url: string) {
  return new Request(url, { method: "DELETE" })
}

type DenialCase = { name: string; invoke: () => Promise<Response> }

const cases: DenialCase[] = [
  {
    name: "POST approval",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/approvals/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/approvals", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "PATCH approval decision",
    invoke: async () => {
      const { PATCH } = await import("@/app/api/contracts/[id]/approvals/[approvalId]/route")
      return PATCH(invalidJson("http://localhost/api/contracts/contract-1/approvals/approval-1", "PATCH"), { params: Promise.resolve({ id: "contract-1", approvalId: "approval-1" }) })
    },
  },
  {
    name: "DELETE approval",
    invoke: async () => {
      const { DELETE } = await import("@/app/api/contracts/[id]/approvals/[approvalId]/route")
      return DELETE(deletion("http://localhost/api/contracts/contract-1/approvals/approval-1"), { params: Promise.resolve({ id: "contract-1", approvalId: "approval-1" }) })
    },
  },
  {
    name: "POST obligation",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/obligations", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "PATCH obligation",
    invoke: async () => {
      const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
      return PATCH(invalidJson("http://localhost/api/contracts/contract-1/obligations/obligation-1", "PATCH"), { params: Promise.resolve({ id: "contract-1", obligationId: "obligation-1" }) })
    },
  },
  {
    name: "DELETE obligation",
    invoke: async () => {
      const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
      return DELETE(deletion("http://localhost/api/contracts/contract-1/obligations/obligation-1"), { params: Promise.resolve({ id: "contract-1", obligationId: "obligation-1" }) })
    },
  },
  {
    name: "POST obligation subtask",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/obligations/obligation-1/subtasks", "POST"), { params: Promise.resolve({ id: "contract-1", obligationId: "obligation-1" }) })
    },
  },
  {
    name: "PATCH obligation subtask",
    invoke: async () => {
      const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route")
      return PATCH(invalidJson("http://localhost/api/contracts/contract-1/obligations/obligation-1/subtasks/subtask-1", "PATCH"), { params: Promise.resolve({ id: "contract-1", obligationId: "obligation-1", subtaskId: "subtask-1" }) })
    },
  },
  {
    name: "DELETE obligation subtask",
    invoke: async () => {
      const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route")
      return DELETE(deletion("http://localhost/api/contracts/contract-1/obligations/obligation-1/subtasks/subtask-1"), { params: Promise.resolve({ id: "contract-1", obligationId: "obligation-1", subtaskId: "subtask-1" }) })
    },
  },
  {
    name: "POST obligation extraction",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/obligations/extract", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "POST snapshot",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/snapshots", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "DELETE snapshot",
    invoke: async () => {
      const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
      return DELETE(deletion("http://localhost/api/contracts/contract-1/snapshots/snapshot-1"), { params: Promise.resolve({ id: "contract-1", snapshotId: "snapshot-1" }) })
    },
  },
  {
    name: "POST comment",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/comments/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/comments", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "PATCH comment",
    invoke: async () => {
      const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
      return PATCH(invalidJson("http://localhost/api/contracts/contract-1/comments/comment-1", "PATCH"), { params: Promise.resolve({ id: "contract-1", commentId: "comment-1" }) })
    },
  },
  {
    name: "DELETE comment",
    invoke: async () => {
      const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
      return DELETE(deletion("http://localhost/api/contracts/contract-1/comments/comment-1"), { params: Promise.resolve({ id: "contract-1", commentId: "comment-1" }) })
    },
  },
  {
    name: "POST legacy signing",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/sign/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/sign", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "POST signer",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/signing/signers", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "DELETE signer",
    invoke: async () => {
      const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
      return DELETE(deletion("http://localhost/api/contracts/contract-1/signing/signers/signer-1"), { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) })
    },
  },
  {
    name: "POST signing reminder",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/signing/remind", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "POST signing reset",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/signing/reset", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
  {
    name: "POST signing send",
    invoke: async () => {
      const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
      return POST(invalidJson("http://localhost/api/contracts/contract-1/signing/send", "POST"), { params: Promise.resolve({ id: "contract-1" }) })
    },
  },
]

describe("agreement access mutation route denial matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveAuth).mockResolvedValue(authContext)
    vi.mocked(requireWriteScope).mockReturnValue(null)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue(null)
  })

  it.each(cases)("denies $name before validation or side effects", async ({ invoke }) => {
    const response = await invoke()

    expect(response.status).toBe(404)
    expect(prisma.contractAccessGrant.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1", memberId: "member-admin", contractId: "contract-1" },
      select: { id: true },
    })
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()

    const mutationMocks = [
      prisma.activity.create,
      prisma.approval.create,
      prisma.approval.delete,
      prisma.approval.deleteMany,
      prisma.approval.update,
      prisma.approval.updateMany,
      prisma.contract.update,
      prisma.contract.updateMany,
      prisma.contractComment.create,
      prisma.contractComment.delete,
      prisma.contractComment.update,
      prisma.contractObligation.create,
      prisma.contractObligation.delete,
      prisma.contractObligation.update,
      prisma.contractObligation.updateMany,
      prisma.contractSigner.create,
      prisma.contractSigner.delete,
      prisma.contractSigner.update,
      prisma.contractSigner.updateMany,
      prisma.documentSnapshot.create,
      prisma.documentSnapshot.delete,
      prisma.obligationSubTask.create,
      prisma.obligationSubTask.delete,
      prisma.obligationSubTask.update,
      sideEffects.activity,
      sideEffects.capture,
      sideEffects.docusealAddFields,
      sideEffects.docusealArchive,
      sideEffects.docusealCreateSubmission,
      sideEffects.docusealCreateTemplate,
      sideEffects.docusealRemind,
      sideEffects.enqueueNotification,
      sideEffects.fireAndLog,
      sideEffects.getDocuSealConfig,
      sideEffects.inApp,
      sideEffects.inAppToOrg,
      sideEffects.obligationQueue,
      sideEffects.signingQueue,
      sideEffects.storageDelete,
      sideEffects.storageDownload,
      sideEffects.storageGet,
      sideEffects.storageUpload,
    ]
    for (const mutation of mutationMocks) expect(mutation).not.toHaveBeenCalled()
  })
})
