import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

type Corpus = {
  documents: Array<{ id: string; text: string; expected: { facts: unknown[]; actions: unknown[] } }>
  acceptance: { requiredScenarioTypes: string[]; rules: string[] }
}

const corpusPath = resolve(process.cwd(), "../../research/gates/phase-0-synthetic-corpus-v1.json")

describe("Phase 0 synthetic corpus", () => {
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Corpus

  it("is versioned, non-empty, and keeps expected outputs alongside inputs", () => {
    expect(corpus.documents.length).toBeGreaterThanOrEqual(8)
    for (const document of corpus.documents) {
      expect(document.id).toMatch(/^[a-z0-9-]+$/)
      expect(document.text.length).toBeGreaterThan(40)
      expect(Array.isArray(document.expected.facts)).toBe(true)
      expect(Array.isArray(document.expected.actions)).toBe(true)
    }
  })

  it("covers every Phase 0 adversarial scenario", () => {
    const text = corpus.documents.map((document) => document.text).join(" ").toLowerCase()
    const expectedTerms = [
      "amendment",
      "duplicate",
      "precedence",
      "missing",
      "departed",
      "timezone",
      "503",
      "promptly",
    ]
    for (const term of expectedTerms) expect(text).toContain(term)
    expect(corpus.acceptance.requiredScenarioTypes).toHaveLength(8)
    expect(corpus.acceptance.rules).toHaveLength(5)
  })

  it("requires unsafe or uncertain outcomes to remain reviewable", () => {
    const expected = corpus.documents.flatMap((document) => document.expected.actions)
    const serialized = JSON.stringify(expected)
    expect(serialized).toContain("block")
    expect(serialized).toContain("review")
    expect(serialized).toContain("suppress")
    expect(serialized).toContain("retry-review")
  })
})
