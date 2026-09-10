import { describe, expect, it, vi } from "vitest"
import { processInteractiveAiJob } from "../../../../worker/jobs/interactive-ai"

const data = {
  jobId: "00000000-0000-4000-8000-000000000001",
  operation: "semantic_search" as const,
  organizationId: "org-1",
  requestedByUserId: "user-1",
  requestedByMemberId: "member-1",
  source: "session" as const,
  apiKeyId: null,
  contractId: null,
  payloadKey: "aakd:ai-request:org-1:member-1:00000000-0000-4000-8000-000000000001:payload",
  createdAt: 1_800_000_000_000,
  expiresAt: 1_800_000_300_000,
}

describe("interactive AI job runner", () => {
  it("stores a validated result with the same absolute expiry and deletes the private payload", async () => {
    const client = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ operation: "semantic_search", query: "renewal", limit: 10, threshold: 0.3 })),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    }
    const dependencies = {
      now: () => 1_800_000_000_001,
      findMembership: vi.fn().mockResolvedValue({ id: "member-1", role: "member" }),
      findApiKey: vi.fn(),
      hasAgreementGrant: vi.fn(),
      findAuthorizedContractIds: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ status: 200, body: { results: [], total: 0, mode: "keyword" } }),
    }
    await expect(processInteractiveAiJob({ data } as never, client, dependencies)).resolves.toEqual({ ready: true })
    expect(client.set).toHaveBeenCalledWith(expect.stringMatching(/:result$/), expect.not.stringContaining("renewal"), "PXAT", data.expiresAt)
    expect(client.del).toHaveBeenCalledWith(data.payloadKey)
  })

  it("deletes the payload and stores no result when authorization fails", async () => {
    const client = { get: vi.fn(), set: vi.fn(), del: vi.fn().mockResolvedValue(1) }
    const dependencies = {
      now: () => 1_800_000_000_001,
      findMembership: vi.fn().mockResolvedValue(null),
      findApiKey: vi.fn(),
      hasAgreementGrant: vi.fn(),
      findAuthorizedContractIds: vi.fn(),
      execute: vi.fn(),
    }
    await expect(processInteractiveAiJob({ data } as never, client, dependencies)).rejects.toThrow("authorized")
    expect(client.get).not.toHaveBeenCalled()
    expect(client.set).not.toHaveBeenCalled()
    expect(client.del).toHaveBeenCalledWith(data.payloadKey)
  })
})
