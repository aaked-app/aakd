import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const OCR_PDF_LIMITS = Object.freeze({
  maxInputBytes: 50 * 1024 * 1024,
  maxPages: 50,
  overallTimeoutMs: 120_000,
  nativeCommandTimeoutMs: 20_000,
  maxRasterLongEdgePixels: 2_000,
  maxRasterBytesPerPage: 20 * 1024 * 1024,
  maxTotalRasterBytes: 128 * 1024 * 1024,
  maxTextBytes: 2 * 1024 * 1024,
})

const EXPECTED_MODEL_SHA256 = "5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747"
const EXPECTED_MODEL_BYTES = 5_199_098

export type OcrPdfErrorCode =
  | "input_limit"
  | "model_unavailable"
  | "model_integrity"
  | "page_count"
  | "page_limit"
  | "raster_limit"
  | "text_limit"
  | "timeout"
  | "cleanup_failed"
  | "processing_failed"

export class OcrPdfError extends Error {
  constructor(public readonly code: OcrPdfErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "OcrPdfError"
  }
}

interface CommandInput {
  binary: string
  args: string[]
  timeoutMs: number
  maxOutputBytes: number
}

export interface OcrRecognitionInput {
  images: string[]
  modelPath: string
  outputDirectory: string
  timeoutMs: number
  maxTextBytes: number
}

export interface OcrPdfRuntime {
  runCommand(input: CommandInput): Promise<{ stdout: string }>
  recognizePages(input: OcrRecognitionInput): Promise<string[]>
  removeDirectory?: (directory: string) => Promise<void>
  now?: () => number
}

function executeCommand({ binary, args, timeoutMs, maxOutputBytes }: CommandInput): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, {
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: maxOutputBytes,
      encoding: "utf8",
      env: { NODE_ENV: process.env.NODE_ENV ?? "production", PATH: process.env.PATH ?? "" },
    }, (error, stdout) => {
      if (error) {
        const timedOut = "killed" in error && error.killed === true
        reject(new OcrPdfError(timedOut ? "timeout" : "processing_failed", timedOut ? "OCR exceeded its deadline" : "OCR command failed"))
        return
      }
      resolve({ stdout })
    })
  })
}

function resolveRecognitionRunner(): string {
  const candidates = [
    path.join(process.cwd(), "lib/import/ocr-page-runner.mjs"),
    path.join(process.cwd(), "apps/web/lib/import/ocr-page-runner.mjs"),
  ]
  const runner = candidates.find(existsSync)
  if (!runner) throw new OcrPdfError("processing_failed", "The isolated OCR runner is unavailable")
  return runner
}

export async function runIsolatedOcrRecognition(
  input: OcrRecognitionInput,
  runnerPath = resolveRecognitionRunner(),
): Promise<string[]> {
  await executeCommand({
    binary: process.execPath,
    args: [
      runnerPath,
      `--model=${input.modelPath}`,
      `--output-directory=${input.outputDirectory}`,
      `--max-text-bytes=${input.maxTextBytes}`,
      ...input.images.map((image) => `--image=${image}`),
    ],
    timeoutMs: input.timeoutMs,
    maxOutputBytes: input.maxTextBytes,
  })
  const pages: string[] = []
  let totalBytes = 0
  for (const [index] of input.images.entries()) {
    const output = path.join(input.outputDirectory, `page-${index + 1}.txt`)
    const outputStats = await stat(output).catch(() => null)
    if (!outputStats?.isFile()) throw new OcrPdfError("processing_failed", "OCR did not return every page")
    totalBytes += outputStats.size
    if (totalBytes > input.maxTextBytes) throw new OcrPdfError("text_limit", "OCR text exceeds its resource limit")
    pages.push(await readFile(output, "utf8"))
  }
  return pages
}

const defaultRuntime: OcrPdfRuntime = {
  runCommand: executeCommand,
  recognizePages: runIsolatedOcrRecognition,
  removeDirectory: (directory) => rm(directory, { recursive: true, force: true }),
}

function remainingMs(deadline: number, now: () => number, commandCap?: number): number {
  const remaining = deadline - now()
  if (remaining <= 0) throw new OcrPdfError("timeout", "OCR exceeded its deadline")
  return commandCap === undefined ? remaining : Math.min(remaining, commandCap)
}

async function verifyModel(modelPath: string): Promise<void> {
  let modelStats
  try {
    modelStats = await stat(modelPath)
  } catch {
    throw new OcrPdfError("model_unavailable", "The local English OCR model is unavailable")
  }
  if (!modelStats.isFile() || modelStats.size !== EXPECTED_MODEL_BYTES) {
    throw new OcrPdfError("model_integrity", "The local English OCR model failed integrity verification")
  }
  let model: Buffer
  try {
    model = await readFile(modelPath)
  } catch {
    throw new OcrPdfError("model_unavailable", "The local English OCR model is unavailable")
  }
  if (createHash("sha256").update(model).digest("hex") !== EXPECTED_MODEL_SHA256) {
    throw new OcrPdfError("model_integrity", "The local English OCR model failed integrity verification")
  }
}

