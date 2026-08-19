import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import RenewalsPage from "@/app/(app)/renewals/page"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

let desktop = true
let locale = "en-US"

const catalogs = { en, fr, de, es, ar }

function catalog() {
  const language = locale.split("-")[0] as keyof typeof catalogs
  return catalogs[language]
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

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

interface RenewalFixture {
  id: string
  title: string
  counterpartyName: string | null
  endDate: string | null
  noticePeriodDays: number | null
  value: number | null
  currency: string | null
  riskScore: string | null
  status: string
  noticeDeadlineDate: string | null
  daysUntilDeadline: number | null
}

function renewal(
  id: string,
  daysUntilDeadline: number | null,
  overrides: Partial<RenewalFixture> = {},
): RenewalFixture {
  return {
    id,
    title: `Contract ${id}`,
    counterpartyName: `Counterparty ${id}`,
    endDate: "2026-06-30T00:00:00.000Z",
    noticePeriodDays: 30,
    value: 1234,
    currency: "USD",
    riskScore: "HIGH",
    status: "ACTIVE",
    noticeDeadlineDate: daysUntilDeadline == null ? null : "2026-05-31T00:00:00.000Z",
    daysUntilDeadline,
    ...overrides,
  }
}

function response(items: RenewalFixture[] = []) {
  return new Response(JSON.stringify({ renewals: items }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function setViewport(isDesktop: boolean) {
  desktop = isDesktop
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: desktop,
      media: "(min-width: 1280px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("renewals responsive attention queue", () => {
  beforeEach(() => {
    locale = "en-US"
    setViewport(true)
    vi.stubGlobal("fetch", vi.fn(async () => response([])))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("requests exactly the existing renewals endpoint and refresh re-fetches it", async () => {
    const fetchMock = vi.fn(async () => response([renewal("one", 8)]))
    vi.stubGlobal("fetch", fetchMock)
    render(<RenewalsPage />)

    await screen.findByRole("table", { name: message("renewals", "resultsLabel") })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/renewals",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    fireEvent.click(screen.getByRole("button", { name: message("renewals", "refresh") }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/renewals",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it("renders one semantic desktop table with canonical contract links and 44px targets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([renewal("northwind", 8)])))
    render(<RenewalsPage />)

    const table = await screen.findByRole("table", { name: message("renewals", "resultsLabel") })
    const link = within(table).getByRole("link", {
      name: message("renewals", "viewContract", { title: "Contract northwind" }),
    })
    expect(link).toHaveAttribute("href", "/contracts/northwind")
    expect(link).toHaveClass("min-h-11")
    expect(screen.getByRole("button", { name: message("renewals", "refresh") })).toHaveClass("min-h-11")
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("renders one named mobile card list without mounting the desktop table or re-fetching", async () => {
    setViewport(false)
    const fetchMock = vi.fn(async () => response([renewal("mobile", 31)]))
    vi.stubGlobal("fetch", fetchMock)
    render(<RenewalsPage />)

    const list = await screen.findByRole("list", { name: message("renewals", "compactResultsLabel") })
    const link = within(list).getByRole("link", {
      name: message("renewals", "viewContract", { title: "Contract mobile" }),
    })
    expect(link).toHaveAttribute("href", "/contracts/mobile")
    expect(link).toHaveClass("min-h-11")
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps fractional overdue truth and all urgency boundaries aligned with the summary", async () => {
    const cases = [
      renewal("minus-fraction", -0.1),
      renewal("one", 1),
      renewal("seven", 7),
      renewal("eight", 8),
      renewal("thirty", 30),
      renewal("thirty-one", 31),
      renewal("unknown", null),
    ]
    vi.stubGlobal("fetch", vi.fn(async () => response(cases)))
    render(<RenewalsPage />)

    const summary = await screen.findByRole("region", { name: message("renewals", "attentionLabel") })
    expect(within(summary).getByText(message("renewals", "actionRequired")).parentElement).toHaveTextContent("3")
    expect(within(summary).getByText(message("renewals", "comingSoon")).parentElement).toHaveTextContent("2")
    expect(within(summary).getByText(message("renewals", "laterOrUnknown")).parentElement).toHaveTextContent("2")

    const table = screen.getByRole("table", { name: message("renewals", "resultsLabel") })
    expect(within(within(table).getByRole("row", { name: /Contract minus-fraction/ })).getByText(message("renewals", "overdue"))).toBeInTheDocument()
    expect(within(table).getByRole("row", { name: /Contract one/ })).toHaveTextContent(message("renewals", "dayRemaining", { days: 1 }))
    expect(within(table).getByRole("row", { name: /Contract seven/ })).toHaveTextContent(message("renewals", "daysRemaining", { days: 7 }))
    expect(within(table).getByRole("row", { name: /Contract eight/ })).toHaveTextContent(message("renewals", "daysRemaining", { days: 8 }))
    expect(within(table).getByRole("row", { name: /Contract thirty$/ })).toHaveTextContent(message("renewals", "daysRemaining", { days: 30 }))
    expect(within(table).getByRole("row", { name: /Contract thirty-one/ })).toHaveTextContent(message("renewals", "daysRemaining", { days: 31 }))
    expect(within(table).getByRole("row", { name: /Contract unknown/ })).toHaveTextContent(message("renewals", "notAvailable"))
  })

  it("localizes singular day grammar and risk text instead of exposing English component labels", async () => {
    locale = "fr-FR"
    vi.stubGlobal("fetch", vi.fn(async () => response([renewal("francais", 1)])))
    render(<RenewalsPage />)

    const table = await screen.findByRole("table", { name: message("renewals", "resultsLabel") })
    const row = within(table).getByRole("row", { name: /Contract francais/ })
    expect(row).toHaveTextContent("1 jour restant")
    expect(row).toHaveTextContent("Élevé")
    expect(row).not.toHaveTextContent("High")
  })

  it("formats dates against the UTC calendar and money in the active locale", async () => {
    locale = "de-DE"
    vi.stubEnv("TZ", "America/Los_Angeles")
    vi.stubGlobal("fetch", vi.fn(async () => response([renewal("deutsch", 8)])))
    render(<RenewalsPage />)

    const table = await screen.findByRole("table", { name: message("renewals", "resultsLabel") })
    const row = within(table).getByRole("row", { name: /Contract deutsch/ })
    expect(row).toHaveTextContent("30.06.2026")
    expect(row).not.toHaveTextContent("29.06.2026")
    expect(row.textContent).toContain("1.234")
  })

  it("shows a localized loading status", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)))
    render(<RenewalsPage />)

    expect(screen.getByRole("status")).toHaveTextContent(message("renewals", "loading"))
  })

  it("separates load failure from empty state and retry can recover", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(response([]))
    vi.stubGlobal("fetch", fetchMock)
    render(<RenewalsPage />)

    expect(await screen.findByRole("heading", { name: message("renewals", "unavailableTitle") })).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(message("renewals", "loadErrorToast"))
    fireEvent.click(screen.getByRole("button", { name: message("renewals", "retry") }))
    expect(await screen.findByRole("heading", { name: message("renewals", "emptyTitle") })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("ignores a superseded response when the locale changes during loading", async () => {
    let resolveFirst!: (value: Response) => void
    let resolveSecond!: (value: Response) => void
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    vi.stubGlobal("fetch", fetchMock)
    const view = render(<RenewalsPage />)

    locale = "fr-FR"
    view.rerender(<RenewalsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await act(async () => resolveSecond(response([renewal("newer", 8)])))
    expect((await screen.findAllByText("Contract newer")).length).toBeGreaterThan(0)
    await act(async () => resolveFirst(response([renewal("older", 1)])))
    expect(screen.queryByText("Contract older")).not.toBeInTheDocument()
    expect(screen.getAllByText("Contract newer").length).toBeGreaterThan(0)
  })

  it("renders special-character text safely and falls back for malformed display values", async () => {
    const item = renewal("dirty", null, {
      title: '<script>alert("renewal")</script>',
      counterpartyName: "Legal & Ops",
      endDate: "not-a-date",
      noticePeriodDays: null,
      currency: "not valid",
      riskScore: "UNKNOWN",
    })
    vi.stubGlobal("fetch", vi.fn(async () => response([item])))
    const view = render(<RenewalsPage />)

    const table = await screen.findByRole("table", { name: message("renewals", "resultsLabel") })
    expect(within(table).getByText('<script>alert("renewal")</script>')).toBeInTheDocument()
    expect(view.container.querySelector("script")).toBeNull()
    expect(within(table).getByText("Legal & Ops")).toBeInTheDocument()
    expect(within(table).getAllByText(message("renewals", "notAvailable")).length).toBeGreaterThanOrEqual(3)
    expect(within(table).getByText(message("renewals", "riskNotScored"))).toBeInTheDocument()
    expect(table.textContent).toContain("not valid")
  })

  it("does not present a recorded value as USD when the source has no currency", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([renewal("uncurried", 8, { currency: null, value: 1234 })])))
    const view = render(<RenewalsPage />)

    const table = await screen.findByRole("table", { name: message("renewals", "resultsLabel") })
    expect(within(table).getByText(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1234))).toBeInTheDocument()
    expect(table.textContent).not.toContain("$")
    view.unmount()
  })

  it("renders the distinct localized empty state", async () => {
    render(<RenewalsPage />)

    expect(await screen.findByRole("heading", { name: message("renewals", "emptyTitle") })).toBeInTheDocument()
    expect(screen.getByText(message("renewals", "emptyDescription"))).toBeInTheDocument()
  })

  it("keeps renewals message keys aligned in all supported locales", () => {
    const baseline = Object.keys(en.renewals).sort()
    for (const current of [fr, de, es, ar]) {
      expect(Object.keys(current.renewals).sort()).toEqual(baseline)
    }
  })
})
