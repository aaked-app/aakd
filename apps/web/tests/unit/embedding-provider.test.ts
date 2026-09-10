// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { generateEmbedding } from "@/lib/embedding"

const mocks = vi.hoisted(() => ({ config: vi.fn(), validate: vi.fn() }))
vi.mock("@/lib/ai/resolve", () => ({ resolveAiConfig: mocks.config }))
const vector = Array.from({ length: 1536 }, () => 0.1)

describe("Embedding provider boundary", () => {
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it("uses organization Ollama despite an operator OpenAI key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "operator-key")
    vi.stubEnv("OLLAMA_EMBEDDING_MODEL", "compatible-local-model")
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://org-models:11434", source: "org" })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ embeddings: [vector] }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await generateEmbedding("Synthetic private clause", "org-1")
    expect(mocks.config).toHaveBeenCalledWith("org-1")
    expect(fetchMock).toHaveBeenCalledWith("http://org-models:11434/api/embed", expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }))
    expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined()
    expect(result?.vector).toEqual(vector)
    expect(result?.model).toMatch(/^ollama:/)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("operator-key")
  })
  it("returns the actual vector and model identity together", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "org-key", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://changed:11434", source: "org" })
      return Response.json({ data: [{ embedding: vector }] })
    }))
    const result = await generateEmbedding("Synthetic terms", "org-1")
    expect(result?.model).toBe("openai:text-embedding-3-small:1536")
    expect(result?.vector).toEqual(vector)
    expect(mocks.config).toHaveBeenCalledTimes(1)
  })
  it.each([null, "anthropic"])("does not choose a different provider for %s", async provider => {
    vi.stubEnv("OPENAI_API_KEY", "operator-key")
    mocks.config.mockResolvedValue({ provider, apiKey: "org-key", source: "org" })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await generateEmbedding("Synthetic terms", "org-1")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("requires an explicitly configured compatible Ollama embedding model", async () => {
    vi.stubEnv("OLLAMA_EMBEDDING_MODEL", "")
    mocks.config.mockResolvedValue({ provider: "ollama", apiKey: "http://org-models:11434", source: "org" })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await generateEmbedding("Synthetic terms", "org-1")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([Array(1024).fill(0.1), Array(1536).fill(0), Array(1536).fill("0.1"), Array(1536).fill(1e100)])("rejects incompatible vectors", async invalid => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "org-key", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ embedding: invalid }] })))
    await expect(generateEmbedding("Synthetic terms", "org-1")).rejects.toThrow("Embedding generation failed")
  })
  it("does not expose provider error bodies", async () => {
    mocks.config.mockResolvedValue({ provider: "openai", apiKey: "org-key", source: "org" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Private provider error", { status: 429 })))
    const error = await generateEmbedding("Synthetic terms", "org-1").catch(error => error)
    expect(error.message).toBe("Embedding generation failed")
    expect(error.cause).toBeUndefined()
  })
  it("sends nothing for blank input or a missing organization", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await generateEmbedding(" ", "org-1")).toBeNull()
    expect(await generateEmbedding("Terms", "")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
