import { describe, expect, it, vi } from "vitest"
import fc from "fast-check"

import {
  createInteractiveAiJobData,
  interactiveAiPayloadKey,
  processInteractiveAiRequest,
  type InteractiveAiProcessorDependencies,
} from "@/lib/jobs/interactive-ai"

const now = 1_800_000_000_000

function dependencies(overrides: Partial<InteractiveAiProcessorDependencies> = {}): InteractiveAiProcessorDependencies {
  return {
    now: () => now,
    findMembership: vi.fn().mockResolvedValue({ id: "member-1", role: "admin" }),
    findApiKey: vi.fn().mockResolvedValue({
      id: "key-1",
      organizationId: "org-1",
      createdById: "user-1",
      scopes: ["read", "text_read"],
      revokedAt: null,
      expiresAt: null,
    }),
    hasAgreementGrant: vi.fn().mockResolvedValue(true),
    findAuthorizedContractIds: vi.fn(async (_data, ids) => ids),
    execute: vi.fn().mockResolvedValue({ status: 200, body: { answer: "Synthetic answer" } }),
    ...overrides,
  }
}

const base = {
  jobId: "00000000-0000-4000-8000-000000000001",
  operation: "contract_question" as const,
  organizationId: "org-1",
  requestedByUserId: "user-1",
  requestedByMemberId: "member-1",
  source: "session" as const,
  apiKeyId: null,
  contractId: "contract-1",
  createdAt: now,
  expiresAt: now + 300_000,
}

