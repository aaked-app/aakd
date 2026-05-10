/**
 * Magic-byte validators for file uploads. PDF and DOCX have stable, well-known
 * leading bytes. We never trust client-supplied MIME headers — see the M0
 * spec rule: "Validate by magic bytes, not MIME header."
 */

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]) // "%PDF"
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // PK\x03\x04 (DOCX/OOXML container)

export type DetectedKind = "pdf" | "docx" | "zip" | null

export function detectFileKind(buffer: Buffer, filename?: string): DetectedKind {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC)) return "pdf"
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    // DOCX is a specific ZIP variant. The filename hint disambiguates a generic
    // .zip from a .docx without parsing the ZIP central directory inline.
    const lower = filename?.toLowerCase() ?? ""
    if (lower.endsWith(".docx")) return "docx"
    return "zip"
  }
  return null
}

export const MIME_PDF = "application/pdf"
export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export function mimeForKind(kind: "pdf" | "docx"): string {
  return kind === "pdf" ? MIME_PDF : MIME_DOCX
}
