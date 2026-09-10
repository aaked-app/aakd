// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { answerContractQuestion } from "@/lib/ai/answer"

const mocks = vi.hoisted(() => ({ config: vi.fn(), validate: vi.fn(), anthropic: vi.fn() }))
vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig: mocks.config }))
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: mocks.anthropic } } }))

describe("Contract questions use the organization's provider", () => {
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it("uses the organization OpenAI key and model, not operator defaults", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "operator-key")
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "org-key", model: "org-model", source: "org" })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: " Example answer " } }] }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await answerContractQuestion("Title", "Synthetic terms", "Question", "org-1")).toBe("Example answer")
    expect(mocks.config).toHaveBeenCalledWith("org-1")
    const options = fetchMock.mock.calls[0][1]
    expect(options.headers.Authorization).toBe("Bearer org-key")
    expect(JSON.parse(options.body).model).toBe("org-model")
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(options.redirect).toBe("error")
    expect(mocks.anthropic).not.toHaveBeenCalled()
  })
  it("supports the saved Ollama URL with validation and no redirects", async () => {
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://organization:11434/", model: "local-model", source: "org" })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: { content: "Local answer" } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await answerContractQuestion("Title", "Terms", "Question", "org-1")).toBe("Local answer")
    expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined()
    expect(fetchMock).toHaveBeenCalledWith("http://organization:11434/api/chat", expect.objectContaining({ redirect: "error" }))
  })
  it("sends nothing when configuration is unavailable", async () => {
    mocks.config.mockResolvedValue({ provider: null, apiKey: null, model: null, source: null })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await answerContractQuestion("Title", "Terms", "Question", "org-1")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.anthropic).not.toHaveBeenCalled()
  })
  it("rejects oversized provider responses without exposing the body", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "org-key", model: "org-model", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(1024 * 1024 + 1))))
    await expect(answerContractQuestion("Title", "Terms", "Question", "org-1")).rejects.toThrow("AI question answering failed")
  })
  it("rejects unsafe Ollama destinations before a network call", async () => {
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://169.254.169.254", model: "local-model", source: "org" })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(answerContractQuestion("Title", "Terms", "Question", "org-1")).rejects.toThrow("AI question answering failed")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("does not expose upstream errors, causes or response bodies", async () => {
    mocks.config.mockResolvedValue({ provider: "anthropic", apiKey: "org-key", model: "org-model", source: "org" })
    mocks.anthropic.mockRejectedValue(Object.assign(new Error("private body", { cause: "private cause" }), { body: "private content" }))
    const error = await answerContractQuestion("Title", "Terms", "Question", "org-1").catch(error => error)
    expect(error.message).toBe("AI question answering failed")
    expect(error.cause).toBeUndefined()
    expect(error.body).toBeUndefined()
  })
})
