// @vitest-environment node
import { access, mkdtemp, readFile, rm, stat, truncate, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { verifyCitation } from "@/lib/ai/verified-citation"
import {
  extractPdfWithOcr,
  OCR_PDF_LIMITS,
  OcrPdfError,
  runIsolatedOcrRecognition,
  type OcrPdfRuntime,
} from "@/lib/import/ocr-pdf"

const modelPath = join(process.cwd(), "eng.traineddata")

function runtimeFor(pages: string[], options: { pageCount?: number; imageBytes?: number } = {}) {
  const rendered: string[] = []
  const runtime: OcrPdfRuntime = {
    runCommand: vi.fn(async ({ binary, args }) => {
      if (binary === "pdfinfo") return { stdout: `Pages: ${options.pageCount ?? pages.length}\n` }
      const output = `${args.at(-1)}.png`
      await writeFile(output, Buffer.from("image"))
      if (options.imageBytes) await truncate(output, options.imageBytes)
      rendered.push(output)
      return { stdout: "" }
    }),
    recognizePages: vi.fn(async () => pages),
  }
  return { runtime, rendered }
}

describe("bounded PDF OCR", () => {
  it("rejects input above the upload ceiling before model or native work", async () => {
    const { runtime } = runtimeFor(["unused"])
    await expect(extractPdfWithOcr(Buffer.alloc(OCR_PDF_LIMITS.maxInputBytes + 1), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "input_limit" })
    expect(runtime.runCommand).not.toHaveBeenCalled()
    expect(runtime.recognizePages).not.toHaveBeenCalled()
  })

  it("preserves every page boundary including the final single-page delimiter", async () => {
    const one = runtimeFor(["Effective Date: January 15, 2025. This is a sufficiently long OCR result."])
    const onePage = await extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime: one.runtime })
    expect(onePage).toBe("[OCR] Effective Date: January 15, 2025. This is a sufficiently long OCR result.\f")

    const two = runtimeFor([
      "Effective Date: January 15, 2025. This is a sufficiently long first OCR page.",
      "Governing Law: Delaware. This is a sufficiently long second OCR page.",
    ])
    const twoPages = await extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime: two.runtime })
    expect(twoPages).toBe("[OCR] Effective Date: January 15, 2025. This is a sufficiently long first OCR page.\fGoverning Law: Delaware. This is a sufficiently long second OCR page.\f")
  })

  it.each([
    ["short contract text", "A replacement agreement source."],
    ["one-character contract text", "A"],
  ])("accepts complete %s", async (_case, recognizedText) => {
    const { runtime } = runtimeFor([recognizedText])
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .resolves.toBe(`[OCR] ${recognizedText}\f`)
  })

  it.each([
    ["empty", ""],
    ["whitespace", " \t\n"],
    ["punctuation", "!?.,-"],
    ["control-only", "\u0000\u0001\u001f"],
  ])("returns no extracted text for complete %s OCR output", async (_case, recognizedText) => {
    const { runtime } = runtimeFor([recognizedText])
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .resolves.toBeNull()
  })

  it("preserves an empty first page and resolves a short citation on page two", async () => {
    const { runtime } = runtimeFor(["", "X"])
    const text = await extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime })
    expect(text).toBe("[OCR] \fX\f")
    expect(verifyCitation(text!, "X")).toMatchObject({ sourceText: "X", sourcePage: 2 })
  })

  it("rejects incomplete multi-page OCR instead of returning the recognized prefix", async () => {
    const { runtime } = runtimeFor(["Recognized first page only."], { pageCount: 2 })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "processing_failed" })
  })

  it("rejects an over-page-limit document before rendering any page", async () => {
    const { runtime } = runtimeFor([], { pageCount: OCR_PDF_LIMITS.maxPages + 1 })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "page_limit" })
    expect(runtime.runCommand).toHaveBeenCalledTimes(1)
    expect(runtime.recognizePages).not.toHaveBeenCalled()
  })

  it("rejects invalid page-count metadata before rendering or recognition", async () => {
    const { runtime } = runtimeFor([], { pageCount: 0 })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "page_count" })
    expect(runtime.runCommand).toHaveBeenCalledTimes(1)
    expect(runtime.recognizePages).not.toHaveBeenCalled()
  })

  it.each([
    ["conflicting duplicate", "Pages: 1\nPages:           2\n"],
    ["equal duplicate", "Pages: 2\nPages:           2\n"],
    ["malformed", "Pages: two\n"],
  ])("rejects %s page-count output before rasterization", async (_case, stdout) => {
    let rasterizationStarted = false
    const runtime: OcrPdfRuntime = {
      runCommand: vi.fn(async ({ binary }) => {
        if (binary === "pdfinfo") return { stdout }
        rasterizationStarted = true
        throw new Error("Rasterization must not start for ambiguous metadata")
      }),
      recognizePages: vi.fn(async () => []),
    }
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "page_count" })
    expect(rasterizationStarted).toBe(false)
    expect(runtime.recognizePages).not.toHaveBeenCalled()
  })

  it("accepts the exact page-count boundary and preserves every page delimiter", async () => {
    const pages = Array.from({ length: OCR_PDF_LIMITS.maxPages }, (_, index) =>
      `Page ${index + 1} contains enough deterministic text for the OCR boundary test.`)
    const { runtime } = runtimeFor(pages)
    const text = await extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime })
    expect(text?.split("\f")).toHaveLength(OCR_PDF_LIMITS.maxPages + 1)
    expect(runtime.runCommand).toHaveBeenCalledTimes(OCR_PDF_LIMITS.maxPages + 1)
    expect(runtime.recognizePages).toHaveBeenCalledTimes(1)
  })

  it("rejects an oversized rendered page without starting recognition", async () => {
    const { runtime } = runtimeFor(["unused"], { imageBytes: OCR_PDF_LIMITS.maxRasterBytesPerPage + 1 })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "raster_limit" })
    expect(runtime.recognizePages).not.toHaveBeenCalled()
  })

  it("rejects cumulative raster data above its budget without returning partial text", async () => {
    const pages = Array.from({ length: 8 }, () => "unused")
    const imageBytes = Math.floor(OCR_PDF_LIMITS.maxTotalRasterBytes / pages.length) + 1
    const { runtime, rendered } = runtimeFor(pages, { imageBytes })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "raster_limit" })
    expect(runtime.recognizePages).not.toHaveBeenCalled()
    expect(rendered).toHaveLength(pages.length)
    await expect(access(rendered[0])).rejects.toBeTruthy()
    await expect(stat(dirname(rendered[0]))).rejects.toBeTruthy()
  })

  it("rejects total OCR text beyond its byte budget without returning partial text", async () => {
    const { runtime } = runtimeFor(["x".repeat(OCR_PDF_LIMITS.maxTextBytes)])
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "text_limit" })
  })

  it("fails closed before native commands when the local model is missing or changed", async () => {
    const { runtime } = runtimeFor(["unused"])
    const directory = await mkdtemp(join(tmpdir(), "aakd-ocr-model-test-"))
    const changedModel = join(directory, "eng.traineddata")
    await writeFile(changedModel, "not the approved model")
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath: changedModel, runtime }))
      .rejects.toMatchObject({ code: "model_integrity" })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath: join(directory, "missing.traineddata"), runtime }))
      .rejects.toMatchObject({ code: "model_unavailable" })
    expect(runtime.runCommand).not.toHaveBeenCalled()
    await rm(directory, { recursive: true, force: true })
  })

  it("removes all temporary raster data after recognition failure", async () => {
    const { runtime, rendered } = runtimeFor(["unused"])
    runtime.recognizePages = vi.fn(async () => { throw new OcrPdfError("timeout", "OCR exceeded its deadline") })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "timeout" })
    expect(rendered).toHaveLength(1)
    await expect(access(rendered[0])).rejects.toBeTruthy()
    await expect(stat(dirname(rendered[0]))).rejects.toBeTruthy()
  })

  it("fails closed when temporary OCR data cannot be removed", async () => {
    const { runtime, rendered } = runtimeFor(["This valid OCR result is long enough to otherwise be returned successfully."])
    runtime.removeDirectory = vi.fn(async () => { throw new Error("synthetic cleanup failure") })
    await expect(extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }))
      .rejects.toMatchObject({ code: "cleanup_failed" })
    expect(rendered).toHaveLength(1)
    await rm(dirname(rendered[0]), { recursive: true, force: true })
  })

  it("preserves both processing and cleanup failures without returning partial text", async () => {
    const { runtime, rendered } = runtimeFor(["unused"])
    runtime.recognizePages = vi.fn(async () => { throw new OcrPdfError("timeout", "OCR exceeded its deadline") })
    runtime.removeDirectory = vi.fn(async () => { throw new Error("synthetic cleanup failure") })
    const failure = await extractPdfWithOcr(Buffer.from("%PDF synthetic"), { modelPath, runtime }).catch((error: unknown) => error)
    expect(failure).toMatchObject({ code: "cleanup_failed" })
    expect(failure).toBeInstanceOf(OcrPdfError)
    expect((failure as OcrPdfError).cause).toBeInstanceOf(AggregateError)
    expect(((failure as OcrPdfError).cause as AggregateError).errors).toEqual([
      expect.objectContaining({ code: "timeout" }),
      expect.objectContaining({ message: "synthetic cleanup failure" }),
    ])
    await rm(dirname(rendered[0]), { recursive: true, force: true })
  })

  it("kills the isolated recognizer when its deadline expires", async () => {
    const directory = await mkdtemp(join(tmpdir(), "aakd-ocr-timeout-test-"))
    const runner = join(directory, "hang.cjs")
    const pidFile = join(directory, "pid")
    await writeFile(runner, `const fs=require('node:fs'),path=require('node:path'); const out=process.argv.find(v=>v.startsWith('--output-directory=')).slice(19); fs.writeFileSync(path.join(out,'pid'),String(process.pid)); setInterval(() => {},1000)`)
    await expect(runIsolatedOcrRecognition({
      images: [join(directory, "page.png")], modelPath, outputDirectory: directory,
      timeoutMs: 1_000, maxTextBytes: OCR_PDF_LIMITS.maxTextBytes,
    }, runner)).rejects.toMatchObject({ code: "timeout" })
    const pid = Number(await readFile(pidFile, "utf8"))
    expect(() => process.kill(pid, 0)).toThrow()
    await rm(directory, { recursive: true, force: true })
  })
})
