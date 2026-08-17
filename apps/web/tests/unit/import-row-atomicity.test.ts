import { beforeEach, describe, expect, it, vi } from "vitest"

const db = {
  importRow: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  contract: { create: vi.fn() },
  activity: { create: vi.fn() },
  contractFile: { create: vi.fn(), update: vi.fn() },
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
    vi.clearAllMocks()
    db.importRow.findUnique.mockResolvedValue(null)
    db.importRow.upsert.mockResolvedValue({ status: "pending", contractId: null })
    db.contract.create.mockResolvedValue({ id: "contract-1" })
    db.activity.create.mockResolvedValue({})
    db.contractFile.create.mockResolvedValue({ id: "file-1" })
    db.contractFile.update.mockResolvedValue({})
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

  it("deletes the exact uploaded object when the transaction fails before row success", async () => {
    db.importRow.update.mockRejectedValueOnce(new Error("row write failed"))
    await expect(createImportedContractForRow({ title: "Contract", file }, context, row)).rejects.toThrow("row write failed")
    expect(storage.delete).toHaveBeenCalledWith("contracts/org-1/contract-1/files/file-1/contract.pdf")
    expect(contractExtractQueue.add).not.toHaveBeenCalled()
  })

  it("keeps committed success when extraction enqueue fails", async () => {
    vi.mocked(contractExtractQueue.add).mockRejectedValueOnce(new Error("Redis down"))
    await expect(createImportedContractForRow({ title: "Contract", file }, context, row)).resolves.toBe("contract-1")
    expect(db.importRow.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "success", contractId: "contract-1" }),
    }))
    expect(storage.delete).not.toHaveBeenCalled()
  })
})
