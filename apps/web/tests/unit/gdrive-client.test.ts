import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/notifications/crypto", () => ({
  decrypt: vi.fn(() => "access-token"),
  encrypt: vi.fn((value: string) => value),
}))

vi.mock("@/lib/db/worker-client", () => ({
  getWorkerPrisma: vi.fn(),
}))

import { downloadDriveFile } from "@/lib/import/gdrive-client"

const integration = {
  id: "drive-1",
  accessToken: "encrypted-access-token",
  refreshToken: "encrypted-refresh-token",
  tokenExpiresAt: new Date("2999-01-01T00:00:00Z"),
}

describe("downloadDriveFile", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects a file above the existing 50 MB limit before downloading its body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: "large-file",
        name: "large.pdf",
        mimeType: "application/pdf",
        size: String(50 * 1024 * 1024 + 1),
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    )

    await expect(downloadDriveFile(integration, "large-file")).rejects.toThrow("file_too_large")
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it("rejects missing size metadata before downloading the file body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: "unknown-size",
        name: "unknown.pdf",
        mimeType: "application/pdf",
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    )

    await expect(downloadDriveFile(integration, "unknown-size")).rejects.toThrow("file_size_unknown")
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it("rejects an oversized response body before materializing it when Drive reports a safe size", async () => {
    const cancel = vi.fn()
    const pull = vi.fn()
    const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: "lying-size",
          name: "lying.pdf",
          mimeType: "application/pdf",
          size: "5",
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      )
      .mockResolvedValueOnce(new Response(body, {
        status: 200,
        headers: { "Content-Length": String(50 * 1024 * 1024 + 1) },
      }))

    await expect(downloadDriveFile(integration, "lying-size")).rejects.toThrow("file_too_large")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(cancel).toHaveBeenCalledOnce()
    expect(pull).not.toHaveBeenCalled()
  })
})
