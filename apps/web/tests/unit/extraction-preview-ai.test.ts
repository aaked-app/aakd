import { beforeEach, describe, expect, it, vi } from "vitest"

const resolveAiConfig = vi.fn()

vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig }))

describe("extraction preview AI boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  it("returns a partial result without making a request when AI is not configured", async () => {
    resolveAiConfig.mockResolvedValue({ provider: null, apiKey: null, model: null, source: null })
    const { runExtractionPreviewAi } = await import("@/lib/ai/extraction-preview")
    await expect(runExtractionPreviewAi("contract", "org-1")).resolves.toEqual({
      error: "ai_unavailable",
      partial: true,
      confidence: {},
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("uses the saved organization OpenAI configuration and validates bounded output", async () => {
    resolveAiConfig.mockResolvedValue({
      provider: "openai",
      apiKey: "private-key",
      model: "saved-model",
      source: "org",
    })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        contractType: "MSA",
        value: 12000,
        currency: "EUR",
        confidence: { contractType: 0.9 },
      }) } }],
    })))
    const { runExtractionPreviewAi } = await import("@/lib/ai/extraction-preview")
    await expect(runExtractionPreviewAi("contract", "org-1")).resolves.toMatchObject({
      contractType: "MSA",
      value: 12000,
      currency: "EUR",
    })
    expect(fetch).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({
      redirect: "error",
      headers: expect.objectContaining({ Authorization: "Bearer private-key" }),
    }))
  })

  it("validates a saved Ollama URL before sending contract text", async () => {
    resolveAiConfig.mockResolvedValue({
      provider: "ollama",
      apiKey: "http://ollama.internal:11434",
      model: "llama3.1",
      source: "org",
    })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      message: { content: JSON.stringify({ title: "Agreement", confidence: {} }) },
    })))
    const { runExtractionPreviewAi } = await import("@/lib/ai/extraction-preview")
    await expect(runExtractionPreviewAi("contract", "org-1")).resolves.toMatchObject({
      title: "Agreement",
    })
    expect(fetch).toHaveBeenCalledWith("http://ollama.internal:11434/api/chat", expect.objectContaining({ dispatcher: expect.any(Object), redirect: "error" }))
  })

  it("rejects oversized, malformed, or out-of-schema provider output generically", async () => {
    resolveAiConfig.mockResolvedValue({
      provider: "openai",
      apiKey: "private-key",
      model: "saved-model",
      source: "org",
    })
    const privateBody = `private-${"x".repeat(1024 * 1024)}`
    vi.mocked(fetch).mockResolvedValueOnce(new Response(privateBody))
    const { runExtractionPreviewAi } = await import("@/lib/ai/extraction-preview")
    const oversized = runExtractionPreviewAi("contract", "org-1")
    await expect(oversized).rejects.toThrow("AI extraction preview failed")
    await expect(oversized).rejects.not.toThrow("private-")

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ contractType: "invented" }) } }],
    })))
    await expect(runExtractionPreviewAi("contract", "org-1"))
      .rejects.toThrow("AI extraction preview failed")
  })

  it("sanitizes provider transport failures", async () => {
    resolveAiConfig.mockResolvedValue({
      provider: "openai",
      apiKey: "private-key",
      model: "saved-model",
      source: "org",
    })
    vi.mocked(fetch).mockRejectedValueOnce(new Error("quota body includes private-key"))
    const { runExtractionPreviewAi } = await import("@/lib/ai/extraction-preview")
    await expect(runExtractionPreviewAi("contract", "org-1"))
      .rejects.toThrow("AI extraction preview failed")
  })
})
