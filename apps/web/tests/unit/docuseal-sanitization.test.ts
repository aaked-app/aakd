import { afterEach, describe, expect, it, vi } from "vitest"

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({ logger }))

describe("DocuSeal failure sanitization", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("does not log a non-OK getSubmission response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("UPSTREAM_BODY_TOPSECRET", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    })))
    const { getSubmission } = await import("@/lib/docuseal")

    await expect(getSubmission(42, {
      baseUrl: "https://203.0.113.10",
      apiKey: "synthetic-key",
    })).resolves.toBeNull()

    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("UPSTREAM_BODY_TOPSECRET")
  })

  it("rejects malformed provider success bodies instead of casting them", async () => {
    vi.stubEnv("DOCUSEAL_API_KEY", "operator-key")
    vi.stubEnv("DOCUSEAL_API_URL", "https://api.docuseal.example")
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 99, status: "completed", documents: [] }))
      .mockResolvedValueOnce(Response.json([{ submission_id: 42, slug: "", embed_src: "javascript:alert(1)" }]))
      .mockResolvedValueOnce(Response.json({ id: "not-a-number", schema: [] })))
    const { createSubmission, createTemplate, getSubmission } = await import("@/lib/docuseal")

    await expect(getSubmission(42)).resolves.toBeNull()
    await expect(createSubmission(7, [{ email: "a@example.test", name: "A", role: "Signer 1" }])).resolves.toBeNull()
    await expect(createTemplate("Agreement", Buffer.from("%PDF"))).resolves.toBeNull()
  })
})
