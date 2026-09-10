import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { notificationFanoutQueue } from "@/lib/jobs/queues"

const state = vi.hoisted(() => ({
  processor: undefined as ((job: { id: string; data: { triggeredAt: string; contractId: string } }) => Promise<void>) | undefined,
  failedListener: undefined as ((job: { id: string }, error: Error) => void) | undefined,
  db: {
    contract: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    contractFile: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    contractVersion: { create: vi.fn() },
    contractSigner: { updateMany: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
  getSubmission: vi.fn(),
  fetchDocuSealDocument: vi.fn(),
  resolveConfig: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_name: string, processor: typeof state.processor) {
      state.processor = processor
    }

    on(event: string, listener: (job: { id: string }, error: Error) => void) {
      if (event === "failed") state.failedListener = listener
      return this
    }
  },
  Job: class {},
}))
vi.mock("@/lib/db/worker-client", () => ({ getWorkerPrisma: () => state.db }))
vi.mock("@/lib/storage", () => ({
  storage: { storageKey: vi.fn(), upload: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/docuseal", () => ({
  getSubmission: state.getSubmission,
  fetchDocuSealDocument: state.fetchDocuSealDocument,
}))
vi.mock("@/lib/signature/resolve-config", () => ({
  resolveDocuSealConfigFromDb: state.resolveConfig,
  docuSealEnvironmentProviderId: vi.fn(() => "environment:test"),
}))
vi.mock("@/lib/auth/agreement-access", () => ({ isAgreementAccessEmergencyDenyAll: () => false }))
vi.mock("@/lib/notifications/fanout", () => ({ enqueueNotification: vi.fn() }))
vi.mock("@/lib/logger", () => ({ logger: state.logger }))

function exposedText(value: unknown): string {
  if (value instanceof Error) return `${value.name} ${value.message} ${exposedText(value.cause)}`
  if (Array.isArray(value)) return value.map(exposedText).join(" ")
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, nested]) => `${key} ${exposedText(nested)}`).join(" ")
  }
  return String(value ?? "")
}

