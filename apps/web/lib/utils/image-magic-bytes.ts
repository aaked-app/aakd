/**
 * Magic-byte validators for image uploads (org logo, user avatar). We never
 * trust client-supplied MIME headers — see the M0 spec rule: "Validate by
 * magic bytes, not MIME header." Mirrors the approach already used for
 * PDF/DOCX uploads (lib/import/magic-bytes.ts, contract upload route).
 */

export type DetectedImageKind = "jpeg" | "png" | "webp" | "gif" | null

export function detectImageKind(buffer: Buffer): DetectedImageKind {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg"
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png"
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp"
  }
  if (
    buffer.length >= 6 &&
    buffer.subarray(0, 3).toString("ascii") === "GIF" &&
    (buffer.subarray(3, 6).toString("ascii") === "87a" ||
      buffer.subarray(3, 6).toString("ascii") === "89a")
  ) {
    return "gif"
  }
  return null
}

export function mimeForImageKind(kind: Exclude<DetectedImageKind, null>): string {
  switch (kind) {
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
  }
}
