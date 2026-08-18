import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import NewContractPage from "@/app/(app)/contracts/new/page"
import ImportPage from "@/app/(app)/settings/import/page"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const catalogs = { en, fr, de, es, ar }
let locale: keyof typeof catalogs = "en"

function message(namespace: string, key: string, values?: Record<string, unknown>) {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, catalogs[locale])
  if (typeof value !== "string") throw new Error(`Missing message ${locale}.${namespace}.${key}`)
  return Object.entries(values ?? {}).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    value,
  )
}

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => message(namespace, key, values),
}))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } }, isPending: false }),
  useActiveOrganization: () => ({
    data: { members: [{ userId: "user-1", role: "admin" }] },
    isPending: false,
  }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@/components/import/csv-import-tab", () => ({ CsvImportTab: () => <button>CSV action</button> }))
vi.mock("@/components/import/batch-import-tab", () => ({ BatchImportTab: () => null }))
vi.mock("@/components/import/gdrive-tab", () => ({ GoogleDriveTab: () => null }))
vi.mock("@/components/import/pandadoc-tab", () => ({ PandaDocTab: () => null }))
vi.mock("@/components/import/clm-export-tab", () => ({ ClmExportTab: () => null }))
vi.mock("@/components/import/import-history", () => ({ ImportHistory: () => null }))

describe("visual matrix defect regressions", () => {
  beforeEach(() => { locale = "en" })

  it("renders one localized contract-create H1 and localized upload guidance", () => {
    locale = "ar"
    render(<NewContractPage />)

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("عقد جديد")
    expect(screen.getByRole("heading", { name: "أفلت عقدك هنا" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "تصفح الملفات" })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("Drop your contract here")
  })

  it("keeps the complete contract-create namespace in five-locale parity", () => {
    const leafKeys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
        : [prefix]
    const expected = leafKeys(en.contracts.create).sort()
    for (const catalog of [fr, de, es, ar]) {
      expect(leafKeys(catalog.contracts.create).sort()).toEqual(expected)
    }
  })

  it("uses compact mobile import chrome and restores explanatory text at sm", () => {
    render(<ImportPage />)

    const sequence = screen.getByRole("list", { name: "Import sequence" })
    expect(sequence).toHaveClass("grid-cols-3", "gap-2", "sm:gap-3")
    const explanation = screen.getByText("Use one of the existing supported import paths.")
    expect(explanation).toHaveClass("sr-only", "sm:not-sr-only")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Import contracts")
  })
})
