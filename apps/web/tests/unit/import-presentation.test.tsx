import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

function leafKeys(value: unknown, prefix = ""): string[] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
}

describe("Import presentation contracts", () => {
  it("keeps every existing import source available in desktop tabs and the mobile selector", () => {
    const page = source("app/(app)/settings/import/page.tsx")
    for (const value of ["csv", "batch", "gdrive", "pandadoc", "clm"]) {
      expect(page).toContain(`<TabsTrigger value="${value}">`)
      expect(page).toContain(`<TabsContent value="${value}"`)
    }
    expect(page).toContain("md:hidden")
    expect(page).toMatch(/hidden[^\"]*md:flex/)
  })

  it("allowlists OAuth errors before presenting localized copy", () => {
    const page = source("app/(app)/settings/import/page.tsx")
    expect(page).toContain("DRIVE_ERRORS.has(err)")
    expect(page).toContain('safeError = DRIVE_ERRORS.has(err) ? err : "unknown"')
    expect(page).not.toContain("Google Drive connection failed:")
  })

  it("has keyboard-accessible history disclosure and logical RTL alignment", () => {
    const history = source("components/import/import-history.tsx")
    expect(history).toContain("aria-expanded={isOpen}")
    expect(history).toContain("text-start")
    expect(history).toContain("text-end")
    expect(history).toContain("rtl:rotate-180")
    expect(history).toContain("md:hidden")
    expect(history).toContain("downloadErrorReport")
  })

  it("keeps the Import namespace in five-locale parity", () => {
    const catalogs = { en, fr, de, es, ar } as const
    const expected = leafKeys(en.import).sort()
    for (const [locale, catalog] of Object.entries(catalogs)) {
      expect(leafKeys(catalog.import).sort(), locale).toEqual(expected)
    }
  })
})
