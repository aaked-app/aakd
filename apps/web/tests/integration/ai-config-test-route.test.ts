/**
 * Integration tests for POST /api/org/ai-config/test — Ollama branch.
 *
 * Covers the self-host-safe SSRF guard (validateOllamaTestUrl): loopback and
 * link-local/metadata targets must be rejected, while RFC-1918 LAN addresses
 * (a self-hosted Ollama server's real deployment target) must stay allowed.
 * Also covers the admin-only role requirement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  loggerError: vi.fn(),
}))

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  memberId: "member-admin",
  role: "admin",
  source: "session" as const,
  requestId: "test-request-id",
}

type MockContext = typeof adminCtx | {
  userId: string
  organizationId: string
  role: string
  source: "api_key"
  requestId: string
  scopes: string[]
}

const legalCtx = { ...adminCtx, userId: "user-legal", role: "legal" }

let mockCtx: MockContext | null = adminCtx

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(() => Promise.resolve(mockCtx)),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  rateLimitResponse: (retryAfter: number) => Response.json(
    { error: "Rate limit exceeded", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  ),
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError },
}))

vi.mock("@/lib/notifications/crypto", () => ({ encrypt: (value: string) => value, decrypt: (value: string) => value }))
vi.mock("@/lib/jobs/interactive-ai-client", () => ({
  enqueueInteractiveAiRequest: async (_ctx: unknown, _operation: unknown, _contractId: unknown, payload: {
    provider: "anthropic" | "openai" | "ollama"; encryptedCredential: string; model: string | null
  }) => {
    const { testAiProviderConnection } = await import("@/lib/ai/config-test")
    const body = await testAiProviderConnection({ provider: payload.provider, credential: payload.encryptedCredential, model: payload.model })
    return { state: "completed", jobId: "00000000-0000-4000-8000-000000000001", response: { status: 200, body } }
  },
}))

function providerRequest(provider: "anthropic" | "openai", apiKey = "test-key-do-not-log") {
  return new Request("http://localhost/api/org/ai-config/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey, model: provider === "anthropic" ? "claude-test" : "gpt-test" }),
  })
}

describe("POST /api/org/ai-config/test — ollama SSRF guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "")
    mockCtx = adminCtx
    mocks.rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(["openai", "anthropic"] as const)("rejects blank %s keys before provider egress", async provider => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/test/route")
    expect((await POST(providerRequest(provider, "  "))).status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each(["openai", "anthropic"] as const)("does not accept malformed %s success bodies", async provider => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("private-marker not JSON"))
    const { POST } = await import("@/app/api/org/ai-config/test/route")
    const body = await (await POST(providerRequest(provider))).json()
    expect(body.valid).toBe(false)
    expect(JSON.stringify([body, mocks.loggerError.mock.calls])).not.toContain("private-marker")
    expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: "error" }))
  })

  it("rejects a loopback/link-local target (cloud metadata IP) without ever calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(
      new Request("http://localhost/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "ollama", baseUrl: "http://169.254.169.254" }),
      }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("denies an RFC-1918 LAN address unless the operator approved its exact origin", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(
      new Request("http://localhost/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "ollama", baseUrl: "http://192.168.1.10:11434" }),
      }),
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ valid: false, error: "This Ollama URL is not allowed" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("allows an RFC-1918 LAN address only when its exact origin is operator-approved", async () => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "http://192.168.1.10:11434")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(
      new Request("http://localhost/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "ollama", baseUrl: "http://192.168.1.10:11434" }),
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it("passes the selected Ollama model through to the installed-model check", async () => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "http://192.168.1.10:11434")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: "qwen3:8b" }] }), { status: 200 }),
    )
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(
      new Request("http://localhost/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "ollama", baseUrl: "http://192.168.1.10:11434", model: "qwen3:8b" }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).valid).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it("accepts a blank cloud model and lets the provider default apply", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_test" }), { status: 200 }),
    )
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(
      new Request("http://localhost/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "anthropic", apiKey: "sk-ant-test", model: "" }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).valid).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const requestInit = fetchSpy.mock.calls[0]?.[1]
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({ model: "claude-haiku-4-5" })
  })

  it("returns valid only after OpenAI accepts the test request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "chat_test" }), { status: 200 }))
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(providerRequest("openai"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ valid: true })
  })

  it.each([
    ["anthropic", 400, "Anthropic rejected the test request. Check the selected model and account access."],
    ["anthropic", 429, "Anthropic rate limit or quota exceeded. Try again later or check your provider account."],
    ["anthropic", 503, "Anthropic is temporarily unavailable (HTTP 503). Try again later."],
    ["openai", 400, "OpenAI rejected the test request. Check the selected model and account access."],
    ["openai", 429, "OpenAI rate limit or quota exceeded. Try again later or check your provider account."],
    ["openai", 503, "OpenAI is temporarily unavailable (HTTP 503). Try again later."],
  ] as const)("does not report %s HTTP %i as a successful provider test", async (provider, status, error) => {
    const upstreamMarker = `private-provider-body-${provider}-${status}`
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: upstreamMarker } }), { status }))
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(providerRequest(provider))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ valid: false, error })
    const logs = JSON.stringify(mocks.loggerError.mock.calls)
    expect(logs).not.toContain(upstreamMarker)
    expect(logs).not.toContain("test-key-do-not-log")
  })

  it.each([
    ["anthropic", 401, "Invalid API key"],
    ["anthropic", 403, "Anthropic API key lacks access to the selected model."],
    ["openai", 401, "Invalid API key"],
    ["openai", 403, "OpenAI API key lacks access to the selected model."],
  ] as const)("reports an actionable %s credential failure for HTTP %i without exposing the upstream body", async (provider, status, error) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream authentication detail", { status }))
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(providerRequest(provider))

    await expect(res.json()).resolves.toEqual({ valid: false, error })
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain("upstream authentication detail")
  })

  it("sanitizes provider connectivity failures before logging", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failed with test-key-do-not-log"))
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(providerRequest("openai"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ valid: false, error: "Network error — unable to reach provider" })
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain("test-key-do-not-log")
  })

  it("does not echo an internal Ollama URL when the upstream server fails", async () => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "http://192.168.1.10:11434")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("private response", { status: 502 }))
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(new Request("http://localhost/api/org/ai-config/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "ollama", baseUrl: "http://192.168.1.10:11434" }),
    }))
    const body = await res.json()

    expect(body).toEqual({ valid: false, error: "Ollama server responded with 502. Check that it is running and reachable." })
    expect(JSON.stringify(body)).not.toContain("192.168.1.10")
  })

  it("requires a human session before testing provider credentials", async () => {
    mockCtx = {
      userId: "api-key-owner",
      organizationId: "org-1",
      role: "admin",
      source: "api_key",
      requestId: "api-key-request",
      scopes: ["write"],
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(providerRequest("openai"))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "human_session_required" })
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("preserves the per-organization rate limit before making a provider request", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 17 })
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(providerRequest("openai"))

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("17")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns 403 for a 'legal' role — endpoint is admin-only", async () => {
    mockCtx = legalCtx
    const { POST } = await import("@/app/api/org/ai-config/test/route")

    const res = await POST(
      new Request("http://localhost/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "ollama", baseUrl: "http://192.168.1.10:11434" }),
      }),
    )

    expect(res.status).toBe(403)
  })
})
