// @vitest-environment node
import { describe, expect, it } from "vitest"
import { createTextPdf } from "../e2e/pdf-fixture"

describe("Synthetic PDF fixture integrity", () => {
  it("wraps long clauses without discarding their notice terms", () => {
    const clause = "This agreement automatically renews for successive twelve-month periods unless either party gives 45 days written notice."
    const pdf = createTextPdf([clause]).toString("ascii")
    const renderedLines = [...pdf.matchAll(/\(([^()]*)\) Tj/g)].map(match => match[1])
    expect(renderedLines.join(" ")).toBe(clause)
    expect(renderedLines.every(line => line.length <= 65)).toBe(true)
    expect(pdf).toContain("/BaseFont /Courier")
  })

  it("refuses an overflowing page rather than silently clipping later clauses", () => {
    expect(() => createTextPdf(Array(37).fill("Clause"))).toThrow("one-page printable area")
  })
  it.each(["Café", "العربية", "🚀", "line\nbreak"])("rejects unsupported text instead of corrupting %s", text => {
    expect(() => createTextPdf([text])).toThrow("printable ASCII")
  })
  it("uses explicit encoding and keeps each fixture's requested terms", () => {
    const pdf = createTextPdf(["O'Brien requires 45 days (written notice)."])
    expect(pdf.toString("ascii")).toContain("/WinAnsiEncoding")
    expect(pdf.toString("ascii")).toContain("O'Brien requires 45 days \\(written notice\\).")
    expect(pdf.toString("ascii")).not.toContain("30 days")
  })
})
