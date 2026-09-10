import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import type { Readable } from "node:stream"
import type pdfParse from "pdf-parse"

export interface ParsePdfOptions {
  /** Append a form feed after every rendered page for source-page attribution. */
  pageBreaks?: boolean
}

export const PDF_PARSE_LIMITS = Object.freeze({
  maxInputBytes: 50 * 1024 * 1024,
  heapMb: 128,
  timeoutMs: 60_000,
  maxOutputBytes: 32 * 1024 * 1024,
  maxConcurrent: 1,
  maxQueued: 0,
})

const RESOURCE_LIMIT_ERROR = "PDF parser exceeded its isolated resource limits"
let activeParsers = 0
const parserQueue: Array<() => void> = []

function acquireParserSlot(): Promise<() => void> {
  if (activeParsers < PDF_PARSE_LIMITS.maxConcurrent) {
    activeParsers += 1
    return Promise.resolve(releaseParserSlot)
  }

  if (parserQueue.length >= PDF_PARSE_LIMITS.maxQueued) {
    return Promise.reject(new Error(RESOURCE_LIMIT_ERROR))
  }

  return new Promise((resolve) => {
    parserQueue.push(() => resolve(releaseParserSlot))
  })
}

function releaseParserSlot() {
  const next = parserQueue.shift()
  if (next) next()
  else activeParsers -= 1
}

function resolveParserHelper(): string {
  const candidates = [
    path.join(process.cwd(), "lib/pdf-parser-child.cjs"),
    path.join(process.cwd(), "apps/web/lib/pdf-parser-child.cjs"),
    path.join(__dirname, "pdf-parser-child.cjs"),
  ]
  const helper = candidates.find(existsSync)
  if (!helper) throw new Error("Isolated PDF parser is unavailable")
  return helper
}

function runIsolatedParser(
  input: Buffer,
  options: ParsePdfOptions,
): Promise<pdfParse.Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        `--max-old-space-size=${PDF_PARSE_LIMITS.heapMb}`,
        resolveParserHelper(),
        `--input-bytes=${input.byteLength}`,
        ...(options.pageBreaks ? ["--page-breaks"] : []),
      ],
      {
        env: {
          NODE_ENV: process.env.NODE_ENV ?? "production",
          PATH: process.env.PATH ?? "",
        },
        stdio: ["pipe", "ignore", "ignore", "pipe"],
      },
    )

    const response = child.stdio[3] as Readable | null
    const chunks: Buffer[] = []
    let outputBytes = 0
    let limitFailure: Error | null = null

    const failForLimit = () => {
      if (limitFailure) return
      limitFailure = new Error(RESOURCE_LIMIT_ERROR)
      child.kill("SIGKILL")
    }

    const timeout = setTimeout(failForLimit, PDF_PARSE_LIMITS.timeoutMs)

    response?.on("data", (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      outputBytes += bytes.byteLength
      if (outputBytes > PDF_PARSE_LIMITS.maxOutputBytes) {
        failForLimit()
        return
      }
      chunks.push(bytes)
    })

    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on("close", (code, signal) => {
      clearTimeout(timeout)
      if (limitFailure || signal || (code !== 0 && code !== 2)) {
        reject(limitFailure ?? new Error(RESOURCE_LIMIT_ERROR))
        return
      }

      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          ok?: boolean
          result?: pdfParse.Result
        }
        if (!payload.ok || !payload.result) {
          reject(new Error("PDF parsing failed in isolated process"))
          return
        }
        resolve(payload.result)
      } catch {
        reject(new Error("PDF parsing failed in isolated process"))
      }
    })

    const inputStream = child.stdin
    if (!inputStream) {
      clearTimeout(timeout)
      child.kill("SIGKILL")
      reject(new Error("Isolated PDF parser is unavailable"))
      return
    }

    inputStream.on("error", () => {
      // A resource-limited child can close stdin before the write completes.
      // Its close event above owns the stable rejection returned to callers.
    })
    inputStream.end(input)
  })
}

/** Parse untrusted PDF bytes outside the web/worker process. */
export async function parsePdf(
  bytes: Uint8Array,
  options: ParsePdfOptions = {},
): Promise<pdfParse.Result> {
  if (bytes.byteLength > PDF_PARSE_LIMITS.maxInputBytes) {
    throw new Error(RESOURCE_LIMIT_ERROR)
  }
  const release = await acquireParserSlot()
  try {
    // Copy only the supplied view. This preserves pooled Buffer/subarray
    // boundaries and prevents later caller mutations from changing child input.
    return await runIsolatedParser(Buffer.from(bytes), options)
  } finally {
    release()
  }
}
