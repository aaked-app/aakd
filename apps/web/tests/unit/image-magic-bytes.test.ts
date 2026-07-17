/**
 * image-magic-bytes.ts — magic-byte sniffing for org logo / user avatar
 * uploads. We never trust the client-supplied MIME type (see M0 spec rule).
 */
import { describe, it, expect } from "vitest"
import { detectImageKind, mimeForImageKind } from "@/lib/utils/image-magic-bytes"

describe("detectImageKind", () => {
  it("detects a JPEG by its FF D8 FF signature", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(detectImageKind(buf)).toBe("jpeg")
  })

  it("detects a PNG by its 8-byte signature", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    expect(detectImageKind(buf)).toBe("png")
  })

  it("detects a WebP by its RIFF....WEBP signature", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // chunk size, irrelevant to detection
      Buffer.from("WEBP", "ascii"),
    ])
    expect(detectImageKind(buf)).toBe("webp")
  })

  it("detects a GIF87a or GIF89a signature", () => {
    expect(detectImageKind(Buffer.from("GIF87a", "ascii"))).toBe("gif")
    expect(detectImageKind(Buffer.from("GIF89a", "ascii"))).toBe("gif")
  })

  it("returns null for a spoofed upload (wrong content, any claimed extension)", () => {
    const buf = Buffer.from("<script>alert(1)</script>", "utf8")
    expect(detectImageKind(buf)).toBeNull()
  })

  it("returns null for a truncated/empty buffer", () => {
    expect(detectImageKind(Buffer.alloc(0))).toBeNull()
    expect(detectImageKind(Buffer.from([0x89, 0x50]))).toBeNull()
  })

  it("does not misdetect a PDF as an image", () => {
    const buf = Buffer.from("%PDF-1.4", "ascii")
    expect(detectImageKind(buf)).toBeNull()
  })
})

describe("mimeForImageKind", () => {
  it("maps each detected kind to its canonical MIME type", () => {
    expect(mimeForImageKind("jpeg")).toBe("image/jpeg")
    expect(mimeForImageKind("png")).toBe("image/png")
    expect(mimeForImageKind("webp")).toBe("image/webp")
    expect(mimeForImageKind("gif")).toBe("image/gif")
  })
})
