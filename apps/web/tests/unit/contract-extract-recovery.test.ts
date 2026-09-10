// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import {
  contractEmbedJobId,
  ensureContractEmbedQueued,
  type SourceBoundContractEmbedJobData,
} from "@/lib/jobs/contract-extract-recovery"

const data: SourceBoundContractEmbedJobData = {
  contractId: "contract-a",
  organizationId: "org-a",
  extractedText: "authoritative text",
  sourceFileId: "file-a",
  sourceFileVersion: 2,
  sourceHash: "a".repeat(64),
  preserveUserFields: true,
}

function job(state: string) {
  return {
    getState: vi.fn().mockResolvedValue(state),
    retry: vi.fn().mockResolvedValue(undefined),
    updateData: vi.fn().mockResolvedValue(undefined),
  }
}

describe("contract extraction downstream recovery", () => {
  it("uses the complete immutable source identity in a BullMQ-compatible job id", () => {
    expect(contractEmbedJobId(data)).toBe(`contract-embed-contract-a-file-a-2-${"a".repeat(64)}`)
    expect(contractEmbedJobId({ ...data, sourceFileId: "file-b" })).not.toBe(contractEmbedJobId(data))
  })

  it("surfaces a first enqueue failure so the extraction job is retried after its durable commit", async () => {
    const queue = { add: vi.fn().mockRejectedValue(new Error("Redis unavailable")) }
    await expect(ensureContractEmbedQueued(queue as never, data)).rejects.toThrow("Redis unavailable")
  })

  it.each(["waiting", "active", "delayed", "prioritized", "waiting-children", "completed"])("does not duplicate a %s job", async (state) => {
    const existing = job(state)
    const queue = { add: vi.fn().mockResolvedValue(existing) }
    await ensureContractEmbedQueued(queue as never, data)
    expect(queue.add).toHaveBeenCalledWith("embed", data, { jobId: contractEmbedJobId(data) })
    expect(existing.retry).not.toHaveBeenCalled()
  })

  it("retries the exact retained terminal failure", async () => {
    const existing = job("failed")
    const queue = { add: vi.fn().mockResolvedValue(existing) }
    await ensureContractEmbedQueued(queue as never, data)
    expect(existing.retry).toHaveBeenCalledOnce()
    expect(existing.updateData).toHaveBeenCalledWith(data)
  })

  it("accepts a retry race only when another worker made the job durable", async () => {
    const existing = job("failed")
    existing.retry.mockRejectedValueOnce(new Error("state changed"))
    existing.getState.mockResolvedValueOnce("failed").mockResolvedValueOnce("active")
    const queue = { add: vi.fn().mockResolvedValue(existing) }
    await expect(ensureContractEmbedQueued(queue as never, data)).resolves.toBeUndefined()
  })

  it("does not hide a retry failure that remains terminal", async () => {
    const existing = job("failed")
    existing.retry.mockRejectedValueOnce(new Error("retry rejected"))
    existing.getState.mockResolvedValue("failed")
    const queue = { add: vi.fn().mockResolvedValue(existing) }
    await expect(ensureContractEmbedQueued(queue as never, data)).rejects.toThrow("retry rejected")
  })

  it("rejects an unknown state instead of mistaking a removed job for a durable handoff", async () => {
    const queue = { add: vi.fn().mockResolvedValue(job("unknown")) }
    await expect(ensureContractEmbedQueued(queue as never, data)).rejects.toThrow("did not reach a durable queue state")
  })
})
