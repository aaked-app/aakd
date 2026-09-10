import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { POST } from "@/app/api/mcp/route"
import { createInteractiveAiJobData, interactiveAiResultKey, INTERACTIVE_AI_TTL_MS } from "@/lib/jobs/interactive-ai"
import { executeInteractiveAiOperation } from "@/lib/jobs/interactive-ai-executor"
import { processInteractiveAiJob } from "../../../../worker/jobs/interactive-ai"

const mocks = vi.hoisted(() => ({ answer: vi.fn(), enqueue: vi.fn() }))
vi.mock("@/lib/ai/answer", () => ({ answerContractQuestion: mocks.answer }))
vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig: vi.fn(async () => ({ provider: "anthropic" })) }))
vi.mock("@/lib/embedding", () => ({ generateEmbedding: vi.fn(async () => null) }))
vi.mock("@/lib/db/worker-client", () => ({ getWorkerPrisma: () => prisma }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })) }))
vi.mock("@/lib/jobs/interactive-ai-client", () => ({
  enqueueInteractiveAiRequest: mocks.enqueue,
  waitForInteractiveAiRequest: vi.fn(),
}))
vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(async () => ({ userId: "user-1", memberId: "member-1", organizationId: "org-1", role: "member", source: "api_key", apiKeyId: "key-1", scopes: ["read", "text_read"], requestId: "test" })) }))

function ask() {
  return POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ask_contract", arguments: { contractId: "contract-1", question: "When is notice due?" } } }) }))
}

describe("MCP contract question provider parity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("ANTHROPIC_API_KEY", "")
    vi.stubEnv("OPENAI_API_KEY", "")
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({ id: "contract-1", organizationId: "org-1", title: "Synthetic agreement", extractedText: "Give 45 days notice." } as never)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-1" } as never)
    mocks.enqueue.mockImplementation(async (ctx, operation, contractId, payload) => {
      const createdAt = Date.now()
      const data = createInteractiveAiJobData({
        jobId: "00000000-0000-4000-8000-000000000001",
        operation,
        organizationId: ctx.organizationId,
        requestedByUserId: ctx.userId,
        requestedByMemberId: ctx.memberId,
        source: ctx.source,
        apiKeyId: ctx.apiKeyId ?? null,
        contractId,
        createdAt,
        expiresAt: createdAt + INTERACTIVE_AI_TTL_MS,
      })
      const values = new Map([[data.payloadKey, JSON.stringify(payload)]])
      const client = {
        get: vi.fn(async (key: string) => values.get(key) ?? null),
        set: vi.fn(async (key: string, value: string) => { values.set(key, value); return "OK" }),
        del: vi.fn(async (key: string) => Number(values.delete(key))),
      }
      await processInteractiveAiJob({ data } as never, client as never, {
        now: () => Date.now(),
        findMembership: vi.fn(async () => ({ id: "member-1", role: "member" })),
        findApiKey: vi.fn(async () => ({ id: "key-1", organizationId: "org-1", createdById: "user-1", scopes: ["read", "text_read"], revokedAt: null, expiresAt: null })),
        hasAgreementGrant: vi.fn(async () => true),
        findAuthorizedContractIds: vi.fn(async () => []),
        execute: executeInteractiveAiOperation,
      })
      return {
        state: "completed" as const,
        jobId: data.jobId,
        response: JSON.parse(values.get(interactiveAiResultKey(data))!),
      }
    })
  })
  afterEach(() => vi.unstubAllEnvs())
  it("uses the shared organization-configured answer without requiring a server API key", async () => {
    mocks.answer.mockResolvedValue("Give 45 days notice.")
    const body = await (await ask()).json()
    expect(body.result.isError).not.toBe(true)
    expect(JSON.parse(body.result.content[0].text).answer).toBe("Give 45 days notice.")
    expect(mocks.answer).toHaveBeenCalledWith(
      "Synthetic agreement",
      expect.stringContaining("Give 45 days notice."),
      "When is notice due?",
      "org-1",
    )
  })
  it("does not return raw provider failures to an MCP client", async () => {
    mocks.answer.mockRejectedValue(new Error("synthetic-private-provider-response"))
    const body = await (await ask()).json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toBe("Error: AI call failed")
  })
})
