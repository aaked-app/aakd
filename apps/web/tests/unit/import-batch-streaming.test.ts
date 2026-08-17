import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const db = {
  importRow: { findFirst: vi.fn(), upsert: vi.fn() },
  importJob: { update: vi.fn() },
  googleDriveIntegration: { findUnique: vi.fn() },
}

vi.mock("@/lib/db/worker-client", () => ({ getWorkerPrisma: () => db }))
vi.mock("@/lib/storage", () => ({
  storage: {
    getSignedDownloadUrl: vi.fn(),
  },
}))
vi.mock("@/lib/import/create-contract", () => ({
  createImportedContractForRow: vi.fn(),
  recordImportRowFailure: vi.fn(),
  sanitizeFilename: vi.fn((name: string) => name),
}))
vi.mock("@/lib/import/gdrive-client", () => ({ downloadDriveFile: vi.fn() }))

import { createImportedContractForRow, recordImportRowFailure } from "@/lib/import/create-contract"
import { downloadDriveFile } from "@/lib/import/gdrive-client"
import { runBatchHandler } from "@/lib/import/handlers/batch"
import { storage } from "@/lib/storage"

const job = {
  id: "job-1",
  source: "GOOGLE_DRIVE",
  driveFileIds: "file-1,file-2",
  storageKey: null,
}
const context = { organizationId: "org-1", createdById: "user-1" }

describe("batch import memory bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.googleDriveIntegration.findUnique.mockResolvedValue({
      id: "drive-1",
      accessToken: "token",
      refreshToken: "refresh",
      tokenExpiresAt: null,
    })
    db.importRow.findFirst.mockResolvedValue(null)
    db.importJob.update.mockResolvedValue({})
    vi.mocked(createImportedContractForRow).mockResolvedValue("contract-1")
    vi.mocked(recordImportRowFailure).mockResolvedValue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("finishes each Drive file before downloading the next one", async () => {
    const events: string[] = []
    vi.mocked(downloadDriveFile).mockImplementation(async (_integration, fileId) => {
      events.push(`download:${fileId}`)
      return {
        buffer: Buffer.from("%PDF-"),
        name: `${fileId}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 5,
      }
    })
    vi.mocked(createImportedContractForRow).mockImplementation(async (_data, _context, row) => {
      events.push(`process:${row.sourceRef}`)
      return `contract-${row.rowIndex}`
    })

    await runBatchHandler(job as never, context as never)

    expect(events).toEqual([
      "download:file-1",
      "process:drive:file-1",
      "download:file-2",
      "process:drive:file-2",
    ])
  })

  it("cancels an oversized manifest file response and records the row failure", async () => {
    const cancel = vi.fn()
    const pull = vi.fn()
    const oversizedBody = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
    vi.mocked(storage.getSignedDownloadUrl)
      .mockResolvedValueOnce("https://storage.example/manifest")
      .mockResolvedValueOnce("https://storage.example/file")
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [{
        filename: "contract.pdf",
        storageKey: "imports/org-1/job-1/files/contract.pdf",
        sizeBytes: 5,
      }] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(oversizedBody, {
        status: 200,
        headers: { "Content-Length": String(50 * 1024 * 1024 + 1) },
      }))

    await runBatchHandler({
      ...job,
      source: "BATCH_FILES",
      driveFileIds: null,
      storageKey: "imports/org-1/job-1/manifest.json",
    } as never, context as never)

    expect(cancel).toHaveBeenCalledOnce()
    expect(pull).not.toHaveBeenCalled()
    expect(createImportedContractForRow).not.toHaveBeenCalled()
    expect(recordImportRowFailure).toHaveBeenCalledWith(
      { jobId: "job-1", rowIndex: 1, sourceRef: "imports/org-1/job-1/files/contract.pdf" },
      "file_too_large",
    )
  })
})
