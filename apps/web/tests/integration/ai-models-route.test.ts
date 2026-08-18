import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "test-request-id",
}

let mockCtx: typeof adminCtx | null = adminCtx

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(() => Promise.resolve(mockCtx)),
}))

describe("POST /api/org/ai-config/models", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx = adminCtx
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
})
