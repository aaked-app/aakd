export const MAX_CONTRACT_FILE_BYTES = 50 * 1024 * 1024

export type ContractFileMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export function detectContractFileMime(buffer: Buffer): ContractFileMime | null {
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf"
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer.includes(Buffer.from("word/"))) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return null
}

export function sanitizeContractFilename(name: string): string {
  return name
    .replace(/[\/\\]+/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 255) || "contract"
}
