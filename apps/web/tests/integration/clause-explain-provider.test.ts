import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/contracts/[id]/clause-explain/route"

const mocks = vi.hoisted(() => ({ config: vi.fn(), validate: vi.fn(), error: vi.fn(), grant: vi.fn() }))
vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(async () => ({ userId: "user-1", memberId: "member-1", organizationId: "org-1", role: "owner", source: "session", requestId: "test" })) }))
vi.mock("@/lib/db/client", () => ({ prisma: { contract: { findUnique: vi.fn(async () => ({ id: "contract-1", organizationId: "org-1" })) }, contractAccessGrant: { findFirst: mocks.grant } } }))
vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig: mocks.config, withAiConfigCache: (fn: () => unknown) => fn() }))
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.error } }))
vi.mock("@/lib/jobs/interactive-ai-client", () => ({
  enqueueInteractiveAiRequest: async (ctx: { organizationId: string }, _operation: unknown, _contractId: unknown, payload: { clauseText: string }) => {
    const { explainContractClause } = await import("@/lib/ai/clause-explain")
    try {
      const body = await explainContractClause(payload.clauseText, ctx.organizationId)
      return { state: "completed", jobId: "00000000-0000-4000-8000-000000000001", response: body ? { status: 200, body } : { status: 503, body: { error: "ai_unavailable" } } }
    } catch (error) {
      mocks.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "[clause-explain] LLM call failed")
      return { state: "completed", jobId: "00000000-0000-4000-8000-000000000001", response: { status: 503, body: { error: "ai_call_failed" } } }
    }
  },
}))

function request(text = "Synthetic confidential clause") {
  return POST(new NextRequest("http://localhost/api/contracts/contract-1/clause-explain", { method: "POST", body: JSON.stringify({ text }) }), { params: Promise.resolve({ id: "contract-1" }) })
}

describe("Clause explanation provider boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.validate.mockResolvedValue(undefined); mocks.grant.mockResolvedValue({ id: "grant-1" }) })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it.each([" ", "\n\t", "\u00a0"])("rejects blank clauses before contacting AI", async text => {
    expect((await request(text)).status).toBe(400)
    expect(mocks.config).not.toHaveBeenCalled()
  })
  it("does not invoke AI for an ungranted organization owner", async () => {
    mocks.grant.mockResolvedValue(null)
    expect((await request()).status).toBe(404)
    expect(mocks.config).not.toHaveBeenCalled()
  })
  it("does not present unavailable configuration as a successful explanation", async () => {
    mocks.config.mockResolvedValue({ provider: null, apiKey: null, model: null, source: null })
    const response = await request()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "ai_unavailable" })
  })
  it("uses and validates the saved organization Ollama endpoint", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://operator:11434")
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://organization:11434/", model: "test-chat", source: "org" })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: { content: JSON.stringify({ explanation: "Example", risk: "low" }) } }))
    vi.stubGlobal("fetch", fetchMock)
    expect((await request()).status).toBe(200)
    expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined()
    expect(fetchMock).toHaveBeenCalledWith("http://organization:11434/api/chat", expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }))
  })
  it("rejects unsafe endpoints without sending contract content", async () => {
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://169.254.169.254", source: "org" })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect((await request()).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("Sensitive URL")
  })
  it("does not log provider bodies or credentials on failure", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "synthetic-key", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Synthetic confidential clause synthetic-key", { status: 400 })))
    expect((await request()).status).toBe(503)
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("synthetic-key")
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ errorType: "Error" }), expect.any(String))
  })
  it("rejects malformed explanation shapes rather than crashing the reader", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "synthetic-key", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ explanation: { unsafe: "object" }, risk: "invented" }) } }] })))
    const response = await request()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "ai_call_failed" })
  })
  it("does not invent a medium-risk finding from unstructured provider text", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "synthetic-key", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "This is not structured analysis." } }] })))
    const response = await request()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "ai_call_failed" })
  })
  it("rejects oversized upstream responses", async () => {
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://organization:11434", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: { content: "x".repeat(1024 * 1024) } })))
    expect((await request()).status).toBe(503)
  })
})
