import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
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

let mockCtx: MockContext | null = adminCtx

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(() => Promise.resolve(mockCtx)),
}))

describe("POST /api/org/ai-config/models", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx = adminCtx
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(["openai", "anthropic"])("rejects blank %s credentials before a request", async provider => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const response = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST", body: JSON.stringify({ provider, apiKey: "  " }),
    }))
    expect(response.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("bounds provider discovery responses and prohibits redirects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("private-marker".repeat(100_000)))
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const response = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST", body: JSON.stringify({ provider: "openai", apiKey: "synthetic" }),
    }))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain("private-marker")
    expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }))
  })

  it("returns model IDs discovered from OpenAI without exposing the key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "gpt-new" }, { id: "text-embedding-3-small" }] }), { status: 200 }),
    )
    const { POST } = await import("@/app/api/org/ai-config/models/route")

    const res = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", apiKey: "sk-secret" }),
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ models: ["gpt-new", "text-embedding-3-small"] })
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({ headers: { Authorization: "Bearer sk-secret" } }),
    )
  })

  it("returns model IDs discovered from Anthropic", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "claude-new" }] }), { status: 200 }),
    )
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const res = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "anthropic", apiKey: "sk-ant-secret" }),
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ models: ["claude-new"] })
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({ headers: { "x-api-key": "sk-ant-secret", "anthropic-version": "2023-06-01" } }),
    )
  })

  it("denies model discovery from an unapproved private Ollama origin", async () => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const res = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "ollama", baseUrl: "http://10.20.30.40:11434" }),
    }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ models: [], error: "This Ollama URL is not allowed" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("discovers models from an exact operator-approved private Ollama origin", async () => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "http://10.20.30.40:11434")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: "local-model" }] }), { status: 200 }),
    )
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const res = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "ollama", baseUrl: "http://10.20.30.40:11434" }),
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ models: ["local-model"] })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it("rejects non-admin access", async () => {
    mockCtx = { ...adminCtx, role: "legal" }
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const res = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", apiKey: "sk-secret" }),
    }))

    expect(res.status).toBe(403)
  })

  it("requires a human session before accepting provider credentials or an Ollama URL", async () => {
    mockCtx = {
      userId: "api-key-owner",
      organizationId: "org-1",
      role: "admin",
      source: "api_key",
      requestId: "api-key-request",
      scopes: ["read", "write"],
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: "private-model" }] }), { status: 200 }),
    )
    const { POST } = await import("@/app/api/org/ai-config/models/route")
    const res = await POST(new Request("http://localhost/api/org/ai-config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "ollama", baseUrl: "http://192.168.1.10:11434" }),
    }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "human_session_required" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
