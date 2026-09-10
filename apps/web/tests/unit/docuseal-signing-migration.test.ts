import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("DocuSeal provider identity migration", () => {
  it("never guesses a provider identity for historical submissions", () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260909213000_docuseal_signing_boundary/migration.sql"), "utf8")

    expect(sql).not.toMatch(/UPDATE\s+"Contract"/i)
    expect(sql).not.toContain("'integration:' ||")
    expect(sql).toContain('ADD COLUMN "signatureProviderId" TEXT')
  })
})
