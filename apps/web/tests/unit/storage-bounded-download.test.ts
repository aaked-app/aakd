import { beforeEach, describe, expect, it, vi } from "vitest"

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send },
  GetObjectCommand: class {}, PutObjectCommand: class {}, DeleteObjectCommand: class {},
}))
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }))
import { storage } from "@/lib/storage"

function object(chunks: number[], advertised?: number) {
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { for (const size of chunks) controller.enqueue(new Uint8Array(size)) },
    cancel,
  })
  send.mockResolvedValue({ ContentLength: advertised, Body: { transformToWebStream: () => stream } })
  return { cancel, stream }
}

describe("bounded storage downloads", () => {
  beforeEach(() => send.mockReset())
  it("rejects oversized advertised bodies before reading, cancelling the stream", async () => {
    const { cancel } = object([1], 11)
    await expect(storage.getObject("private", 10)).rejects.toThrow("size limit")
    expect(cancel).toHaveBeenCalledOnce()
  })
  it("enforces the limit on actual bytes even without a content length", async () => {
    const { cancel } = object([6, 6])
    await expect(storage.getObject("private", 10)).rejects.toThrow("size limit")
    expect(cancel).toHaveBeenCalledOnce()
  })
  it("returns a complete bounded body", async () => {
    send.mockResolvedValue({ ContentType: "text/csv", Body: { transformToWebStream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.close() } }) } })
    const result = await storage.getObject("private", 2)
    expect([...result.body]).toEqual([1, 2])
    expect(result.contentType).toBe("text/csv")
  })
  it("rejects invalid limits before any storage request", async () => {
    await expect(storage.getObject("private", -1)).rejects.toThrow("Invalid")
    expect(send).not.toHaveBeenCalled()
  })
})
