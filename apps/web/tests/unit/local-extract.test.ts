import { describe, expect, it } from "vitest"
import { extractDeterministicRenewalTerms, extractLocalFields, extractLocalObligationSuggestions } from "@/lib/ai/local-extract"

describe("local contract extraction fallback", () => {
  it("returns reviewable fields with exact source citations without an AI provider", () => {
    const text = [
      "MASTER SERVICES AGREEMENT",
      "Effective Date: January 15, 2025",
      "This agreement automatically renews for one year unless either party gives 30 days prior written notice.",
      "Governing Law: State of Delaware.",
    ].join("\n")

    expect(extractLocalFields(text)).toEqual([
      expect.objectContaining({ field: "contractType", value: "MSA", sourceText: "MASTER SERVICES AGREEMENT", sourcePage: null }),
      expect.objectContaining({ field: "startDate", value: "2025-01-15", sourceText: "Effective Date: January 15, 2025", sourcePage: null }),
      expect.objectContaining({ field: "autoRenewal", value: true, sourceText: "This agreement automatically renews for one year unless either party gives 30 days prior written notice.", sourcePage: null }),
      expect.objectContaining({ field: "noticePeriodDays", value: 30, sourceText: "This agreement automatically renews for one year unless either party gives 30 days prior written notice.", sourcePage: null }),
      expect.objectContaining({ field: "governingLaw", value: "State of Delaware", sourceText: "Governing Law: State of Delaware", sourcePage: null }),
    ])
  })

  it("fails closed when the text does not contain an unambiguous supported fact", () => {
    expect(extractLocalFields("A document with no supported metadata claims.")).toEqual([])
  })

  it("attributes citations to the page containing the source phrase", () => {
    const fields = extractLocalFields("Page one.\fEffective Date: January 15, 2025")
    expect(fields[0]).toMatchObject({ field: "startDate", sourcePage: 2 })
  })

  it("only derives renewal facts from an unambiguous, associated clause", () => {
    const positive = extractDeterministicRenewalTerms("Other notices require 10 days written notice.\fThis agreement automatically renews unless either party gives 1200 days written notice.")
    expect(positive.autoRenewal).toMatchObject({ value: true, sourcePage: 2 })
    expect(positive.noticePeriodDays).toMatchObject({ value: 1200, sourcePage: 2 })

    for (const text of [
      "This agreement does not automatically renew.",
      "This agreement shall never automatically renew.",
      "This agreement will in no event automatically renew.",
      "This agreement shall not be automatically renewed.",
      "This agreement will no longer automatically renew.",
    ]) {
      expect(extractDeterministicRenewalTerms(text).autoRenewal).toMatchObject({ value: false })
    }

    const conditional = extractDeterministicRenewalTerms("This agreement may automatically renew with written consent.")
    expect(conditional.autoRenewal).toBeUndefined()
    expect(conditional.autoRenewalAmbiguous).toBe(true)
    expect(extractDeterministicRenewalTerms("This agreement automatically renews if both parties agree.").autoRenewalAmbiguous).toBe(true)
    expect(extractDeterministicRenewalTerms("This agreement automatically renews upon mutual written consent.").autoRenewalAmbiguous).toBe(true)
    expect(extractDeterministicRenewalTerms("This agreement automatically renews subject to the customer opting in.").autoRenewalAmbiguous).toBe(true)
    for (const text of [
      "This agreement automatically renews if Customer elects to renew.",
      "This agreement automatically renews if Supplier exercises its option to renew.",
      "This agreement automatically renews at the sole option of either party.",
      "This agreement automatically renews at Customer's sole option.",
      "This agreement automatically renews subject to Vendor's option.",
      "This agreement automatically renews upon Customer's election.",
      "This agreement automatically renews upon election by Vendor.",
      "This agreement automatically renews when Licensor elects renewal.",
      "This agreement automatically renews on Customer's election.",
      "This agreement automatically renews subject to election by Vendor.",
      "This agreement automatically renews subject to the option of Vendor.",
    ]) {
      const terms = extractDeterministicRenewalTerms(text)
      expect(terms.autoRenewal).toBeUndefined()
      expect(terms.autoRenewalAmbiguous).toBe(true)
    }

    const associatedNotice = extractDeterministicRenewalTerms("This agreement requires 10 days written notice and automatically renews unless either party gives 45 days written notice.")
    expect(associatedNotice.noticePeriodDays).toMatchObject({ value: 45 })

    const wrappedNotice = extractDeterministicRenewalTerms("Heading\nThis agreement automatically renews unless either party gives\n45 days written notice.")
    expect(wrappedNotice.noticePeriodDays).toMatchObject({ value: 45 })
    expect(wrappedNotice.autoRenewal?.sourceText).toContain("automatically renews")
  })

  it("rejects malformed or unrelated notice numbers", () => {
    expect(extractDeterministicRenewalTerms("This agreement automatically renews with -832 days written notice.").noticePeriodDays).toBeUndefined()
    expect(extractDeterministicRenewalTerms("This agreement\0automatically renews unless either party gives 45 days written notice.").noticePeriodDays).toMatchObject({ value: 45 })
  })

  it("returns cited, reviewable explicit obligations without an AI provider", () => {
    const suggestions = extractLocalObligationSuggestions(
      "Provider shall deliver a monthly service report by the fifth business day of each month.\fCustomer shall pay each invoice within 30 days.",
    )

    expect(suggestions).toEqual([
      expect.objectContaining({
        title: "Deliver a monthly service report by the fifth business day of each month",
        sourceText: "Provider shall deliver a monthly service report by the fifth business day of each month.",
        sourcePage: 1,
        confidence: 0.75,
      }),
      expect.objectContaining({
        title: "Pay each invoice within 30 days",
        sourceText: "Customer shall pay each invoice within 30 days.",
        sourcePage: 2,
        priority: "HIGH",
        suggestedDueDays: 30,
      }),
    ])
  })

  it("does not invent a page or one-time deadline when the source lacks one", () => {
    const [suggestion] = extractLocalObligationSuggestions("Provider shall deliver a monthly report on the first business day.")
    expect(suggestion).toMatchObject({ sourcePage: null, suggestedDueDays: null })
  })

  it("ignores negated commitments and handles long unpunctuated text in bounded time", () => {
    expect(extractLocalObligationSuggestions("Provider will not be required to deliver the report.")).toEqual([])
    expect(extractLocalObligationSuggestions("Provider shall never disclose confidential information.")).toEqual([])
    expect(extractLocalObligationSuggestions("Provider shall under no circumstances disclose confidential information.")).toEqual([])
    expect(extractLocalObligationSuggestions("Provider will in no event disclose confidential information.")).toEqual([])
    expect(extractLocalObligationSuggestions("Provider does not agree to deliver the report.")).toEqual([])
    const startedAt = performance.now()
    expect(extractLocalObligationSuggestions("x ".repeat(100_000))).toEqual([])
    expect(performance.now() - startedAt).toBeLessThan(1_000)
  })
})
