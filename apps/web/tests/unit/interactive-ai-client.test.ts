import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const client = { set: vi.fn(), get: vi.fn(), del: vi.fn() }
  const job = { data: null as unknown, waitUntilFinished: vi.fn(), getState: vi.fn() }
  const queue = { client: Promise.resolve(client), add: vi.fn(), getJob: vi.fn() }
  const authorization = {
    now: vi.fn(),
    findMembership: vi.fn(),
    findApiKey: vi.fn(),
    hasAgreementGrant: vi.fn(),
    findAuthorizedContractIds: vi.fn(),
    execute: vi.fn(),
  }
  return { client, job, queue, authorization }
})

vi.mock("bullmq", () => ({ QueueEvents: class QueueEvents { close = vi.fn() } }))
vi.mock("@/lib/jobs/queues", () => ({ getInteractiveAiQueue: () => mocks.queue }))
vi.mock("@/lib/jobs/interactive-ai-executor", () => ({ interactiveAiProcessorDependencies: mocks.authorization }))

const ctx = {
  userId: "user-1",
  organizationId: "org-1",
  memberId: "member-1",
  role: "member",
  source: "session" as const,
  requestId: "request-1",
}

describe("interactive AI request client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000)
    mocks.queue.add.mockImplementation(async (_name, data) => {
      mocks.job.data = data
      return mocks.job
    })
    mocks.job.waitUntilFinished.mockResolvedValue({ ready: true })
    mocks.job.getState.mockResolvedValue("completed")
    mocks.client.set.mockResolvedValue("OK")
    mocks.client.del.mockResolvedValue(1)
    mocks.authorization.now.mockReturnValue(1_800_000_000_000)
    mocks.authorization.findMembership.mockResolvedValue({ id: "member-1", role: "member" })
    mocks.authorization.findApiKey.mockResolvedValue(null)
    mocks.authorization.hasAgreementGrant.mockResolvedValue(true)
    mocks.authorization.findAuthorizedContractIds.mockImplementation(async (_data, ids) => ids)
    mocks.client.get.mockImplementation(async (key: string) => key.endsWith(":result")
      ? JSON.stringify({ status: 200, body: { answer: "Synthetic" } })
      : null)
  })

  it("stores private payload only in an identity-bound PXAT key and keeps BullMQ metadata clean", async () => {
    const { enqueueInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    const result = await enqueueInteractiveAiRequest(ctx, "contract_question", "contract-1", {
      operation: "contract_question",
      question: "Private termination question",
    }, 35_000)
    expect(result.state).toBe("completed")
    const [, payload, mode, expiresAt] = mocks.client.set.mock.calls[0]
    expect(String(mocks.client.set.mock.calls[0][0])).toMatch(/^aakd:ai-request:org-1:member-1:[0-9a-f-]+:payload$/)
    expect(payload).toContain("Private termination question")
    expect(mode).toBe("PXAT")
    expect(expiresAt).toBe(1_800_000_300_000)
    const bullData = mocks.queue.add.mock.calls[0][1]
    expect(JSON.stringify(bullData)).not.toContain("Private termination question")
    expect(bullData.expiresAt).toBe(1_800_000_300_000)
  })

  it("returns pending without retrying when the bounded wait expires", async () => {
    mocks.job.waitUntilFinished.mockRejectedValueOnce(new Error("timed out"))
    mocks.job.getState.mockResolvedValueOnce("active")
    mocks.client.get.mockResolvedValue(null)
    const { enqueueInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    await expect(enqueueInteractiveAiRequest(ctx, "semantic_search", null, {
      operation: "semantic_search", query: "renewal", limit: 10, threshold: 0.3,
    }, 35_000)).resolves.toMatchObject({ state: "pending" })
    expect(mocks.queue.add).toHaveBeenCalledOnce()
  })

  it("does not read a result for another organization, member, user, source, or API key", async () => {
    const { newInteractiveAiJobData } = await import("@/lib/jobs/interactive-ai")
    const data = newInteractiveAiJobData({ operation: "semantic_search", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: null })
    mocks.queue.getJob.mockResolvedValue({ data, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    const { readInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    for (const other of [
      { ...ctx, organizationId: "org-2" },
      { ...ctx, memberId: "member-2" },
      { ...ctx, userId: "user-2" },
      { ...ctx, source: "api_key" as const, apiKeyId: "key-2" },
    ]) {
      await expect(readInteractiveAiRequest(other, data.jobId)).resolves.toBeNull()
    }
    expect(mocks.client.get).not.toHaveBeenCalled()
  })

  it("returns the stored result only to the exact current principal", async () => {
    const { newInteractiveAiJobData } = await import("@/lib/jobs/interactive-ai")
    const data = newInteractiveAiJobData({ operation: "semantic_search", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: null })
    mocks.queue.getJob.mockResolvedValue({ data, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    const { readInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    await expect(readInteractiveAiRequest(ctx, data.jobId)).resolves.toMatchObject({ state: "completed", response: { status: 200 } })
  })

  it("bounds each owned continuation wait and preserves the same pending job", async () => {
    const { newInteractiveAiJobData } = await import("@/lib/jobs/interactive-ai")
    const data = newInteractiveAiJobData({ operation: "semantic_search", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: null })
    mocks.queue.getJob.mockResolvedValue({ data, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    mocks.client.get.mockResolvedValue(null)
    mocks.job.waitUntilFinished.mockRejectedValueOnce(new Error("timed out"))
    mocks.job.getState.mockResolvedValueOnce("active")
    const { waitForInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    await expect(waitForInteractiveAiRequest(ctx, data.jobId)).resolves.toEqual({ state: "pending", jobId: data.jobId })
    expect(mocks.job.waitUntilFinished).toHaveBeenCalledWith(expect.anything(), 35_000)
    expect(mocks.queue.add).not.toHaveBeenCalled()
  })

  it("deletes a cached contract answer instead of returning it after grant revocation", async () => {
    const { newInteractiveAiJobData, interactiveAiResultKey } = await import("@/lib/jobs/interactive-ai")
    const data = newInteractiveAiJobData({ operation: "contract_question", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: "contract-1" })
    mocks.queue.getJob.mockResolvedValue({ data, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    mocks.authorization.hasAgreementGrant.mockResolvedValue(false)
    mocks.client.get.mockResolvedValue(JSON.stringify({ status: 200, body: { answer: "Stale private answer" } }))
    const { readInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    const result = await readInteractiveAiRequest(ctx, data.jobId)
    expect(result).toEqual({ state: "failed", jobId: data.jobId })
    expect(JSON.stringify(result)).not.toContain("Stale private answer")
    expect(mocks.client.del).toHaveBeenCalledWith(interactiveAiResultKey(data))
  })

  it("deletes a cached answer when the same API key loses text_read scope", async () => {
    const { newInteractiveAiJobData, interactiveAiResultKey } = await import("@/lib/jobs/interactive-ai")
    const data = newInteractiveAiJobData({ operation: "contract_question", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "api_key", apiKeyId: "key-1", contractId: "contract-1" })
    const apiCtx = { ...ctx, source: "api_key" as const, apiKeyId: "key-1", scopes: ["read"] }
    mocks.queue.getJob.mockResolvedValue({ data, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    mocks.authorization.findApiKey.mockResolvedValue({ id: "key-1", organizationId: "org-1", createdById: "user-1", scopes: ["read"], revokedAt: null, expiresAt: null })
    mocks.client.get.mockResolvedValue(JSON.stringify({ status: 200, body: { answer: "Stale private answer" } }))
    const { readInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    const result = await readInteractiveAiRequest(apiCtx, data.jobId)
    expect(result).toEqual({ state: "failed", jobId: data.jobId })
    expect(mocks.client.del).toHaveBeenCalledWith(interactiveAiResultKey(data))
  })

  it("rewrites cached semantic results to current grants without leaking revoked metadata", async () => {
    const { newInteractiveAiJobData, interactiveAiResultKey } = await import("@/lib/jobs/interactive-ai")
    const data = newInteractiveAiJobData({ operation: "semantic_search", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: null })
    mocks.queue.getJob.mockResolvedValue({ data, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    mocks.authorization.findAuthorizedContractIds.mockResolvedValue(["contract-allowed"])
    mocks.client.get.mockResolvedValue(JSON.stringify({ status: 200, body: {
      results: [{ id: "contract-allowed", title: "Allowed" }, { id: "contract-revoked", title: "Private title" }],
      total: 2,
      mode: "semantic",
    } }))
    const { readInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    const result = await readInteractiveAiRequest(ctx, data.jobId)
    expect(result).toMatchObject({ state: "completed", response: { body: { total: 1 } } })
    expect(JSON.stringify(result)).not.toContain("Private title")
    expect(mocks.client.set).toHaveBeenCalledWith(
      interactiveAiResultKey(data),
      expect.not.stringContaining("Private title"),
      "KEEPTTL",
    )
  })

  it("purges cached config results after admin downgrade and all results during emergency deny-all", async () => {
    const { newInteractiveAiJobData, interactiveAiResultKey } = await import("@/lib/jobs/interactive-ai")
    const configData = newInteractiveAiJobData({ operation: "config_test", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: null })
    mocks.queue.getJob.mockResolvedValue({ data: configData, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    mocks.client.get.mockResolvedValue(JSON.stringify({ status: 200, body: { valid: true } }))
    mocks.authorization.findMembership.mockResolvedValue({ id: "member-1", role: "member" })
    const { readInteractiveAiRequest } = await import("@/lib/jobs/interactive-ai-client")
    await expect(readInteractiveAiRequest(ctx, configData.jobId)).resolves.toEqual({ state: "failed", jobId: configData.jobId })
    expect(mocks.client.del).toHaveBeenCalledWith(interactiveAiResultKey(configData))

    const semanticData = newInteractiveAiJobData({ operation: "semantic_search", organizationId: "org-1", requestedByUserId: "user-1", requestedByMemberId: "member-1", source: "session", apiKeyId: null, contractId: null })
    mocks.queue.getJob.mockResolvedValue({ data: semanticData, getState: mocks.job.getState, waitUntilFinished: mocks.job.waitUntilFinished })
    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
    await expect(readInteractiveAiRequest(ctx, semanticData.jobId)).resolves.toEqual({ state: "failed", jobId: semanticData.jobId })
    expect(mocks.client.del).toHaveBeenCalledWith(interactiveAiResultKey(semanticData))
  })
})

describe("interactive AI browser continuation", () => {
  it("continues the same owned job through repeated pending responses", async () => {
    const pending = Response.json({ status: "pending", jobId: "00000000-0000-4000-8000-000000000001" }, { status: 202 })
    const follow = new Response(JSON.stringify({ answer: "Done" }), { status: 200 })
    const fetchMock = vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(follow)
    vi.stubGlobal("fetch", fetchMock)
    const { resolveInteractiveResponse } = await import("@/lib/ai/resolve-interactive-response")
    const initial = Response.json({ status: "pending", jobId: "00000000-0000-4000-8000-000000000001" }, { status: 202 })
    await expect(resolveInteractiveResponse(initial)).resolves.toBe(follow)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith("/api/ai-requests/00000000-0000-4000-8000-000000000001", { signal: undefined })
  })

  it("stops at the five-minute request TTL without creating another job", async () => {
    const initial = Response.json({ status: "pending", jobId: "00000000-0000-4000-8000-000000000001" }, { status: 202 })
    vi.spyOn(Date, "now").mockReturnValueOnce(1_800_000_000_000).mockReturnValueOnce(1_800_000_300_000)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { resolveInteractiveResponse } = await import("@/lib/ai/resolve-interactive-response")
    const response = await resolveInteractiveResponse(initial)
    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("honors caller cancellation before a continuation request", async () => {
    const controller = new AbortController()
    controller.abort(new DOMException("Cancelled", "AbortError"))
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { resolveInteractiveResponse } = await import("@/lib/ai/resolve-interactive-response")
    const initial = Response.json({ status: "pending", jobId: "00000000-0000-4000-8000-000000000001" }, { status: 202 })
    await expect(resolveInteractiveResponse(initial, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