function parsePageCount(stdout: string): number {
  const matches = [...stdout.matchAll(/^Pages:\s+(\d+)\s*$/gm)]
  if (matches.length !== 1) throw new OcrPdfError("page_count", "Unable to determine an unambiguous PDF page count")
  const value = matches[0][1]
  const pages = value ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(pages) || pages < 1) throw new OcrPdfError("page_count", "Unable to determine PDF page count")
  return pages
}

export async function extractPdfWithOcr(
  buffer: Buffer,
  options: { modelPath?: string; runtime?: OcrPdfRuntime } = {},
): Promise<string | null> {
  if (buffer.byteLength > OCR_PDF_LIMITS.maxInputBytes) throw new OcrPdfError("input_limit", "PDF exceeds the OCR input limit")
  const runtime = options.runtime ?? defaultRuntime
  const now = runtime.now ?? Date.now
  const deadline = now() + OCR_PDF_LIMITS.overallTimeoutMs
  const modelPath = options.modelPath ?? path.resolve(process.cwd(), "eng.traineddata")
  await verifyModel(modelPath)
  remainingMs(deadline, now)

  const directory = await mkdtemp(path.join(os.tmpdir(), "aakd-ocr-"))
  const pdfPath = path.join(directory, "input.pdf")
  let processingError: unknown
  try {
    await writeFile(pdfPath, buffer)
    const info = await runtime.runCommand({
      binary: "pdfinfo",
      args: [pdfPath],
      timeoutMs: remainingMs(deadline, now, OCR_PDF_LIMITS.nativeCommandTimeoutMs),
      maxOutputBytes: OCR_PDF_LIMITS.maxTextBytes,
    })
    const pageCount = parsePageCount(info.stdout)
    if (pageCount > OCR_PDF_LIMITS.maxPages) throw new OcrPdfError("page_limit", "PDF exceeds the OCR page limit")

    const images: string[] = []
    let totalRasterBytes = 0
    for (let page = 1; page <= pageCount; page += 1) {
      const outputPrefix = path.join(directory, `raster-${page}`)
      await runtime.runCommand({
        binary: "pdftoppm",
        args: ["-f", String(page), "-l", String(page), "-singlefile", "-png", "-r", "150", "-scale-to", String(OCR_PDF_LIMITS.maxRasterLongEdgePixels), pdfPath, outputPrefix],
        timeoutMs: remainingMs(deadline, now, OCR_PDF_LIMITS.nativeCommandTimeoutMs),
        maxOutputBytes: OCR_PDF_LIMITS.maxTextBytes,
      })
      const image = `${outputPrefix}.png`
      const imageStats = await stat(image).catch(() => null)
      if (!imageStats?.isFile()) throw new OcrPdfError("processing_failed", "OCR rasterization produced no page")
      if (imageStats.size > OCR_PDF_LIMITS.maxRasterBytesPerPage) throw new OcrPdfError("raster_limit", "OCR raster page exceeds its resource limit")
      totalRasterBytes += imageStats.size
      if (totalRasterBytes > OCR_PDF_LIMITS.maxTotalRasterBytes) throw new OcrPdfError("raster_limit", "OCR raster data exceeds its resource limit")
      images.push(image)
    }

    const pages = await runtime.recognizePages({
      images,
      modelPath,
      outputDirectory: directory,
      timeoutMs: remainingMs(deadline, now),
      maxTextBytes: OCR_PDF_LIMITS.maxTextBytes,
    })
    remainingMs(deadline, now)
    if (pages.length !== pageCount) throw new OcrPdfError("processing_failed", "OCR did not return every page")
    const cleanedPages = pages.map((page) => page.trim())
    const text = `[OCR] ${cleanedPages.join("\f")}\f`
    if (Buffer.byteLength(text, "utf8") > OCR_PDF_LIMITS.maxTextBytes) throw new OcrPdfError("text_limit", "OCR text exceeds its resource limit")
    if (!cleanedPages.some((page) => /[\p{L}\p{N}]/u.test(page))) return null
    return text
  } catch (error) {
    processingError = error
    throw error
  } finally {
    try {
      await (runtime.removeDirectory ?? defaultRuntime.removeDirectory!)(directory)
    } catch (cleanupCause) {
      const cause = processingError === undefined
        ? cleanupCause
        : new AggregateError([processingError, cleanupCause], "OCR processing and cleanup failed")
      throw new OcrPdfError("cleanup_failed", "OCR temporary data cleanup failed", { cause })
    }
  }
}
