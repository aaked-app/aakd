/**
 * Unit tests for AI extraction field coercion and queue definitions.
 */
import { describe, it, expect } from "vitest"

// ─── Type coercion helpers (mirrored from extractions route) ──────────────────
// We test these independently without importing the route (which has side-effects).

type CoerceFn = (raw: string) => unknown

const FIELD_MAP: Record<string, { column: string; coerce: CoerceFn }> = {
  contractType:     { column: "contractType",     coerce: (v) => v },
  startDate:        { column: "startDate",         coerce: (v) => new Date(v) },
  endDate:          { column: "endDate",           coerce: (v) => new Date(v) },
  renewalDate:      { column: "renewalDate",       coerce: (v) => new Date(v) },
  value:            { column: "value",             coerce: (v) => parseFloat(v) },
  currency:         { column: "currency",          coerce: (v) => v },
  counterpartyName: { column: "counterpartyName",  coerce: (v) => v },
  governingLaw:     { column: "governingLaw",      coerce: (v) => v },
  noticePeriodDays: { column: "noticePeriodDays",  coerce: (v) => parseInt(v, 10) },
  autoRenewal:      { column: "autoRenewal",       coerce: (v) => v === "true" || v === "1" },
}

describe("AI extraction field coercion", () => {
  describe("contractType", () => {
    it("passes through the string value unchanged", () => {
      expect(FIELD_MAP.contractType.coerce("NDA")).toBe("NDA")
      expect(FIELD_MAP.contractType.coerce("MSA")).toBe("MSA")
    })
  })

  describe("date fields", () => {
    it.each(["startDate", "endDate", "renewalDate"] as const)(
      "%s coerces ISO string to Date",
      (field) => {
        const result = FIELD_MAP[field].coerce("2024-01-15")
        expect(result).toBeInstanceOf(Date)
        expect((result as Date).toISOString()).toContain("2024-01-15")
      },
    )

    it("returns Invalid Date for bad input (caller must handle)", () => {
      const result = FIELD_MAP.startDate.coerce("not-a-date")
      expect(result).toBeInstanceOf(Date)
      expect(isNaN((result as Date).getTime())).toBe(true)
    })
  })

  describe("value", () => {
    it("parses numeric string to float", () => {
      expect(FIELD_MAP.value.coerce("12500.50")).toBeCloseTo(12500.5)
    })

    it("parses integer string to float", () => {
      expect(FIELD_MAP.value.coerce("5000")).toBe(5000)
    })

    it("returns NaN for non-numeric string", () => {
      expect(FIELD_MAP.value.coerce("not-a-number")).toBeNaN()
    })
  })

  describe("noticePeriodDays", () => {
    it("parses integer string", () => {
      expect(FIELD_MAP.noticePeriodDays.coerce("30")).toBe(30)
    })

    it("truncates decimal part", () => {
      expect(FIELD_MAP.noticePeriodDays.coerce("30.9")).toBe(30)
    })
  })

  describe("autoRenewal", () => {
    it("coerces 'true' string to true", () => {
      expect(FIELD_MAP.autoRenewal.coerce("true")).toBe(true)
    })

    it("coerces '1' to true", () => {
      expect(FIELD_MAP.autoRenewal.coerce("1")).toBe(true)
    })

    it("coerces 'false' to false", () => {
      expect(FIELD_MAP.autoRenewal.coerce("false")).toBe(false)
    })

    it("coerces '0' to false", () => {
      expect(FIELD_MAP.autoRenewal.coerce("0")).toBe(false)
    })
  })

  describe("string passthrough fields", () => {
    it.each(["currency", "counterpartyName", "governingLaw"] as const)(
      "%s returns the value unchanged",
      (field) => {
        const value = `test-${field}-value`
        expect(FIELD_MAP[field].coerce(value)).toBe(value)
      },
    )
  })
})

describe("FIELD_MAP column mappings", () => {
  it("maps every extractable field to a column name", () => {
    const EXPECTED_FIELDS = [
      "contractType", "startDate", "endDate", "renewalDate",
      "value", "currency", "counterpartyName", "governingLaw",
      "noticePeriodDays", "autoRenewal",
    ]
    for (const field of EXPECTED_FIELDS) {
      expect(FIELD_MAP[field]).toBeDefined()
      expect(FIELD_MAP[field].column).toBeTruthy()
    }
  })

  it("has 10 extractable fields defined", () => {
    expect(Object.keys(FIELD_MAP)).toHaveLength(10)
  })
})
