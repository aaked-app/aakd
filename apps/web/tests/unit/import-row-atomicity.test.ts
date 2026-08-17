import { beforeEach, describe, expect, it, vi } from "vitest"

const db = {
  importRow: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  contract: { create: vi.fn() },
  activity: { create: vi.fn() },
  contractFile: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}

vi.mock("@/lib/db/worker-client", () => ({ getWorkerPrisma: () => db }))
vi.mock("@/lib/storage", () => ({ storage: { upload: vi.fn(), delete: vi.fn() } }))

import { contractExtractQueue } from "@/lib/jobs/queues"
import { storage } from "@/lib/storage"
import { createImportedContractForRow } from "@/lib/import/create-contract"

const context = { organizationId: "org-1", ownerId: "user-1" }
const row = { jobId: "job-1", rowIndex: 1, sourceRef: "contract.pdf" }
const file = {
  buffer: Buffer.from("%PDF-"),
  filename: "contract.pdf",
  mimeType: "application/pdf",
  sizeBytes: 5,
}

describe("transactional imported contract rows", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.importRow.findUnique.mockResolvedValue(null)
    db.importRow.upsert.mockResolvedValue({ status: "pending", contractId: null })
    db.contract.create.mockResolvedValue({ id: "contract-1" })
    db.activity.create.mockResolvedValue({})
    db.contractFile.create.mockResolvedValue({ id: "file-1" })
    db.contractFile.update.mockResolvedValue({})
    db.contractFile.findFirst.mockResolvedValue(null)
    db.$queryRaw.mockResolvedValue([])
    db.importRow.update.mockResolvedValue({})
    db.$transaction.mockImplementation(async (fn) => fn(db))
    vi.mocked(storage.upload).mockResolvedValue("key")
    vi.mocked(storage.delete).mockResolvedValue()
    vi.mocked(contractExtractQueue.add).mockResolvedValue({} as never)
  })

  it("skips all transaction and external work for an already successful row", async () => {
    db.importRow.findUnique.mockResolvedValue({ status: "success", contractId: "canonical" })
    await expect(createImportedContractForRow({ title: "Existing" }, context, row)).resolves.toBe("canonical")
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(contractExtractQueue.add).not.toHaveBeenCalled()
  })

  it("uses the PostgreSQL two-integer advisory-lock signature", async () => {
    await createImportedContractForRow({ title: "Contract" }, context, row)

    expect(db.$queryRaw).toHaveBeenCalledOnce()
    const [segments, jobId, rowIndex] = db.$queryRaw.mock.calls[0]
    expect(Array.from(segments)).toEqual([
      "SELECT pg_advisory_xact_lock(hashtext(",
      ")::int, ",
      "::int)",
    ])
    expect(jobId).toBe(row.jobId)
    expect(rowIndex).toBe(row.rowIndex)
  })

  it("uploads the staged object before opening the database transaction", async () => {
    const order: string[] = []
    vi.mocked(storage.upload).mockImplementationOnce(async () => {
      order.push("upload")
      return "key"
    })
    db.$transaction.mockImplementationOnce(async (fn) => {
      order.push("transaction")
      return fn(db)
    })

    await createImportedContractForRow({ title: "Contract", file }, context, row)

    expect(order).toEqual(["upload", "transaction"])
    const stagedKey = vi.mocked(storage.upload).mock.calls[0][0]
    expect(db.contractFile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ storageKey: stagedKey }),
    }))
    expect(db.contractFile.update).not.toHaveBeenCalled()
  })

  it("deletes the exact staged object when the transaction fails before row success", async () => {
    db.importRow.update.mockRejectedValueOnce(new Error("row write failed"))
    await expect(createImportedContractForRow({ title: "Contract", file }, context, row)).rejects.toThrow("row write failed")
    const stagedKey = vi.mocked(storage.upload).mock.calls[0][0]
    expect(storage.delete).toHaveBeenCalledWith(stagedKey)
    expect(contractExtractQueue.add).not.toHaveBeenCalled()
  })

  it("retains the object when the transaction committed but its acknowledgement failed", async () => {
    db.importRow.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "success", contractId: "contract-1" })
    db.contractFile.findFirst.mockResolvedValueOnce({ id: "file-1" })
    db.$transaction.mockImplementationOnce(async (fn) => {
      await fn(db)
      throw new Error("transaction acknowledgement lost")
    })

    await expect(createImportedContractForRow({ title: "Contract", file }, context, row))
      .rejects.toThrow("transaction acknowledgement lost")

    const stagedKey = vi.mocked(storage.upload).mock.calls[0][0]
    expect(db.contractFile.findFirst).toHaveBeenCalledWith({
      where: { contractId: "contract-1", storageKey: stagedKey },
      select: { id: true },
    })
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("retains the staged object when the post-failure reference check is inconclusive", async () => {
    db.importRow.update.mockRejectedValueOnce(new Error("transaction failed"))
    db.importRow.findUnique
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("database unavailable"))

    await expect(createImportedContractForRow({ title: "Contract", file }, context, row))
      .rejects.toThrow("transaction failed")
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("keeps committed success when extraction enqueue fails", async () => {
    vi.mocked(contractExtractQueue.add).mockRejectedValueOnce(new Error("Redis down"))
    await expect(createImportedContractForRow({ title: "Contract", file }, context, row)).resolves.toBe("contract-1")
    expect(db.importRow.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "success", contractId: "contract-1" }),
    }))
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("isolates same-content retry staging keys while creating only one contract", async () => {
    let state: { status: string; contractId: string | null } | null = null
    db.importRow.findUnique.mockResolvedValue(null)
    db.importRow.upsert.mockImplementation(async () => state ?? { status: "pending", contractId: null })
    db.importRow.update.mockImplementation(async () => {
      state = { status: "success", contractId: "contract-1" }
      return state
    })
    let tail = Promise.resolve()
    db.$transaction.mockImplementation((fn) => {
      const run = tail.then(() => fn(db))
      tail = run.then(() => undefined)
      return run
    })

    const results = await Promise.all([
      createImportedContractForRow({ title: "Contract", file }, context, row),
      createImportedContractForRow({ title: "Contract", file }, context, row),
    ])

    expect(results).toEqual(["contract-1", "contract-1"])
    expect(db.$queryRaw).toHaveBeenCalledTimes(2)
    expect(db.contract.create).toHaveBeenCalledOnce()
    const [firstKey, secondKey] = vi.mocked(storage.upload).mock.calls.map(([key]) => key)
    expect(firstKey).not.toBe(secondKey)
    expect(storage.delete).toHaveBeenCalledOnce()
    expect(storage.delete).toHaveBeenCalledWith(secondKey)
  })
})
