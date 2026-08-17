import { describe, expect, it } from "vitest"
import { normalizeBatchManifest } from "@/lib/import/handlers/batch"

describe("normalizeBatchManifest", () => {
  const context = { organizationId: "org", jobId: "job" }

  it("accepts the persisted object manifest shape", () => {
    expect(normalizeBatchManifest({ files: [{ index: 0, filename: "a.pdf", storageKey: "imports/org/job/files/a.pdf", sizeBytes: 10 }] }, context)).toEqual([
      { filename: "a.pdf", storageKey: "imports/org/job/files/a.pdf", sizeBytes: 10 },
    ])
  })

  it.each([null, {}, { files: "bad" }, [{ filename: "a.pdf" }], { files: [{ filename: "a.pdf", storageKey: "" }] }])("rejects malformed manifests: %j", (value) => {
    expect(() => normalizeBatchManifest(value, context)).toThrow("manifest_invalid")
  })

  const unsafeManifests: Array<Array<{ filename: string; storageKey: string; sizeBytes: number }>> = [
    [{ filename: "a.pdf", storageKey: "imports/other/job/files/a.pdf", sizeBytes: 10 }],
    [{ filename: "a.pdf", storageKey: "imports/org/other/files/a.pdf", sizeBytes: 10 }],
    [
      { filename: "a.pdf", storageKey: "imports/org/job/files/a.pdf", sizeBytes: 10 },
      { filename: "b.pdf", storageKey: "imports/org/job/files/a.pdf", sizeBytes: 10 },
    ],
    [{ filename: "a.pdf", storageKey: "imports/org/job/files/a.pdf", sizeBytes: 50 * 1024 * 1024 + 1 }],
  ]

  it.each(unsafeManifests)("rejects unsafe manifest entries before signing them", (files) => {
    expect(() => normalizeBatchManifest({ files }, context)).toThrow("manifest_invalid")
  })
})
