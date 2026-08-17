import { describe, expect, it } from "vitest"
import { extractLocalFields } from "@/lib/ai/local-extract"

describe("local contract extraction fallback", () => {
  it("returns reviewable fields with exact source citations without an AI provider", () => {
    const text = [
      "MASTER SERVICES AGREEMENT",
      "Effective Date: January 15, 2025",
      "This agreement automatically renews for one year unless either party gives 30 days prior written notice.",
      "Governing Law: State of Delaware.",
    ].join("\n")

    expect(extractLocalFields(text)).toEqual([
      expect.objectContaining({ field: "contractType", value: "MSA", sourceText: "MASTER SERVICES AGREEMENT", sourcePage: 1 }),
      expect.objectContaining({ field: "startDate", value: "2025-01-15", sourceText: "Effective Date: January 15, 2025", sourcePage: 1 }),
      expect.objectContaining({ field: "noticePeriodDays", value: 30, sourceText: "30 days prior written notice", sourcePage: 1 }),
      expect.objectContaining({ field: "autoRenewal", value: true, sourceText: "automatically renews", sourcePage: 1 }),
      expect.objectContaining({ field: "governingLaw", value: "State of Delaware", sourceText: "Governing Law: State of Delaware", sourcePage: 1 }),
    ])
  })

  it("fails closed when the text does not contain an unambiguous supported fact", () => {
    expect(extractLocalFields("A document with no supported metadata claims.")).toEqual([])
  })

  it("attributes citations to the page containing the source phrase", () => {
    const fields = extractLocalFields("Page one.\fEffective Date: January 15, 2025")
    expect(fields[0]).toMatchObject({ field: "startDate", sourcePage: 2 })
  })
})