describe("signing sync failure sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.processor = undefined
    state.failedListener = undefined
    state.db.contract.findMany.mockResolvedValue([{
      id: "contract-1",
      title: "Agreement",
      organizationId: "org-1",
      ownerId: "owner-1",
      docusealSubmissionId: "42",
      signatureProviderId: "integration:signature-1",
      status: "AWAITING_SIGNATURE",
      signingStatus: "sent",
      signingNotificationPending: false,
      signingNotificationEvent: null,
    }])
    state.getSubmission.mockResolvedValue({
      id: 42,
      status: "completed",
      documents: [{ url: "https://evil.example/signed.pdf?token=TOPSECRET" }],
      submitters: [],
    })
    state.resolveConfig.mockResolvedValue({
      configured: true,
      config: { baseUrl: "https://docuseal.example", apiKey: "synthetic-key" },
      providerId: "integration:signature-1",
    })
    state.fetchDocuSealDocument.mockRejectedValue(new Error("Signed document URL rejected"))
  })
  afterEach(() => vi.unstubAllGlobals())

  async function runFailedSync() {
    const { createSigningSyncWorker } = await import("../../../../worker/jobs/signing-sync")
    createSigningSyncWorker({ url: "redis://127.0.0.1:6399/15" })
    expect(state.processor).toBeTypeOf("function")

    const job = { id: "job-1", data: { triggeredAt: "2026-09-09T00:00:00Z", contractId: "contract-1" } }
    let failure: Error | undefined
    try {
      await state.processor!(job)
    } catch (error) {
      failure = error as Error
    }

    expect(failure).toBeInstanceOf(Error)
    state.failedListener?.(job, failure!)
    return failure!
  }

  it("does not expose a provider document URL in logs or BullMQ failedReason", async () => {
    const failure = await runFailedSync()
    expect(failure.message).toBe("1 contract(s) failed to sync")
    expect(exposedText(failure)).not.toContain("TOPSECRET")
    expect(exposedText(state.logger.error.mock.calls)).not.toContain("TOPSECRET")
    expect(state.logger.error).toHaveBeenNthCalledWith(
      1,
      { contractId: "contract-1" },
      "[signing] Failed to sync contract",
    )
    expect(state.logger.error).toHaveBeenNthCalledWith(2, { jobId: "job-1" }, "[signing] Job failed")
  })

  it("does not expose a signed-download response body or tokenized URL", async () => {
    state.fetchDocuSealDocument.mockResolvedValue(new Response("UPSTREAM_BODY_TOPSECRET", { status: 502 }))

    const failure = await runFailedSync()

    expect(exposedText(failure)).not.toContain("TOPSECRET")
    expect(exposedText(state.logger.error.mock.calls)).not.toContain("TOPSECRET")
    expect(exposedText(state.logger.error.mock.calls)).not.toContain("UPSTREAM_BODY_TOPSECRET")
  })

  it("uses the contract organization integration for both status and signed-document calls", async () => {
    const config = { baseUrl: "https://docuseal.example", apiKey: "synthetic-key" }
    state.resolveConfig.mockResolvedValue({ configured: true, config, providerId: "integration:signature-1" })
    state.fetchDocuSealDocument.mockResolvedValue(new Response("%PDF-1.7\nsynthetic"))
    state.db.contractFile.findFirst.mockResolvedValue(null)
    state.db.$transaction.mockResolvedValue([])
    state.db.contract.findUnique.mockResolvedValue(null)
    state.db.activity.create.mockResolvedValue({})

    const { createSigningSyncWorker } = await import("../../../../worker/jobs/signing-sync")
    createSigningSyncWorker({ url: "redis://127.0.0.1:6399/15" })
    await state.processor!({
      id: "job-1",
      data: { triggeredAt: "2026-09-09T00:00:00Z", contractId: "contract-1" },
    })

    expect(state.resolveConfig).toHaveBeenCalledWith(state.db, "org-1")
    expect(state.getSubmission).toHaveBeenCalledWith(42, config)
    expect(state.fetchDocuSealDocument).toHaveBeenCalledWith(
      "https://evil.example/signed.pdf?token=TOPSECRET",
      config,
    )
  })

  it("fails closed instead of falling back to environment credentials when stored config cannot decrypt", async () => {
    state.resolveConfig.mockResolvedValue({ configured: true, config: null, providerId: "integration:signature-1" })

    await runFailedSync()

    expect(state.getSubmission).not.toHaveBeenCalled()
    expect(state.fetchDocuSealDocument).not.toHaveBeenCalled()
  })

  it.each(["ARCHIVED", "TERMINATED", "DRAFT", "ACTIVE"])(
    "does not ingest a late completion after lifecycle state changes to %s",
    async (status) => {
      state.db.contract.findMany.mockResolvedValueOnce([{
        id: "contract-1", title: "Agreement", organizationId: "org-1", ownerId: "owner-1",
        docusealSubmissionId: "42", signatureProviderId: "integration:signature-1",
        status, signingStatus: "sent", signingNotificationPending: false, signingNotificationEvent: null,
      }])

      await runFailedSync()

      expect(state.getSubmission).not.toHaveBeenCalled()
      expect(state.fetchDocuSealDocument).not.toHaveBeenCalled()
      const { storage } = await import("@/lib/storage")
      expect(storage.upload).not.toHaveBeenCalled()
      expect(state.db.contract.update).not.toHaveBeenCalled()
      expect(state.db.activity.create).not.toHaveBeenCalled()
    },
  )

  it("rechecks lifecycle state under the parent lock and cleans an unreferenced race upload", async () => {
    state.fetchDocuSealDocument.mockResolvedValue(new Response("%PDF-1.7\nsynthetic"))
    state.db.$queryRawUnsafe.mockResolvedValueOnce([{ id: "contract-1" }]).mockResolvedValueOnce([])
    state.db.contract.findUnique.mockResolvedValueOnce({ status: "ARCHIVED", signingStatus: "sent" })
    state.db.$transaction.mockImplementation(async (callback: (tx: typeof state.db) => Promise<unknown>) => callback(state.db))

    await runFailedSync()

    const { storage } = await import("@/lib/storage")
    expect(storage.upload).toHaveBeenCalledTimes(1)
    expect(storage.delete).toHaveBeenCalledTimes(1)
    expect(state.db.contractFile.create).not.toHaveBeenCalled()
    expect(state.db.contract.update).not.toHaveBeenCalled()
    expect(state.db.activity.create).not.toHaveBeenCalled()
  })

  it("updates completed submitters when the aggregate provider status remains sent", async () => {
    state.getSubmission.mockResolvedValue({
      id: 42,
      status: "sent",
      documents: [],
      submitters: [{ slug: "signer-a", status: "completed", completed_at: "2026-09-09T22:00:00Z" }],
    })
    state.db.$queryRawUnsafe.mockResolvedValue([{ id: "contract-1", signingStatus: "sent" }])
    state.db.contract.findUnique.mockResolvedValue({
      id: "contract-1", title: "Agreement", organizationId: "org-1", ownerId: "owner-1",
      status: "AWAITING_SIGNATURE", docusealSubmissionId: "42", signatureProviderId: "integration:signature-1",
      signingStatus: "sent", signingNotificationPending: false, signingNotificationEvent: null,
    })
    state.db.$transaction.mockImplementation(async (callback: (tx: typeof state.db) => Promise<unknown>) => callback(state.db))

    const { createSigningSyncWorker } = await import("../../../../worker/jobs/signing-sync")
    createSigningSyncWorker({ url: "redis://127.0.0.1:6399/15" })
    await state.processor!({ id: "job-progress", data: { triggeredAt: "2026-09-09T00:00:00Z", contractId: "contract-1" } })

    expect(state.db.contractSigner.updateMany).toHaveBeenCalledWith({
      where: { contractId: "contract-1", externalId: "signer-a" },
      data: { status: "signed", signedAt: new Date("2026-09-09T22:00:00Z") },
    })
    expect(state.db.contract.updateMany).not.toHaveBeenCalled()
    expect(state.db.activity.create).not.toHaveBeenCalled()
  })

  it("maps pending and unknown submitter states to supported pending without downgrading signed rows", async () => {
    state.getSubmission.mockResolvedValue({
      id: 42,
      status: "sent",
      documents: [],
      submitters: [
        { slug: "signer-pending", status: "pending", completed_at: null },
        { slug: "signer-opened", status: "opened", completed_at: null },
      ],
    })
    state.db.$queryRawUnsafe.mockResolvedValue([{ id: "contract-1", signingStatus: "sent" }])
    state.db.contract.findUnique.mockResolvedValue({
      id: "contract-1", title: "Agreement", organizationId: "org-1", ownerId: "owner-1",
      status: "AWAITING_SIGNATURE", docusealSubmissionId: "42", signatureProviderId: "integration:signature-1",
      signingStatus: "sent", signingNotificationPending: false, signingNotificationEvent: null,
    })
    state.db.$transaction.mockImplementation(async (callback: (tx: typeof state.db) => Promise<unknown>) => callback(state.db))

    const { createSigningSyncWorker } = await import("../../../../worker/jobs/signing-sync")
    createSigningSyncWorker({ url: "redis://127.0.0.1:6399/15" })
    await state.processor!({ id: "job-pending", data: { triggeredAt: "2026-09-09T00:00:00Z", contractId: "contract-1" } })

    for (const slug of ["signer-pending", "signer-opened"]) {
      expect(state.db.contractSigner.updateMany).toHaveBeenCalledWith({
        where: { contractId: "contract-1", externalId: slug, status: { not: "signed" } },
        data: { status: "pending", signedAt: null },
      })
    }
    expect(state.db.contract.updateMany).not.toHaveBeenCalled()
    expect(state.db.activity.create).not.toHaveBeenCalled()
  })

  it("does not update a signer when the parent lifecycle changes before the lock", async () => {
    state.getSubmission.mockResolvedValue({
      id: 42,
      status: "sent",
      documents: [],
      submitters: [{ slug: "signer-a", status: "completed", completed_at: "2026-09-09T22:00:00Z" }],
    })
    state.db.$queryRawUnsafe.mockResolvedValue([])
    state.db.$transaction.mockImplementation(async (callback: (tx: typeof state.db) => Promise<unknown>) => callback(state.db))

    await runFailedSync()

    expect(state.db.$queryRawUnsafe).toHaveBeenCalled()
    expect(state.db.contractSigner.updateMany).not.toHaveBeenCalled()
    expect(state.db.contract.updateMany).not.toHaveBeenCalled()
    expect(state.db.activity.create).not.toHaveBeenCalled()
  })

  it("commits the signed file, version, state, audit, and durable fanout marker atomically, then replays without duplicates", async () => {
    const config = { baseUrl: "https://docuseal.example", apiKey: "synthetic-key" }
    const pending = {
      id: "contract-1", title: "Agreement", organizationId: "org-1", ownerId: "owner-1",
      docusealSubmissionId: "42", signatureProviderId: "integration:signature-1",
      status: "AWAITING_SIGNATURE",
      signingStatus: "sent", signingNotificationPending: false, signingNotificationEvent: null,
    }
    const completed = { ...pending, signingStatus: "completed", signingNotificationPending: true, signingNotificationEvent: "contract.signed" }
    state.db.contract.findMany.mockResolvedValueOnce([pending]).mockResolvedValueOnce([{ ...completed, signingNotificationPending: false }])
    state.resolveConfig.mockResolvedValue({ configured: true, config, providerId: pending.signatureProviderId })
    state.getSubmission.mockResolvedValue({
      id: 42, status: "completed", documents: [{ url: "https://docuseal.example/signed.pdf" }], submitters: [],
    })
    state.fetchDocuSealDocument.mockResolvedValue(new Response("%PDF-1.7\nsynthetic"))
    state.db.$queryRawUnsafe.mockResolvedValue([{ id: pending.id }])
    state.db.contract.findUnique.mockResolvedValueOnce({ status: "AWAITING_SIGNATURE", signingStatus: "sent" }).mockResolvedValueOnce(completed)
    state.db.contractFile.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "file-1", version: 2 })
    state.db.contractFile.create.mockResolvedValue({ id: "signed-file-1" })
    state.db.contract.updateMany.mockResolvedValue({ count: 1 })
    state.db.$transaction.mockImplementation(async (callback: (tx: typeof state.db) => Promise<unknown>) => callback(state.db))

    const { createSigningSyncWorker } = await import("../../../../worker/jobs/signing-sync")
    createSigningSyncWorker({ url: "redis://127.0.0.1:6399/15" })
    const job = { id: "job-atomic", data: { triggeredAt: "2026-09-09T00:00:00Z", contractId: "contract-1" } }
    await state.processor!(job)
    await state.processor!({ ...job, id: "job-replay" })

    const { storage } = await import("@/lib/storage")
    expect(storage.upload).toHaveBeenCalledTimes(1)
    expect(state.db.contractFile.create).toHaveBeenCalledTimes(1)
    expect(state.db.contractVersion.create).toHaveBeenCalledTimes(1)
    expect(state.db.activity.create).toHaveBeenCalledTimes(1)
    expect(state.db.contract.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ signingStatus: "completed", signingNotificationPending: true }),
    }))
    expect(notificationFanoutQueue.add).toHaveBeenCalledTimes(1)
  })
})
