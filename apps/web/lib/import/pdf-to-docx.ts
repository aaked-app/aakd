import { execFile } from "node:child_process"
import { constants } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { logger } from "@/lib/logger"
import { sanitizeZipBuffer } from "@/lib/import/zip-safety"

const MAX_BYTES = 50 * 1024 * 1024

async function readBoundedOutput(output: string): Promise<Buffer> {
  const handle = await fs.open(output, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > MAX_BYTES) {
      throw new Error("Converted document exceeds file limit")
    }
    const buffer = Buffer.alloc(stat.size)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset)
      if (!bytesRead) throw new Error("Converted document was truncated")
      offset += bytesRead
    }
    const extra = await handle.read(Buffer.alloc(1), 0, 1, offset)
    if (extra.bytesRead || (await handle.stat()).size !== stat.size) {
      throw new Error("Converted document changed during read")
    }
    return buffer
  } finally {
    await handle.close()
  }
}

export async function pdfToDocxBuffer(buffer: Buffer): Promise<Buffer | null> {
  let directory: string | undefined
  try {
    if (!buffer.length || buffer.length > MAX_BYTES) throw new Error("PDF exceeds file limit")
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "aakd-pdf-docx-"))
    const input = path.join(directory, "source.pdf")
    await fs.writeFile(input, buffer, { mode: 0o600, flag: "wx" })
    const binary = process.platform === "darwin"
      ? "/Applications/LibreOffice.app/Contents/MacOS/soffice"
      : "soffice"
    await new Promise<void>((resolve, reject) => {
      execFile(binary, [
        `-env:UserInstallation=${pathToFileURL(path.join(directory!, "office-profile")).href}`,
        "--headless", "--convert-to", "docx", "--outdir", directory!,
        // Default PDF import opens Draw, which has no DOCX export filter.
        "--infilter=writer_pdf_import", input,
      ], { timeout: 30_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 }, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
    const converted = await readBoundedOutput(path.join(directory, "source.docx"))
    // Generated archives still originate from untrusted PDFs. Apply the same
    // bounded decompression guard as uploaded DOCX before mammoth sees them.
    return Buffer.from(sanitizeZipBuffer(converted))
  } catch {
    logger.warn("[import] PDF conversion unavailable; falling back to text")
    return null
  } finally {
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true }).catch(() => {
        logger.warn("[import] Temporary PDF conversion cleanup failed")
      })
    }
  }
}
