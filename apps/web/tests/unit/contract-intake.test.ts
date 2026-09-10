import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ContractIntakeError,
  contractIntakeHash,
  createContractIntake,
  findContractIntakeReplay,
  validateIntakeExtractions,
  type ContractIntakeInput,
} from "@/lib/contracts/intake"
import { withoutContractIntakeIdentity } from "@/lib/contracts/create-schema"

const ctx = {
  userId: "user-1",
  organizationId: "org-1",
  memberId: "member-1",
  role: "member",
  source: "session" as const,
  requestId: "request-log-1",
}

const input: ContractIntakeInput = {
  requestId: "11111111-1111-4111-8111-111111111111",
  metadata: {
    title: "Agreement",
    contractType: "NDA",
    counterpartyName: "Acme",
    currency: "USD",
    autoRenewal: false,
    renewalReminderEnabled: true,
    tagIds: [],
  },
  extractions: [
    { field: "contractType", rawValue: "NDA", confidence: 0.9, extractedBy: "ai" },
    { field: "counterpartyName", rawValue: "Acme", confidence: 0.7, extractedBy: "manual" },
  ],
  file: { buffer: Buffer.from("%PDF-1.7\nsynthetic"), filename: "agreement.pdf", mimeType: "application/pdf" },
}

function fixtureDb() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn(async (query: { strings?: readonly string[] }): Promise<Array<Record<string, unknown>>> => {
      const sql = query.strings?.join("") ?? ""
      return sql.includes("SELECT EXISTS") ? [{ referenced: false }] : []
    }),
    contract: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue({ ownerId: "user-1" }),
      create: vi.fn().mockResolvedValue({ id: "contract-1" }),
    },
    member: { findFirst: vi.fn().mockResolvedValue({ role: "member" }) },
    contractAccessGrant: {
      create: vi.fn().mockResolvedValue({ id: "grant-1" }),
      findFirst: vi.fn().mockResolvedValue({ id: "grant-1" }),
    },
    folder: { findFirst: vi.fn() },
    tag: { findMany: vi.fn().mockResolvedValue([]) },
    aIExtraction: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    contractFile: {
      create: vi.fn().mockResolvedValue({ id: "file-1", storageKey: "staged-key", mimeType: "application/pdf" }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    contractVersion: { create: vi.fn().mockResolvedValue({ id: "version-1" }) },
    contractAlert: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    activity: { create: vi.fn().mockResolvedValue({ id: "activity-1" }) },
  }
  const db = {
    contract: { findUnique: vi.fn().mockResolvedValue(null) },
    contractAccessGrant: { findFirst: vi.fn().mockResolvedValue({ id: "grant-1" }) },
    $queryRaw: vi.fn().mockResolvedValue([{ present: false }]),
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  }
  return { db, tx }
}

