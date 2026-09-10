import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/ai-status/route"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), config: vi.fn() }))
vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: mocks.auth }))
vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig: mocks.config }))
vi.mock("@/lib/db/client", () => ({ prisma: { orgAiConfig: { findUnique: vi.fn(async () => ({ provider: "openai", model: "stale-model" })) } } }))

describe("AI availability uses the actual effective provider configuration", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ organizationId: "org-1" }) })
  it("does not advertise a stored but unusable key as available", async () => {
    mocks.config.mockResolvedValue({ provider: null, apiKey: null, model: null, source: null })
    expect(await (await GET(new Request("http://localhost/api/ai-status"))).json()).toEqual({ provider: null, model: null, hasKey: false, source: null })
    expect(mocks.config).toHaveBeenCalledWith("org-1")
  })
  it("returns minimized availability for operator Ollama without an API key", async () => {
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: null, model: "local-test", source: "env" })
    expect(await (await GET(new Request("http://localhost/api/ai-status"))).json()).toEqual({ provider: "ollama", model: "local-test", hasKey: true, source: "env" })
  })
  it("never returns a resolved credential", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "synthetic-secret", model: "test-model", source: "org" })
    const body = await (await GET(new Request("http://localhost/api/ai-status"))).json()
    expect(body).toEqual({ provider: "openai", model: "test-model", hasKey: true, source: "org" })
  })
  it("requires authentication before resolving configuration", async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(new Request("http://localhost/api/ai-status"))).status).toBe(401)
    expect(mocks.config).not.toHaveBeenCalled()
  })
})
