/**
 * Decompression-bomb guard for ZIP-based import handlers. fflate's
 * `unzipSync` accepts a `filter` callback that runs against each entry's
 * *declared* size (from the ZIP central directory) before that entry is
 * inflated — returning `false`/throwing here means the entry is never
 * decompressed into memory. This lets us cap decompression cost without a
 * streaming rewrite of the handlers that call it.
 */
import { unzipSync, type UnzipFileInfo } from "fflate"

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
 * Validates every entry's declared decompressed size without extracting
 * anything. For callers where a downstream library (mammoth's internal
 * DOCX unzip) will decompress the *entire* archive itself — this gives us
 * an upfront size ceiling check with none of that decompression cost.
 */
export function assertZipDecompressedSizeWithinLimit(data: Uint8Array): void {
  let totalDecompressed = 0
  unzipSync(data, {
    filter(file: UnzipFileInfo) {
      if (file.originalSize > MAX_ENTRY_DECOMPRESSED_BYTES) {
        throw new ZipBombError(`zip_entry_too_large: ${file.name}`)
      }
      totalDecompressed += file.originalSize
      if (totalDecompressed > MAX_TOTAL_DECOMPRESSED_BYTES) {
        throw new ZipBombError("zip_total_decompressed_too_large")
      }
      return false
    },
  })
}
