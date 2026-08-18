import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import DashboardPage from "@/app/(app)/dashboard/page"
import type { AnalyticsSummary } from "@/app/api/analytics/summary/route"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

let desktop = true
let locale = "en-US"

const catalogs = { en, fr, de, es, ar }

function catalog() {
  return catalogs[locale.split("-")[0] as keyof typeof catalogs]
}

function message(namespace: string, key: string, values?: Record<string, unknown>) {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, catalog())
  if (typeof value !== "string") return key
  return Object.entries(values ?? {}).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    value,
  )
}

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => message(namespace, key, values),
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { name: "Alex Johnson", email: "alex@example.com" } } }),
}))

function setViewport(isDesktop: boolean) {
  desktop = isDesktop
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: desktop,
      media: "(min-width: 1024px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const summary: AnalyticsSummary = {
  expiringSoon: { next30: 2, next60: 3, next90: 4, contracts: [] },
  byStatus: [
    { status: "ACTIVE", count: 7 },
    { status: "DRAFT", count: 2 },
  ],
  monthlyVolume: [
    { month: "2027-05", count: 1 },
    { month: "2027-06", count: 3 },
  ],
  valueByType: [],
  approvalFunnel: { totalRequested: 4, approved: 1, rejected: 1, pending: 2 },
  obligations: { overdue: 1, dueSoon: 3 },
}