function fixtureDeps() {
  return {
    objectStore: { upload: vi.fn().mockResolvedValue("ok"), delete: vi.fn().mockResolvedValue(undefined) },
    queues: {
      extract: { add: vi.fn().mockResolvedValue({ id: "extract" }), getJob: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
      convert: { add: vi.fn().mockResolvedValue({ id: "convert" }), getJob: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
    },
  }
}

describe("contract intake validation", () => {
  it("removes replay authorization fields from public contract mutation responses", () => {
    expect(withoutContractIntakeIdentity({
      id: "contract-1",
      title: "Agreement",
      intakeRequestId: input.requestId,
      intakeRequestHash: "secret-hash",
      intakeRequestedByMemberId: "member-1",
    })).toEqual({ id: "contract-1", title: "Agreement" })
  })

  it("rejects duplicate, unsupported, contradictory, and empty AI seeds", () => {
    expect(() => validateIntakeExtractions(input.metadata, [input.extractions[0], input.extractions[0]]))
      .toThrowError(ContractIntakeError)
    expect(() => validateIntakeExtractions(input.metadata, [{ field: "ownerId", rawValue: "x", confidence: 0, extractedBy: "manual" }]))
      .toThrowError(ContractIntakeError)
    expect(() => validateIntakeExtractions(input.metadata, [{ field: "contractType", rawValue: "MSA", confidence: 0, extractedBy: "manual" }]))
      .toThrow("manual_extraction_mismatch")
    expect(() => validateIntakeExtractions(input.metadata, [{ field: "contractType", rawValue: "", confidence: 0, extractedBy: "ai" }]))
      .toThrow("invalid_extractions")
  })

  it("keeps an explicit manual clear only for an absent optional canonical value", () => {
    expect(validateIntakeExtractions(input.metadata, [{
      field: "governingLaw", rawValue: "", confidence: 0.8, extractedBy: "manual",
    }])).toEqual([{ field: "governingLaw", rawValue: "", confidence: 0, extractedBy: "manual" }])
    expect(() => validateIntakeExtractions(input.metadata, [{
      field: "counterpartyName", rawValue: "", confidence: 0, extractedBy: "manual",
    }])).toThrow("manual_extraction_mismatch")
  })

  it("hashes normalized seed order, filename, mime type, and file bytes", () => {
    const normalized = { ...input, extractions: validateIntakeExtractions(input.metadata, input.extractions) }
    const baseline = contractIntakeHash(normalized)
    expect(contractIntakeHash({ ...normalized, extractions: [...normalized.extractions].reverse() })).toBe(baseline)
    expect(contractIntakeHash({ ...normalized, file: { ...normalized.file, filename: "other.pdf" } })).not.toBe(baseline)
    expect(contractIntakeHash({ ...normalized, file: { ...normalized.file, buffer: Buffer.from("%PDF-different") } })).not.toBe(baseline)
  })
})

describe("atomic contract intake", () => {
  beforeEach(() => vi.clearAllMocks())

  it("commits contract, exact grant, provenance, file, version, and audits before independent queues", async () => {
    const { db, tx } = fixtureDb()
    const deps = fixtureDeps()

    await expect(createContractIntake(db as never, ctx, input, deps as never)).resolves.toEqual({
      id: "contract-1", replayed: false, extractionQueued: true, conversionQueued: true,
    })
    expect(deps.objectStore.upload).toHaveBeenCalledOnce()
    expect(tx.contract.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        ownerId: "user-1",
        intakeRequestId: input.requestId,
        intakeRequestedByMemberId: "member-1",
      }),
    }))
    expect(tx.contractAccessGrant.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ memberId: "member-1", grantedById: "user-1" }),
    }))
    expect(tx.aIExtraction.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ field: "contractType", status: "pending", extractedBy: "ai", confidence: 0.9 }),
      expect.objectContaining({ field: "counterpartyName", status: "accepted", extractedBy: "manual", confidence: 0 }),
    ] })
    expect(tx.activity.create).toHaveBeenCalledTimes(3)
    expect(deps.queues.extract.add).toHaveBeenCalledWith("extract", expect.objectContaining({
      fileId: "file-1", preserveUserFields: true,
    }), { jobId: "contract-text-file-1" })
    expect(deps.queues.extract.add.mock.calls[0][1]).not.toHaveProperty("skipAiExtraction")
    expect(deps.queues.convert.add).toHaveBeenCalledWith("convert", expect.objectContaining({
      sourceFileId: "file-1", organizationId: "org-1", requestedByMemberId: "member-1",
    }), { jobId: "contract-document-file-1" })
  })

  it("persists renewal and expiry alerts in the same transaction before queues run", async () => {
    const { db, tx } = fixtureDb()
    const deps = fixtureDeps()
    const datedInput = {
      ...input,
      metadata: {
        ...input.metadata,
        endDate: "2099-12-31",
        renewalDate: "2099-12-01",
        noticePeriodDays: 30,
      },
    }

    await createContractIntake(db as never, ctx, datedInput, deps as never)

    expect(tx.contractAlert.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ alertType: "EXPIRY_90" }),
      expect.objectContaining({ alertType: "RENEWAL_DUE" }),
      expect.objectContaining({ alertType: "NOTICE_PERIOD" }),
    ]) })
    expect(tx.contractAlert.createMany.mock.invocationCallOrder[0])
      .toBeLessThan(deps.queues.extract.add.mock.invocationCallOrder[0])
  })

  it("atomically marks an already-ended contract expired and records the transition", async () => {
    const { db, tx } = fixtureDb()

    await createContractIntake(db as never, ctx, {
      ...input,
      metadata: { ...input.metadata, endDate: "2000-01-01" },
    }, fixtureDeps() as never)

    expect(tx.contract.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "EXPIRED" }),
    }))
    expect(tx.contractAlert.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ alertType: "EXPIRY_PAST" }),
    ] })
    expect(tx.activity.create).toHaveBeenCalledTimes(4)
  })

  it("returns durable success when either queue is unavailable", async () => {
    const { db } = fixtureDb()
    const deps = fixtureDeps()
    deps.queues.extract.add.mockRejectedValue(new Error("redis down"))

    await expect(createContractIntake(db as never, ctx, input, deps as never)).resolves.toEqual({
      id: "contract-1", replayed: false, extractionQueued: false, conversionQueued: true,
    })
  })

  it("retries retained failed jobs instead of treating a duplicate stable ID as newly queued", async () => {
    const { db } = fixtureDb()
    const deps = fixtureDeps()
    const retryExtraction = vi.fn().mockResolvedValue(undefined)
    const retryConversion = vi.fn().mockResolvedValue(undefined)
    deps.queues.extract.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue("failed"), retry: retryExtraction })
    deps.queues.convert.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue("failed"), retry: retryConversion })

    await expect(createContractIntake(db as never, ctx, input, deps as never)).resolves.toMatchObject({
      extractionQueued: true,
      conversionQueued: true,
    })
    expect(retryExtraction).toHaveBeenCalledOnce()
    expect(retryConversion).toHaveBeenCalledOnce()
    expect(deps.queues.extract.add).not.toHaveBeenCalled()
    expect(deps.queues.convert.add).not.toHaveBeenCalled()
  })

  it("recreates a stable job whose retained handle becomes unknown during lookup", async () => {
    const { db } = fixtureDb()
    const deps = fixtureDeps()
    deps.queues.extract.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue("unknown"), retry: vi.fn() })

    await createContractIntake(db as never, ctx, input, deps as never)

    expect(deps.queues.extract.add).toHaveBeenCalledWith("extract", expect.anything(), { jobId: "contract-text-file-1" })
  })

  it("returns an actionable failure and creates no database record when storage rejects", async () => {
    const { db, tx } = fixtureDb()
    const deps = fixtureDeps()
    deps.objectStore.upload.mockRejectedValue(new Error("storage unavailable"))

    await expect(createContractIntake(db as never, ctx, input, deps as never))
      .rejects.toMatchObject({ code: "storage_upload_failed", status: 502 })
    expect(tx.contract.create).not.toHaveBeenCalled()
    expect(deps.objectStore.delete).not.toHaveBeenCalled()
  })

  it.each([
    ["provenance", (tx: ReturnType<typeof fixtureDb>["tx"]) => tx.aIExtraction.createMany.mockRejectedValue(new Error("provenance failure")), input],
    ["file", (tx: ReturnType<typeof fixtureDb>["tx"]) => tx.contractFile.create.mockRejectedValue(new Error("file failure")), input],
    ["version", (tx: ReturnType<typeof fixtureDb>["tx"]) => tx.contractVersion.create.mockRejectedValue(new Error("version failure")), input],
    ["audit", (tx: ReturnType<typeof fixtureDb>["tx"]) => tx.activity.create.mockRejectedValue(new Error("audit failure")), input],
    ["alert", (tx: ReturnType<typeof fixtureDb>["tx"]) => tx.contractAlert.createMany.mockRejectedValue(new Error("alert failure")), {
      ...input,
      metadata: { ...input.metadata, renewalDate: "2099-12-01" },
    }],
  ])("compensates the staged object when %s persistence fails", async (_label, fail, failedInput) => {
    const { db, tx } = fixtureDb()
    const deps = fixtureDeps()
    fail(tx)

    await expect(createContractIntake(db as never, ctx, failedInput, deps as never)).rejects.toThrow(/failure/)
    expect(deps.objectStore.delete).toHaveBeenCalledOnce()
    expect(deps.queues.extract.add).not.toHaveBeenCalled()
    expect(deps.queues.convert.add).not.toHaveBeenCalled()
  })

  it("replays a known exact request without uploading or creating another contract", async () => {
    const { db, tx } = fixtureDb()
    const deps = fixtureDeps()
    db.$queryRaw.mockResolvedValue([{ present: true }])
    const normalized = { ...input, extractions: validateIntakeExtractions(input.metadata, input.extractions) }
    tx.$queryRaw.mockResolvedValueOnce([{
      id: "contract-1",
      intakeRequestHash: contractIntakeHash(normalized),
      intakeRequestedByMemberId: "member-1",
      fileId: "file-1",
      storageKey: "original-key",
      mimeType: "application/pdf",
    }])

    await expect(createContractIntake(db as never, ctx, input, deps as never)).resolves.toEqual({
      id: "contract-1", replayed: true, extractionQueued: true, conversionQueued: true,
    })
    expect(deps.objectStore.upload).not.toHaveBeenCalled()
    expect(tx.contract.create).not.toHaveBeenCalled()
  })

  it("checks original membership and current grant before disclosing a payload conflict", async () => {
    const { db, tx } = fixtureDb()
    db.$queryRaw.mockResolvedValue([{ present: true }])
    tx.$queryRaw.mockResolvedValueOnce([{
      id: "contract-1", intakeRequestHash: "different", intakeRequestedByMemberId: "old-member",
      fileId: null, storageKey: null, mimeType: null,
    }])
    await expect(createContractIntake(db as never, ctx, input, fixtureDeps() as never))
      .rejects.toMatchObject({ code: "not_found", status: 404 })
    expect(tx.contractAccessGrant.findFirst).not.toHaveBeenCalled()
  })

  it("deletes only a proven-unreferenced attempt after rollback and preserves it when recovery is unknown", async () => {
    const first = fixtureDb()
    const firstDeps = fixtureDeps()
    first.tx.contract.create.mockRejectedValue(new Error("db failure"))
    await expect(createContractIntake(first.db as never, ctx, input, firstDeps as never)).rejects.toThrow("db failure")
    expect(firstDeps.objectStore.delete).toHaveBeenCalledOnce()
    expect(first.tx.contractFile.findFirst).not.toHaveBeenCalled()
    expect(first.tx.$queryRaw).toHaveBeenCalled()
    expect(first.db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" })

    const second = fixtureDb()
    const secondDeps = fixtureDeps()
    second.tx.contract.create.mockRejectedValue(new Error("db failure"))
    second.db.$transaction
      .mockImplementationOnce(async callback => callback(second.tx))
      .mockRejectedValueOnce(new Error("recovery unavailable"))
    await expect(createContractIntake(second.db as never, ctx, input, secondDeps as never)).rejects.toThrow("db failure")
    expect(secondDeps.objectStore.delete).not.toHaveBeenCalled()
  })

  it("lookup returns only to the original current member with an exact grant", async () => {
    const { db } = fixtureDb()
    db.contract.findUnique.mockResolvedValue({ id: "contract-1", intakeRequestedByMemberId: "member-1" })
    await expect(findContractIntakeReplay(db as never, ctx, input.requestId)).resolves.toEqual({ id: "contract-1" })
    await expect(findContractIntakeReplay(db as never, { ...ctx, memberId: "member-2" }, input.requestId)).resolves.toBeNull()
  })
})
