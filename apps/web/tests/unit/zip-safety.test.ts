/**
 * zip-safety.ts — decompression-bomb guard used by every ZIP-based import
 * handler (batch/CLM-export/PandaDoc) and the DOCX extract paths.
 */
import zlib from "node:zlib"
import { describe, it, expect } from "vitest"
import { zipSync } from "fflate"
import {
  safeUnzipSync,
  sanitizeZipBuffer,
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

// ─── Adversarial fixture: a ZIP with a forged (lying) declared size ──────────
//
// zipSync always writes an honest declared size, so it can't reproduce the
// real attack: a ZIP whose central-directory/local-header "uncompressed
// size" field is a lie. We hand-build one instead, matching real-world
// zip-bomb construction — a highly-compressible real payload, deflated
// small, with a forged tiny declared size in both header records.

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}

/** Builds a single-entry ZIP whose declared uncompressed size is a lie. */
function buildForgedZip(name: string, realSize: number, forgedDeclaredSize: number): Buffer {
  const real = Buffer.alloc(realSize, 0) // all-zero: deflates to almost nothing
  const compressed = zlib.deflateRawSync(real, { level: 9 })
  const crc = crc32(real)
  const nameBuf = Buffer.from(name, "ascii")

  const localHeader = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    u16(20), u16(0), u16(8), u16(0), u16(0),
    u32(crc), u32(compressed.length), u32(forgedDeclaredSize),
    u16(nameBuf.length), u16(0),
    nameBuf,
  ])
  const localEntry = Buffer.concat([localHeader, compressed])

  const centralHeader = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
    u32(crc), u32(compressed.length), u32(forgedDeclaredSize),
    u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0),
    u32(0), u32(0),
    nameBuf,
  ])

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(1), u16(1),
    u32(centralHeader.length), u32(localEntry.length), u16(0),
  ])

  return Buffer.concat([localEntry, centralHeader, eocd])
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

  it(
    "rejects once the running total across entries exceeds the total ceiling",
    () => {
      const chunkSize = Math.floor(MAX_TOTAL_DECOMPRESSED_BYTES / 3) + 1
      const chunk = new Uint8Array(chunkSize).fill(1)
      const zipped = zipSync(
        { "a.bin": chunk, "b.bin": chunk, "c.bin": chunk },
        { level: 9 },
      )

      expect(() => safeUnzipSync(zipped)).toThrow(ZipBombError)
    },
    // ~500MB total gets deflate-compressed at level 9 to build the fixture —
    // comfortably under 10s locally, but flaky on a loaded/shared CI runner.
    30_000,
  )

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

// ─── Adversarial: forged central-directory size (lying header) ──────────────
// C6 per the review — this is the exact attack shape jszip/pako (mammoth's
// internal DOCX unzip) is NOT protected against: a small declared size with
// a much larger real decompressed payload behind it.
describe("safeUnzipSync — forged declared size", () => {
  it("never materializes more than the forged declared size, even though the real payload is much larger", () => {
    const REAL_SIZE = 5 * 1024 * 1024 // 5 MB real content
    const FORGED_SIZE = 100 // lying header: claims only 100 bytes
    const forged = buildForgedZip("word/document.xml", REAL_SIZE, FORGED_SIZE)

    const entries = safeUnzipSync(forged)

    // fflate allocates its output buffer to the *declared* size and never
    // grows past it — so the real 5MB payload never gets materialized.
    expect(entries["word/document.xml"].length).toBe(FORGED_SIZE)
  })

  it("still enforces the per-entry ceiling when the forged size itself exceeds it", () => {
    const forged = buildForgedZip("bomb.bin", 1024, MAX_ENTRY_DECOMPRESSED_BYTES + 1)

    expect(() => safeUnzipSync(forged)).toThrow(ZipBombError)
  })
})

describe("sanitizeZipBuffer", () => {
  it("round-trips a well-formed archive unchanged in content", () => {
    const small = asciiBytes("hello world")
    const zipped = zipSync({ "small.txt": small })

    const sanitized = sanitizeZipBuffer(zipped)
    const reExtracted = safeUnzipSync(sanitized)

    expect(Buffer.from(reExtracted["small.txt"]).toString("utf8")).toBe("hello world")
  })

  it("produces a buffer capped at the forged declared size, not the real payload — safe to hand to mammoth", () => {
    const REAL_SIZE = 5 * 1024 * 1024
    const FORGED_SIZE = 100
    const forged = buildForgedZip("word/document.xml", REAL_SIZE, FORGED_SIZE)

    const sanitized = sanitizeZipBuffer(forged)
    // The sanitized buffer must be small — proof mammoth/jszip would only
    // ever see the capped ~100 bytes, never the real 5MB stream.
    expect(sanitized.length).toBeLessThan(1024)

    const reExtracted = safeUnzipSync(sanitized)
    expect(reExtracted["word/document.xml"].length).toBe(FORGED_SIZE)
  })

  it("rejects (throws) rather than sanitizes when the forged size exceeds the per-entry ceiling", () => {
    const forged = buildForgedZip("word/document.xml", 1024, MAX_ENTRY_DECOMPRESSED_BYTES + 1)

    expect(() => sanitizeZipBuffer(forged)).toThrow(ZipBombError)
  })
})
