import { describe, expect, it } from "vitest"
import { verifyCitation } from "@/lib/ai/verified-citation"

describe("verifyCitation", () => {
  it("accepts an exact document quote and derives its page", () => {
    expect(verifyCitation("First page.\fRenewal requires 45 days notice.", "Renewal requires 45 days notice.")).toEqual({
      sourceText: "Renewal requires 45 days notice.",
      sourcePage: 2,
    })
  })

  it("rejects missing, scalar, hallucinated, and evidence-free provider citations", () => {
    for (const value of [undefined, null, 12, "Invented clause", " ", "\t", "\n", "\f", "\0"]) {
      expect(verifyCitation("Actual contract clause.", value)).toBeNull()
    }
  })
})
