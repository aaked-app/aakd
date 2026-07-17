/**
 * zip-safety.ts — decompression-bomb guard used by every ZIP-based import
 * handler (batch/CLM-export/PandaDoc) and the DOCX extract paths.
 */
import { describe, it, expect } from "vitest"
import { zipSync } from "fflate"
import {
  safeUnzipSync,
  assertZipDecompressedSizeWithinLimit,
  ZipBombError,
  MAX_ENTRY_DECOMPRESSED_BYTES,
  MAX_TOTAL_DECOMPRESSED_BYTES,
} from "@/lib/import/zip-safety"

// Vitest's jsdom environment runs in its own VM realm, so `Buffer.from`/
// `TextEncoder` output fails `instanceof Uint8Array` inside fflate (a
// cross-realm test-environment quirk, not a production concern — the real
// worker/API routes run in plain Node). Build fixtures with a bare
// `Uint8Array` constructor so fflate recognizes them consistently.
function asciiBytes(s: string): Uint8Array {
  return new Uint8Array(Array.from(s, (ch) => ch.charCodeAt(0)))
}

describe("safeUnzipSync", () => {
  it("extracts entries within the size ceiling", () => {
    const small = asciiBytes("hello world")
    const zipped = zipSync({ "small.txt": small })

    const entries = safeUnzipSync(zipped)

    expect(Buffer.from(entries["small.txt"]).toString("utf8")).toBe("hello world")
  })

  it("rejects a single entry whose declared size exceeds the per-entry ceiling", () => {
    // Highly-compressible content so the ZIP itself stays small while its
    // declared decompressed size trips the ceiling — this is the classic
    // decompression-bomb shape.
    const bomb = new Uint8Array(MAX_ENTRY_DECOMPRESSED_BYTES + 1).fill(0)
    const zipped = zipSync({ "bomb.bin": bomb }, { level: 9 })

    expect(() => safeUnzipSync(zipped)).toThrow(ZipBombError)
  })

  it("rejects once the running total across entries exceeds the total ceiling", () => {
    const chunkSize = Math.floor(MAX_TOTAL_DECOMPRESSED_BYTES / 3) + 1
    const chunk = new Uint8Array(chunkSize).fill(1)
    const zipped = zipSync(
      { "a.bin": chunk, "b.bin": chunk, "c.bin": chunk },
      { level: 9 },
    )

    expect(() => safeUnzipSync(zipped)).toThrow(ZipBombError)
  })

  it("skips entries the accept filter rejects without size-checking them", () => {
    // A junk entry that will never be imported (accept() filters it out)
    // must not abort the whole archive just because it declares a huge size.
    const small = asciiBytes("keep me")
    const bomb = new Uint8Array(MAX_ENTRY_DECOMPRESSED_BYTES + 1).fill(0)
    const zipped = zipSync({ "keep.txt": small, "skip.bin": bomb }, { level: 9 })

    const entries = safeUnzipSync(zipped, { accept: (name) => name === "keep.txt" })

    expect(Object.keys(entries)).toEqual(["keep.txt"])
  })
})

describe("assertZipDecompressedSizeWithinLimit", () => {
  it("passes without extracting anything for an archive within the ceiling", () => {
    const small = asciiBytes("hi")
    const zipped = zipSync({ "a.txt": small })

    expect(() => assertZipDecompressedSizeWithinLimit(zipped)).not.toThrow()
  })

  it("throws if any entry exceeds the per-entry ceiling", () => {
    const bomb = new Uint8Array(MAX_ENTRY_DECOMPRESSED_BYTES + 1).fill(0)
    const zipped = zipSync({ "bomb.bin": bomb }, { level: 9 })

    expect(() => assertZipDecompressedSizeWithinLimit(zipped)).toThrow(ZipBombError)
  })
})