describe("interactive AI worker boundary", () => {
  it("derives identity-bound Redis keys and keeps private input out of BullMQ data", () => {
    const data = createInteractiveAiJobData(base)
    expect(data.payloadKey).toBe(interactiveAiPayloadKey(data))
    const serialized = JSON.stringify(data)
    expect(serialized).not.toContain("What is the termination notice?")
    expect(serialized).not.toContain("Private clause")
    expect(serialized).not.toContain("sk-test-secret")
  })

  it("property: identity delimiters cannot collide Redis payload keys", () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 30 }),
      fc.string({ minLength: 1, maxLength: 30 }),
      fc.uuid(),
      fc.uuid(),
      (organizationId, memberId, firstJobId, secondJobId) => {
        fc.pre(firstJobId !== secondJobId)
        const first = interactiveAiPayloadKey({ organizationId, requestedByMemberId: memberId, jobId: firstJobId })
        const second = interactiveAiPayloadKey({ organizationId, requestedByMemberId: memberId, jobId: secondJobId })
        expect(first).not.toBe(second)
        expect(first).toContain(encodeURIComponent(organizationId))
        expect(first).toContain(encodeURIComponent(memberId))
      },
    ))
  })

  it("rejects expired and forged payload keys before reading private input", async () => {
    const loadPayload = vi.fn()
    const deps = dependencies()
    await expect(processInteractiveAiRequest({ ...createInteractiveAiJobData(base), expiresAt: now }, loadPayload, deps))
      .rejects.toThrow("expired")
    await expect(processInteractiveAiRequest({ ...createInteractiveAiJobData(base), payloadKey: "forged" }, loadPayload, deps))
      .rejects.toThrow("payload key")
    expect(loadPayload).not.toHaveBeenCalled()
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it("checks current membership before loading and again immediately before provider egress", async () => {
    const findMembership = vi.fn()
      .mockResolvedValueOnce({ id: "member-1", role: "member" })
      .mockResolvedValueOnce(null)
    const deps = dependencies({ findMembership })
    const loadPayload = vi.fn().mockResolvedValue({ operation: "contract_question", question: "Question" })
    await expect(processInteractiveAiRequest(createInteractiveAiJobData(base), loadPayload, deps))
      .rejects.toThrow("no longer authorized")
    expect(loadPayload).toHaveBeenCalledTimes(1)
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it("gives the executor a fresh authorization gate for every provider egress", async () => {
    const findMembership = vi.fn()
      .mockResolvedValueOnce({ id: "member-1", role: "member" })
      .mockResolvedValueOnce({ id: "member-1", role: "member" })
      .mockResolvedValueOnce(null)
    const execute = vi.fn(async (_data, _payload, assertAuthorizedForEgress) => {
      await assertAuthorizedForEgress()
      return { status: 200, body: { answer: "must not be returned" } }
    })
    const deps = dependencies({ findMembership, execute })
    const loadPayload = vi.fn().mockResolvedValue({ operation: "contract_question", question: "Question" })
    await expect(processInteractiveAiRequest(createInteractiveAiJobData(base), loadPayload, deps))
      .rejects.toThrow("no longer authorized")
    expect(execute).toHaveBeenCalledOnce()
  })

  it("discards a provider response when agreement access is revoked before completion", async () => {
    const hasAgreementGrant = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const execute = vi.fn().mockResolvedValue({ status: 200, body: { answer: "Stale private answer" } })
    const deps = dependencies({ hasAgreementGrant, execute })
    const loadPayload = vi.fn().mockResolvedValue({ operation: "contract_question", question: "Question" })
    await expect(processInteractiveAiRequest(createInteractiveAiJobData(base), loadPayload, deps))
      .rejects.toThrow("agreement access")
    expect(execute).toHaveBeenCalledOnce()
  })

  it("filters semantic results against current per-contract grants", async () => {
    const data = createInteractiveAiJobData({ ...base, operation: "semantic_search", contractId: null })
    const deps = dependencies({
      findAuthorizedContractIds: vi.fn().mockResolvedValue(["contract-allowed"]),
      execute: vi.fn().mockResolvedValue({ status: 200, body: {
        results: [{ id: "contract-allowed", title: "Allowed" }, { id: "contract-revoked", title: "Private" }],
        total: 2,
        mode: "semantic",
      } }),
    })
    const response = await processInteractiveAiRequest(
      data,
      vi.fn().mockResolvedValue({ operation: "semantic_search", query: "renewal", limit: 10, threshold: 0.3 }),
      deps,
    )
    expect(response.body).toEqual({ results: [{ id: "contract-allowed", title: "Allowed" }], total: 1, mode: "semantic" })
    expect(JSON.stringify(response)).not.toContain("Private")
  })

  it("requires an exact current grant for contract operations", async () => {
    const deps = dependencies({ hasAgreementGrant: vi.fn().mockResolvedValue(false) })
    const loadPayload = vi.fn().mockResolvedValue({ operation: "contract_question", question: "Question" })
    await expect(processInteractiveAiRequest(createInteractiveAiJobData(base), loadPayload, deps))
      .rejects.toThrow("agreement access")
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it("revalidates API-key creator membership, revocation, expiry and text_read scope", async () => {
    const loadPayload = vi.fn().mockResolvedValue({ operation: "contract_question", question: "Question" })
    for (const apiKey of [
      null,
      { id: "key-1", organizationId: "org-1", createdById: "user-1", scopes: ["read"], revokedAt: null, expiresAt: null },
      { id: "key-1", organizationId: "org-1", createdById: "user-1", scopes: ["text_read"], revokedAt: new Date(now - 1), expiresAt: null },
      { id: "key-1", organizationId: "org-1", createdById: "user-1", scopes: ["text_read"], revokedAt: null, expiresAt: new Date(now) },
    ]) {
      const deps = dependencies({ findApiKey: vi.fn().mockResolvedValue(apiKey) })
      await expect(processInteractiveAiRequest(createInteractiveAiJobData({ ...base, source: "api_key", apiKeyId: "key-1" }), loadPayload, deps))
        .rejects.toThrow("API key")
      expect(deps.execute).not.toHaveBeenCalled()
    }
  })

  it("requires a current admin session for connectivity tests", async () => {
    const deps = dependencies({ findMembership: vi.fn().mockResolvedValue({ id: "member-1", role: "legal" }) })
    const data = createInteractiveAiJobData({ ...base, operation: "config_test", contractId: null })
    const loadPayload = vi.fn().mockResolvedValue({ operation: "config_test", provider: "openai", encryptedCredential: "ciphertext", model: null })
    await expect(processInteractiveAiRequest(data, loadPayload, deps)).rejects.toThrow("admin")
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it("allows a current organization owner to run a connectivity test", async () => {
    const deps = dependencies({ findMembership: vi.fn().mockResolvedValue({ id: "member-1", role: "owner" }) })
    const data = createInteractiveAiJobData({ ...base, operation: "config_test", contractId: null })
    const loadPayload = vi.fn().mockResolvedValue({ operation: "config_test", provider: "openai", encryptedCredential: "ciphertext", model: null })
    await expect(processInteractiveAiRequest(data, loadPayload, deps)).resolves.toMatchObject({ status: 200 })
    expect(deps.execute).toHaveBeenCalledOnce()
  })
})
