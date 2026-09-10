// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { analyzeContractRisk } from "@/lib/ai/risk"
import { resolveAiConfig } from "@/lib/ai/resolve"

const providerCalls = vi.hoisted(() => ({ anthropic: vi.fn(), openai: vi.fn() }))
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: providerCalls.anthropic } } }))
vi.mock("openai", () => ({ default: class { chat = { completions: { create: providerCalls.openai } } } }))

vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig: vi.fn() }))

describe("Risk analysis provider configuration", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })
  it("caps OpenAI risk output", async () => {
    vi.mocked(resolveAiConfig).mockResolvedValue({ provider: "openai", apiKey: "synthetic-key", model: "test-chat", source: "org" })
    providerCalls.openai.mockResolvedValue({ choices: [{ message: { content: "{}" } }] })
    await analyzeContractRisk("Synthetic terms", "org-1")
    expect(providerCalls.openai).toHaveBeenCalledWith(expect.objectContaining({ max_completion_tokens: 2048 }), expect.any(Object))
  })
  it("bounds organization-hosted provider response bodies", async () => {
    vi.mocked(resolveAiConfig).mockResolvedValue({ provider: "ollama", apiKey: "http://organization-ollama:11434", model: "test-chat", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ response: JSON.stringify({ padding: "x".repeat(1024 * 1024) }) })))
    await expect(analyzeContractRisk("Synthetic terms", "org-1")).rejects.toThrow("AI risk analysis failed")
  })
  it("uses the saved organization Ollama URL, not a different operator endpoint", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://operator-ollama:11434")
    vi.mocked(resolveAiConfig).mockResolvedValue({ provider: "ollama", apiKey: "http://organization-ollama:11434/", model: "test-chat", source: "org" })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ response: "{}" }))
    vi.stubGlobal("fetch", fetchMock)
    await analyzeContractRisk("Synthetic terms", "org-1")
    expect(fetchMock).toHaveBeenCalledWith("http://organization-ollama:11434/api/generate", expect.any(Object))
    expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined()
  })
  it("does not send contract text to a rejected organization endpoint", async () => {
    vi.mocked(resolveAiConfig).mockResolvedValue({ provider: "ollama", apiKey: "http://169.254.169.254", model: "test-chat", source: "org" })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ response: "{}" }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(analyzeContractRisk("Synthetic terms", "org-1")).rejects.toThrow("AI risk analysis failed")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(["anthropic", "openai"] as const)("does not expose %s SDK errors to worker logs or job failures", async provider => {
    vi.mocked(resolveAiConfig).mockResolvedValue({ provider, apiKey: "synthetic-key", model: "test-chat", source: "org" })
    const upstream = Object.assign(new Error("private-provider-message", { cause: "private-provider-cause" }), { body: "private-provider-body" })
    providerCalls[provider].mockRejectedValue(upstream)
    const error = await analyzeContractRisk("Synthetic terms", "org-1").catch(error => error)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBe(upstream)
    expect(error.message).toBe("AI risk analysis failed")
    expect(error.cause).toBeUndefined()
    expect(error.body).toBeUndefined()
  })
})
