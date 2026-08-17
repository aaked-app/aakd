import { describe, expect, it, vi } from "vitest"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"

describe("readBoundedResponseBody", () => {
  it("cancels while streaming as soon as chunks cross the cap", async () => {
    const cancel = vi.fn()
    let pullCount = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1
        controller.enqueue(new Uint8Array([1, 2, 3]))
      },
      cancel,
    }, { highWaterMark: 0 })

    await expect(readBoundedResponseBody(new Response(body), 5)).rejects.toThrow("file_too_large")

    expect(cancel).toHaveBeenCalledOnce()
    expect(pullCount).toBe(2)
  })

  it("rejects Content-Length above the cap before reading the body", async () => {
    const cancel = vi.fn()
    const pull = vi.fn()
    const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
    const response = new Response(body, { headers: { "Content-Length": "6" } })

    await expect(readBoundedResponseBody(response, 5)).rejects.toThrow("file_too_large")

    expect(cancel).toHaveBeenCalledOnce()
    expect(pull).not.toHaveBeenCalled()
  })

  it("rejects promptly even when stream cancellation never settles", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
      },
      cancel,
    }, { highWaterMark: 0 })

    await expect(readBoundedResponseBody(new Response(body), 1)).rejects.toThrow("file_too_large")
    expect(cancel).toHaveBeenCalledOnce()
  })

  it("returns the concatenated body when it stays within the cap", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3]))
        controller.close()
      },
    })

    await expect(readBoundedResponseBody(new Response(body), 3))
      .resolves.toEqual(Buffer.from([1, 2, 3]))
  })
})