const contract = {
  id: "contract-1",
  title: "Northwind master agreement",
  contractType: "MSA",
  status: "ACTIVE",
  ownerId: "owner-1",
  owner: { id: "owner-1", name: "Taylor Smith", email: "taylor@example.com", image: null },
  counterpartyName: "Northwind",
  value: 25000,
  currency: "USD",
  endDate: "2027-06-30T00:00:00.000Z",
  organizationId: "org-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function installSuccessfulFetch(overrides?: { analytics?: AnalyticsSummary; contracts?: unknown[] }) {
  const analytics = overrides?.analytics ?? summary
  const contracts = overrides?.contracts ?? [contract]
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/analytics/summary") return json(analytics)
    if (String(input) === "/api/contracts?limit=5") return json({ contracts })
    if (String(input) === "/api/actions?view=dashboard&limit=5") return json({ actions: [] })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("DashboardPage responsive workspace summary", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED = "true"
    locale = "en-US"
    setViewport(true)
    installSuccessfulFetch()
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("preserves the two existing reads and renders one semantic desktop contract representation", async () => {
    const fetchMock = installSuccessfulFetch()
    render(<DashboardPage />)

    const table = await screen.findByRole("table", { name: message("dashboard", "recentContracts") })
    expect(within(table).getByRole("link", { name: "Northwind master agreement" })).toHaveAttribute(
      "href",
      "/contracts/contract-1",
    )
    expect(screen.queryByRole("list", { name: message("dashboard", "recentContracts") })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/summary",
      expect.objectContaining({ credentials: "include", signal: expect.any(AbortSignal) }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contracts?limit=5",
      expect.objectContaining({ credentials: "include", signal: expect.any(AbortSignal) }),
    )
    expect(screen.getByRole("link", { name: message("dashboard", "settings") })).toHaveClass("min-h-11")
    expect(screen.getByRole("link", { name: message("dashboard", "newContract") })).toHaveClass("min-h-11")
  })

  it("renders one named compact list on tablet and mobile without mounting the table", async () => {
    setViewport(false)
    render(<DashboardPage />)

    const list = await screen.findByRole("list", { name: message("dashboard", "recentContracts") })
    expect(within(list).getByRole("link", { name: /Northwind master agreement/ })).toHaveAttribute(
      "href",
      "/contracts/contract-1",
    )
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getAllByText("Northwind master agreement")).toHaveLength(1)
  })

  it("uses the active locale and UTC calendar for money, end dates, and chart months", async () => {
    locale = "de-DE"
    vi.stubEnv("TZ", "America/Los_Angeles")
    render(<DashboardPage />)

    const table = await screen.findByRole("table", { name: message("dashboard", "recentContracts") })
    expect(table.textContent).toMatch(/25\.000.*\$/)
    expect(table).toHaveTextContent("30.06.2027")
    expect(table).not.toHaveTextContent("29.06.2027")
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
    const may = monthFormatter.format(new Date("2027-05-01T00:00:00.000Z"))
    const june = monthFormatter.format(new Date("2027-06-01T00:00:00.000Z"))
    const chart = screen.getByRole("img")
    expect(chart).toHaveAccessibleName(expect.stringContaining(`${may}: 1`))
    expect(chart).toHaveAccessibleName(expect.stringContaining(`${june}: 3`))
  })

  it("uses localized Arabic labels and logical RTL layout", async () => {
    locale = "ar"
    render(<DashboardPage />)

    const main = await screen.findByRole("main")
    expect(main).toHaveAttribute("dir", "rtl")
    expect(screen.getByRole("link", { name: message("dashboard", "settings") })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: message("dashboard", "tableCounterparty") })).toHaveClass("text-start")
    expect(screen.queryByText("Notification settings")).not.toBeInTheDocument()
  })

  it("separates a failed read from empty data and retry recovers", async () => {
    let generation = 0
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/analytics/summary") {
        generation += 1
        return generation === 1 ? new Response(null, { status: 503 }) : json(summary)
      }
      if (String(input) === "/api/actions?view=dashboard&limit=5") return json({ actions: [] })
      return json({ contracts: [contract] })
    }))
    render(<DashboardPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent(message("dashboard", "loadErrorTitle"))
    expect(screen.queryByText(message("dashboard", "uploadFirstTitle"))).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: message("dashboard", "retry") }))

    expect(await screen.findByRole("table", { name: message("dashboard", "recentContracts") })).toBeInTheDocument()
    expect(generation).toBe(2)
  })

  it("keeps unavailable obligation counts distinct from zero", async () => {
    installSuccessfulFetch({ analytics: { ...summary, obligations: null } })
    render(<DashboardPage />)

    await screen.findByRole("table", { name: message("dashboard", "recentContracts") })
    expect(screen.getAllByText(message("dashboard", "obligationsUnavailable"))).toHaveLength(2)
    const overdue = screen.getByText(message("dashboard", "overdueObligations")).closest("article")
    const dueSoon = screen.getByText(message("dashboard", "dueSoonObligations")).closest("article")
    expect(overdue).toHaveTextContent("—")
    expect(dueSoon).toHaveTextContent("—")
    expect(overdue).not.toHaveTextContent(/^0$/)
  })

  it("shows the recoverable error state for a malformed successful analytics response", async () => {
    installSuccessfulFetch({
      analytics: { ...summary, expiringSoon: undefined } as unknown as AnalyticsSummary,
    })
    render(<DashboardPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent(message("dashboard", "loadErrorTitle"))
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("does not render malformed contract rows from a successful response", async () => {
    installSuccessfulFetch({ contracts: [{ ...contract, owner: { id: "owner-1" } }] })
    render(<DashboardPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent(message("dashboard", "loadErrorTitle"))
    expect(screen.queryByText("Northwind master agreement")).not.toBeInTheDocument()
  })

  it("never presents negative or non-finite analytics counts as workspace truth", async () => {
    await fc.assert(fc.asyncProperty(
      fc.oneof(
        fc.integer({ max: -1 }),
        fc.constant(Number.NaN),
        fc.constant(Number.POSITIVE_INFINITY),
        fc.constant(Number.NEGATIVE_INFINITY),
      ),
      async (invalidCount) => {
        cleanup()
        installSuccessfulFetch({
          analytics: {
            ...summary,
            byStatus: [{ status: "ACTIVE", count: invalidCount }],
          },
        })
        render(<DashboardPage />)

        expect(await screen.findByRole("alert")).toHaveTextContent(message("dashboard", "loadErrorTitle"))
      },
    ))
  })

  it("announces loading and aborts all reads when the view is discarded", () => {
    const signals: AbortSignal[] = []
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal)
      return new Promise<Response>(() => undefined)
    }))
    const view = render(<DashboardPage />)

    expect(screen.getByRole("status", { name: message("dashboard", "loading") })).toHaveAttribute("aria-busy", "true")
    expect(signals).toHaveLength(3)

    view.unmount()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it("keeps the legacy stats-first dashboard and skips Action API reads when the UI flag is off", async () => {
    process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED = "false"
    const fetchMock = installSuccessfulFetch()
    render(<DashboardPage />)

    expect(await screen.findByText(message("dashboard", "workspaceSummary"))).toBeInTheDocument()
    expect(screen.queryByText(message("dashboard", "agreementWork"))).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith("/api/actions?view=dashboard&limit=5", expect.anything())
  })

  it("renders the first-contract state only after a successful zero-total summary", async () => {
    installSuccessfulFetch({
      analytics: { ...summary, byStatus: [], monthlyVolume: [], obligations: { overdue: 0, dueSoon: 0 } },
      contracts: [],
    })
    render(<DashboardPage />)

    expect(await screen.findByRole("heading", { name: message("dashboard", "uploadFirstTitle") })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: message("dashboard", "uploadContract") })).toHaveAttribute(
      "href",
      "/contracts/new",
    )
  })

  it("keeps dashboard message keys aligned in all supported locales", () => {
    const baseline = Object.keys(en.dashboard).sort()
    for (const current of [fr, de, es, ar]) {
      expect(Object.keys(current.dashboard).sort()).toEqual(baseline)
    }
  })
})
