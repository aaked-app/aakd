/**
 * Regression test for the ImportRow duplicate-on-retry bug: flushOutcomes
 * (apps/web/lib/import/handlers/csv.ts) used to call createMany, which would
 * either violate the ImportRow unique(jobId, rowIndex) constraint or insert
 * a second row for a rowIndex that already had one from a prior run. It now
 * upserts on (jobId, rowIndex) so a retry updates the existing row in place.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/worker-client", () => {
  const db: any = {
    importRow: { upsert: vi.fn().mockResolvedValue({}) },
  }
  return { getWorkerPrisma: vi.fn().mockReturnValue(db) }
})

import { getWorkerPrisma } from "@/lib/db/worker-client"
import { flushOutcomes } from "@/lib/import/handlers/csv"

describe("flushOutcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("upserts on (jobId, rowIndex) instead of blind-inserting", async () => {
    const db = getWorkerPrisma() as any

    await flushOutcomes("job-1", [
      { rowIndex: 1, sourceRef: "row-1", status: "success", contractId: "c-1" },
    ])

    expect(db.importRow.upsert).toHaveBeenCalledTimes(1)
    expect(db.importRow.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId_rowIndex: { jobId: "job-1", rowIndex: 1 } },
      }),
    )
  })

  it("clears a stale error message when a retried row now succeeds", async () => {
    const db = getWorkerPrisma() as any

    await flushOutcomes("job-1", [
      { rowIndex: 1, sourceRef: "row-1", status: "success", contractId: "c-1" },
    ])

    const call = db.importRow.upsert.mock.calls[0][0]
    expect(call.update).toMatchObject({
      status: "success",
      contractId: "c-1",
      errorMessage: null,
    })
  })

  it("clears a stale contractId when a retried row now fails", async () => {
    const db = getWorkerPrisma() as any

    await flushOutcomes("job-1", [
      { rowIndex: 1, sourceRef: "row-1", status: "failed", errorMessage: "boom" },
    ])

    const call = db.importRow.upsert.mock.calls[0][0]
    expect(call.update).toMatchObject({
      status: "failed",
      errorMessage: "boom",
      contractId: null,
    })
  })

  it("upserts every row in the batch", async () => {
    const db = getWorkerPrisma() as any

    await flushOutcomes("job-1", [
      { rowIndex: 1, sourceRef: "row-1", status: "success", contractId: "c-1" },
      { rowIndex: 2, sourceRef: "row-2", status: "failed", errorMessage: "bad" },
    ])

    expect(db.importRow.upsert).toHaveBeenCalledTimes(2)
  })

  it("is a no-op for an empty batch", async () => {
    const db = getWorkerPrisma() as any

    await flushOutcomes("job-1", [])

    expect(db.importRow.upsert).not.toHaveBeenCalled()
  })
})
