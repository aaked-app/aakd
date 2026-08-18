import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import IntegrationsPage from "@/app/(app)/settings/integrations/page"
import OrgPage from "@/app/(app)/settings/org/page"
import ProfilePage from "@/app/(app)/settings/profile/page"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const catalogs = { en, fr, de, es, ar }
let locale = "en-US"
let searchParams = new URLSearchParams()
let crmRole: string | null = "admin"
let crmConnected = false
const { updateUser, toastError, toastSuccess } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

function message(namespace: string, key: string, values?: Record<string, unknown>) {
  const catalog = catalogs[locale.split("-")[0] as keyof typeof catalogs]
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, catalog)
  if (typeof value !== "string") throw new Error(`Missing message ${locale}.${namespace}.${key}`)
  return Object.entries(values ?? {}).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    value,
  )
}

const translators = new Map<string, (key: string, values?: Record<string, unknown>) => string>()
function translator(namespace: string) {
  if (!translators.has(namespace)) {
    translators.set(namespace, (key, values) => message(namespace, key, values))
  }
  return translators.get(namespace)!
}

vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }))
vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) => translator(namespace),
}))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", name: "Jane Smith", email: "jane@example.com", image: "/avatar.png" } },
    isPending: false,
  }),
  useActiveOrganization: () => ({
    data: {
      id: "org-1",
      name: "Acme",
      createdAt: "2026-08-17T23:30:00-07:00",
      members: [{ userId: "user-1", role: "admin" }],
    },
  }),
  organization: { setActive: vi.fn().mockResolvedValue(undefined) },
  authClient: { updateUser },
}))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess, info: vi.fn() },
}))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function fetchFixture(input: RequestInfo | URL) {
  const url = String(input)
  if (url === "/api/crm/status") return json({ integrations: crmConnected ? [{
    provider: "HUBSPOT",
    connectedAt: "2026-08-17T12:00:00Z",
    connectedBy: { name: "Jane Smith" },
    portalId: "portal-1",
    instanceUrl: null,
    autoCreateStage: "Negotiation",
    syncOnActiveStage: "Closed Won",
  }] : [] })
  if (url === "/api/org/notification-channels") return json({ channels: [] })
  if (url === "/api/org/members") return json(crmRole ? [{ userId: "user-1", role: crmRole }] : [])
  if (url === "/api/org") return json({ name: "Acme", meta: {}, logo: null })
  if (url === "/api/ai-status") return json({ provider: null, model: null, hasKey: false, source: null })
  return json({})
}

describe("remaining Settings redesign presentation", () => {
  beforeEach(() => {
    locale = "en-US"
    searchParams = new URLSearchParams()
    crmRole = "admin"
    crmConnected = false
    updateUser.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => fetchFixture(input)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("renders integrations from the Arabic catalog and never echoes an OAuth query error", async () => {
    locale = "ar"
    searchParams = new URLSearchParams("error=database_connection_string")
    render(<IntegrationsPage />)

    expect(screen.getByRole("heading", { name: "التكاملات" })).toBeInTheDocument()
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("تعذر ربط التكامل."))
    expect(document.body).not.toHaveTextContent("database_connection_string")
  })

  it("exposes localized integration tabs and 44px interactive targets", async () => {
    render(<IntegrationsPage />)

    const tablist = screen.getByRole("tablist", { name: "Integration categories" })
    const crm = screen.getByRole("tab", { name: "CRM" })
    const storage = screen.getByRole("tab", { name: "Cloud storage" })
    expect(tablist).toContainElement(crm)
    expect(crm).toHaveAttribute("aria-selected", "true")
    expect(crm).toHaveClass("min-h-11")
    fireEvent.click(storage)
    expect(storage).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("button", { name: "Connect Google Drive" })).toHaveClass("min-h-11")
  })

  it.each([
    ["owner", true],
    ["admin", true],
    ["legal", true],
    ["member", false],
    ["viewer", false],
    [null, false],
  ] as const)("gives CRM management controls to %s only when legal-or-higher", async (role, canManage) => {
    crmRole = role
    crmConnected = true
    render(<IntegrationsPage />)

    const autoCreateStage = await screen.findByLabelText("Auto-create stage")
    const syncTargetStage = screen.getByLabelText("Sync target stage")
    const save = screen.getByRole("button", { name: "Save settings" })
    const disconnect = screen.getByRole("button", { name: "Disconnect" })
    expect(autoCreateStage).toHaveProperty("disabled", !canManage)
    expect(syncTargetStage).toHaveProperty("disabled", !canManage)
    expect(save).toHaveProperty("disabled", !canManage)
    expect(disconnect).toHaveProperty("disabled", !canManage)
  })

  it("does not issue CRM mutation requests from read-only controls", async () => {
    crmRole = "member"
    crmConnected = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => fetchFixture(input))
    vi.stubGlobal("fetch", fetchMock)
    render(<IntegrationsPage />)

    const autoCreateStage = await screen.findByLabelText("Auto-create stage")
    fireEvent.change(autoCreateStage, { target: { value: "Contract sent" } })
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }))
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET")).toEqual([])
    expect(autoCreateStage).toHaveValue("Negotiation")
  })

  it("uses locale-owned UTC organization dates and translated option labels without changing values", async () => {
    locale = "de-DE"
    render(<OrgPage />)

    expect(await screen.findByText("18. August 2026")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Technologie" })).toHaveValue("Technology")
    expect(screen.getByRole("option", { name: "EST — Ostküste" })).toHaveValue("America/New_York")
    expect(screen.getByLabelText("Organisationsname")).toHaveClass("min-h-11")
  })

  it("does not expose profile-provider failures and labels avatar controls", async () => {
    updateUser.mockResolvedValue({ error: { message: "database_connection_string" } })
    render(<ProfilePage />)

    expect(screen.getByRole("img", { name: "Profile avatar" })).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveClass("min-h-11")
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jane Updated" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Failed to save changes"))
    expect(toastError).not.toHaveBeenCalledWith("database_connection_string")
  })

  it("keeps all redesigned Settings namespaces in five-locale parity", () => {
    const leafKeys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
        : [prefix]
    for (const namespace of ["org", "settingsProfile", "members", "settingsIntegrations"] as const) {
      const expected = leafKeys(en[namespace]).sort()
      for (const catalog of [fr, de, es, ar]) expect(leafKeys(catalog[namespace]).sort()).toEqual(expected)
    }
  })
})
