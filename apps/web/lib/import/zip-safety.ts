/**
 * Decompression-bomb guard for ZIP-based import handlers. fflate's
 * `unzipSync` accepts a `filter` callback that runs against each entry's
 * *declared* size (from the ZIP central directory) before that entry is
 * inflated — returning `false`/throwing here means the entry is never
 * decompressed into memory. This lets us cap decompression cost without a
 * streaming rewrite of the handlers that call it.
 *
 * Verified empirically (2026-07-17) that fflate's inflate allocates its
 * output buffer sized to the *declared* originalSize and never grows past
 * it, even when the real deflate stream would produce far more data — so a
 * forged (lying) declared size just gets the output silently capped/
 * truncated at that declared size, not fully inflated. This is what makes
 * `safeUnzipSync` (and `sanitizeZipBuffer` below) safe against forged
 * headers, unlike jszip/pako (used internally by mammoth for DOCX), which
 * was confirmed to inflate substantially toward the *real* size before its
 * own "uncompressed data size mismatch" check fires — RSS grew to ~800MB
 * decompressing a 1GB payload declared as 100 bytes before mammoth threw.
 */
import { unzipSync, zipSync, type UnzipFileInfo } from "fflate"

// Mirrors the repo's existing 50 MB per-file upload cap.
export const MAX_ENTRY_DECOMPRESSED_BYTES = 50 * 1024 * 1024
// Ceiling on the sum of all decompressed entries pulled from one archive.
export const MAX_TOTAL_DECOMPRESSED_BYTES = 500 * 1024 * 1024

export class ZipBombError extends Error {}

/**
 * Wraps `unzipSync` with a decompressed-size ceiling. `accept` (optional)
 * lets callers skip entries by name (e.g. non-PDF/DOCX files, __MACOSX/)
 * before they're ever inflated — skipped entries are not size-checked
 * either, since they're never decompressed and can't consume memory.
 */
export function safeUnzipSync(
  data: Uint8Array,
  opts: { accept?: (name: string) => boolean } = {},
): ReturnType<typeof unzipSync> {
  let totalDecompressed = 0
  return unzipSync(data, {
    filter(file: UnzipFileInfo) {
      if (opts.accept && !opts.accept(file.name)) return false
      if (file.originalSize > MAX_ENTRY_DECOMPRESSED_BYTES) {
        throw new ZipBombError(`zip_entry_too_large: ${file.name}`)
      }
      totalDecompressed += file.originalSize
      if (totalDecompressed > MAX_TOTAL_DECOMPRESSED_BYTES) {
        throw new ZipBombError("zip_total_decompressed_too_large")
      }
      return true
    },
  })
}

/**
 * Re-serializes a ZIP/DOCX buffer through our own capped, verified-safe
 * unzip/rezip round-trip before handing it to a downstream library that
 * does its own internal decompression (mammoth's DOCX reader, via
 * jszip/pako). jszip does NOT protect against a forged declared size — it
 * inflates toward the archive's *real* decompressed size and only detects
 * the mismatch afterward, so memory usage scales with the attacker's real
 * payload, not the lie. Pre-extracting every entry ourselves through
 * `safeUnzipSync` (capped, verified safe against forged headers) and
 * re-zipping the result guarantees mammoth/jszip only ever sees data that's
 * already bounded by MAX_ENTRY_DECOMPRESSED_BYTES / MAX_TOTAL_DECOMPRESSED_BYTES,
 * regardless of what the original archive's headers claimed or what its
 * compressed stream actually decodes to.
 */
export function sanitizeZipBuffer(data: Uint8Array): Uint8Array {
  const entries = safeUnzipSync(data)
  return zipSync(entries)
}
