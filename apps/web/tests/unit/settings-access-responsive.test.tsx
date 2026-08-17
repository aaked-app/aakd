import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

describe("Core Settings & Access contracts", () => {
  it("has responsive settings navigation and keeps existing destinations", () => {
    const layout = source("app/(app)/settings/layout.tsx")
    for (const href of ["/settings/org", "/settings/members", "/settings/api-keys", "/settings/audit-log", "/settings/profile"]) expect(layout).toContain(href)
    expect(layout).toContain("md:hidden")
    expect(layout).toMatch(/hidden[^\"]*md:flex/)
  })

  it("limits Profile to persisted name, email, and avatar", () => {
    const profile = source("app/(app)/settings/profile/page.tsx")
    expect(profile).toContain("authClient.updateUser({ name })")
    expect(profile).toContain("authClient.updateUser({ image: imageUrl })")
    expect(profile).toContain("disabled={isPending || saving || !name.trim()}")
    expect(profile).not.toMatch(/Phone|Job Title|Department|Change Password|Two-Factor|Active Sessions|Coming soon/)
  })

  it("removes ignored API-key description and exposes only existing scopes", () => {
    const page = source("app/(app)/settings/api-keys/page.tsx")
    expect(page).not.toMatch(/keyDescription|descriptionOptional/)
    expect(page).toContain('["read", "text_read", "write"]')
    expect(page).toContain("JSON.stringify({ name: keyName, scopes })")
    for (const field of ["scopes", "lastUsedAt", "expiresAt", "revokedAt"]) expect(page).toContain(field)
  })

  it("provides mobile member cards and locale-owned activity dates", () => {
    const members = source("app/(app)/settings/members/page.tsx")
    const activity = source("app/(app)/settings/audit-log/page.tsx")
    expect(members).toContain("md:hidden")
    expect(activity).toContain("Intl.RelativeTimeFormat")
    expect(activity).toContain("useLocale")
    expect(activity).toContain("!error && totalPages > 1")
  })

  it("removes fake activity export and uses the Contract activity surface", () => {
    const page = source("app/(app)/settings/audit-log/page.tsx")
    expect(page).not.toMatch(/Export CSV|Coming soon|Soon/)
    expect(page).toContain('useTranslations("contractActivity")')
    expect(page).toContain("md:hidden")
  })

  it("keeps the settings namespaces in five-locale parity with truthful text access copy", () => {
    const catalogs = { en, fr, de, es, ar } as const
    const required = ["settingsProfile", "org", "members", "apiKeys", "contractActivity"]
    const leafKeys = (value: unknown, prefix = ""): string[] => value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
      : [prefix]
    for (const namespace of required) {
      expect(en).toHaveProperty(namespace)
      const expected = leafKeys(en[namespace as keyof typeof en]).sort()
      for (const [locale, catalog] of Object.entries(catalogs)) {
        expect(catalog, `${locale}.${namespace}`).toHaveProperty(namespace)
        expect(leafKeys(catalog[namespace as keyof typeof catalog]).sort()).toEqual(expected)
      }
    }
    const descriptions = Object.values(catalogs).map((catalog) => catalog.apiKeys.readContentDescription)
    for (const copy of descriptions) expect(copy).not.toMatch(/approved|autorisé|freigegeben|autorizad|معتمد/i)
    expect(en.apiKeys.readContentDescription).toMatch(/contract text.*Q&A/i)
  })
})
