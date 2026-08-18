/**
 * Integration tests for POST /api/org/ai-config/test — Ollama branch.
 *
 * Covers the self-host-safe SSRF guard (validateOllamaTestUrl): loopback and
 * link-local/metadata targets must be rejected, while RFC-1918 LAN addresses
 * (a self-hosted Ollama server's real deployment target) must stay allowed.
 * Also covers the admin-only role requirement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "test-request-id",
}

const legalCtx = { ...adminCtx, userId: "user-legal", role: "legal" }

let mockCtx: typeof adminCtx | null = adminCtx

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(() => Promise.resolve(mockCtx)),
}))

describe("POST /api/org/ai-config/test — ollama SSRF guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx = adminCtx
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it("allows an RFC-1918 LAN address through to fetch (self-hosted Ollama)", async () => {
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
