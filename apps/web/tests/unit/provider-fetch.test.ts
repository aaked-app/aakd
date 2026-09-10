// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { boundedAiFetch } from "@/lib/ai/provider-fetch"

describe("Bounded SDK transport", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("does not let malformed successful JSON reach SDK error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("PRIVATE_SUCCESS_MARKER", { headers: { "Content-Type": "application/json" } })))
    const error = await boundedAiFetch("https://provider.example/messages").catch(error => error)
    expect(error.message).toBe("AI provider request failed")
    expect(error.cause).toBeUndefined()
  })
  it("caps the body before the SDK can parse it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ content: "x".repeat(1024 * 1024) })))
    await expect(boundedAiFetch("https://provider.example/messages")).rejects.toThrow("AI provider request failed")
  })
  it("replaces upstream error bodies before SDK logging or error construction", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("PRIVATE_CONTRACT_AND_KEY", { status: 429 })))
    const response = await boundedAiFetch("https://provider.example/messages")
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: { message: "AI provider request failed" } })
  })
  it("preserves successful JSON and attaches a bounded non-redirecting request signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ content: "Synthetic result" }))
    vi.stubGlobal("fetch", fetchMock)
    const response = await boundedAiFetch("https://provider.example/messages", { redirect: "follow" })
    expect(await response.json()).toEqual({ content: "Synthetic result" })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }))
  })
  it("does not propagate fetch error causes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private body", { cause: "private cause" })))
    const error = await boundedAiFetch("https://provider.example/messages").catch(error => error)
    expect(error.message).toBe("AI provider request failed")
    expect(error.cause).toBeUndefined()
  })
})
