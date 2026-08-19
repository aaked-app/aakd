import { describe, expect, it } from "vitest"
import { chunkText } from "@/lib/ai/chunking"

describe("chunkText", () => {
  it("keeps boundary discovery linear for a large document without soft breaks", () => {
    const suffix = "\n\nIP ownership remains exclusively with Vendor.\n"
    const text = "ordinary contract boilerplate. ".repeat(
      Math.ceil((10 * 1024 * 1024 - suffix.length) / 29),
    ) + suffix

    const startedAt = performance.now()
    const chunks = chunkText(text, 8000, 1000)
    const elapsedMs = performance.now() - startedAt

    expect(chunks.at(-1)?.text).toContain("IP ownership remains exclusively with Vendor.")
    expect(elapsedMs).toBeLessThan(1_500)
  })
})
