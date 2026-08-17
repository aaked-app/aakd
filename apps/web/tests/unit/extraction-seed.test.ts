import { describe, expect, it } from "vitest"
import { buildExtractionSeedPayload } from "@/lib/ai/extraction-seed"

const fields = [
  { field: "contractType", rawValue: "MSA" },
  { field: "counterpartyName", rawValue: "Acme" },
  { field: "governingLaw", rawValue: "" },
]

describe("buildExtractionSeedPayload", () => {
  it("keeps untouched extracted values as reviewable AI facts", () => {
    expect(buildExtractionSeedPayload(
      fields,
      new Set(),
      new Set(["contractType", "counterpartyName"]),
      { contractType: 0.92 },
    )).toEqual([
      { field: "contractType", rawValue: "MSA", confidence: 0.92, extractedBy: "ai" },
      { field: "counterpartyName", rawValue: "Acme", confidence: 0, extractedBy: "ai" },
    ])
  })

  it("marks edited extracted values as manual and preserves missing manual values", () => {
    expect(buildExtractionSeedPayload(
      [...fields, { field: "startDate", rawValue: "2026-08-17" }],
      new Set(["counterpartyName", "startDate"]),
      new Set(["contractType", "counterpartyName"]),
      { contractType: 0.92, counterpartyName: 0.88 },
    )).toEqual([
      { field: "contractType", rawValue: "MSA", confidence: 0.92, extractedBy: "ai" },
      { field: "counterpartyName", rawValue: "Acme", confidence: 0, extractedBy: "manual" },
      { field: "startDate", rawValue: "2026-08-17", confidence: 0, extractedBy: "manual" },
    ])
  })

  it("does not create rows for empty values", () => {
    expect(buildExtractionSeedPayload(
      fields,
      new Set(["governingLaw"]),
      new Set(),
      {},
    )).toEqual([])
  })
})
