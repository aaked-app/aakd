import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import SearchPage from "@/app/(app)/search/page"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

let locale = "en-US"
const catalogs = { en, fr, de, es, ar } as const

function message(namespace: string, key: string): string {
  const language = locale.split("-")[0] as keyof typeof catalogs
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, catalogs[language])
  return typeof value === "string" ? value : key
}

function format(template: string, values?: Record<string, unknown>) {
  return Object.entries(values ?? {}).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => format(message(namespace, key), values),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

function mockDesktop(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(min-width: 1024px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

const result = {
  id: "contract-1",
  title: "Northwind master agreement",
  contractType: "MSA",
  status: "ACTIVE",
  counterpartyName: "Northwind",
  value: 25000,
  currency: "EUR",
  endDate: "2027-06-30T00:00:00.000Z",
  createdAt: "2026-06-30T00:00:00.000Z",
  similarity: 0.91,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

async function enterQuery(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: message("searchPage", "searchLabel") }), {
    target: { value },
  })
  await act(async () => {
    vi.advanceTimersByTime(300)
  })
}

describe("SearchPage", () => {
  beforeEach(() => {
    locale = "en-US"
    mockDesktop(true)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    window.history.replaceState(null, "", "/search")
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("labels keyword and meaning modes while preserving the exact keyword request and destination", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return String(input) === "/api/search?q=Northwind&limit=100"
        ? json({ results: [result], total: 1 })
        : json({}, 404)
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<SearchPage />)

    const methods = screen.getByRole("radiogroup", { name: "Search method" })
    expect(within(methods).getByRole("radio", { name: "Keyword" })).toHaveAttribute("aria-checked", "true")
    expect(within(methods).getByRole("radio", { name: "Meaning" })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("heading", { name: "Find an agreement" })).toBeInTheDocument()

    await enterQuery("Northwind")

    const table = await screen.findByRole("table", { name: "Search results" })
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=Northwind&limit=100", expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(within(table).getByRole("link", { name: "Open Northwind master agreement" })).toHaveAttribute("href", "/contracts/contract-1")
    expect(screen.queryByText("AI-powered")).not.toBeInTheDocument()
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument()
    expect(window.location.search).toBe("?q=Northwind")
  })

  it("uses the exact semantic request and distinguishes unavailable, unindexed, and rate-limited responses", async () => {
    const responses = [
      json({ error: "Embedding provider not configured" }, 503),
      json({ results: [], total: 0, indexed: false }),
      json({ error: "Too many requests" }, 429),
    ]
    const fetchMock = vi.fn(async () => responses.shift() ?? json({ results: [] }))
    vi.stubGlobal("fetch", fetchMock)
    render(<SearchPage />)

    fireEvent.click(screen.getByRole("radio", { name: "Meaning" }))
    await enterQuery("supplier termination rights")

    expect(await screen.findByRole("heading", { name: "Meaning search unavailable" })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/search/semantic",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "supplier termination rights", limit: 20 }),
        signal: expect.any(AbortSignal),
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry search" }))
    expect(await screen.findByRole("heading", { name: "Meaning index unavailable" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry search" }))
    expect(await screen.findByRole("heading", { name: "Search rate limit reached" })).toBeInTheDocument()
  })

  it("keeps existing filters, archived behavior, and filter-only request while clear filters is client-only", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return String(input) === "/api/contracts?limit=100&status=ARCHIVED"
        ? json({ contracts: [result], total: 1 })
        : json({ contracts: [], total: 0 })
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<SearchPage />)

    const filters = screen.getByRole("region", { name: "Filters" })
    expect(screen.getAllByRole("checkbox")).toHaveLength(11)
    fireEvent.click(within(filters).getByRole("checkbox", { name: "Archived" }))

    expect(await screen.findByRole("table", { name: "Search results" })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/contracts?limit=100&status=ARCHIVED", expect.objectContaining({ signal: expect.any(AbortSignal) }))
    const callsBeforeClear = fetchMock.mock.calls.length
    fireEvent.click(within(filters).getByRole("button", { name: "Clear filters" }))
    expect(screen.getByRole("heading", { name: "Find an agreement" })).toBeInTheDocument()
    expect(fetchMock.mock.calls.length).toBe(callsBeforeClear)
  })

  it("mounts one mobile result list and exposes the existing filters in a logical-side sheet", async () => {
    mockDesktop(false)
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [result], total: 1 })))
    render(<SearchPage />)
    await enterQuery("Northwind")

    const list = await screen.findByRole("list", { name: "Search results" })
    expect(within(list).getByRole("link", { name: "Open Northwind master agreement" })).toHaveAttribute("href", "/contracts/contract-1")
    expect(screen.queryByRole("table", { name: "Search results" })).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open filters" }))
    })
    const dialog = await screen.findByRole("dialog", { name: "Filters" })
    expect(dialog).toHaveAttribute("data-side", "right")
    expect(within(dialog).getByRole("checkbox", { name: "Active" })).toBeInTheDocument()
  })

  it("opens the mobile filter sheet from the logical end side in Arabic", async () => {
    locale = "ar"
    mockDesktop(false)
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [], total: 0 })))
    render(<SearchPage />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: message("searchPage", "openFilters") }))
    })
    const dialog = await screen.findByRole("dialog", { name: message("searchPage", "filters") })
    expect(dialog).toHaveAttribute("data-side", "left")
  })

  it("formats created dates in the active locale against the UTC calendar", async () => {
    locale = "de-DE"
    vi.stubEnv("TZ", "America/Los_Angeles")
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [result], total: 1 })))
    render(<SearchPage />)
    await enterQuery("Northwind")

    expect(await screen.findByText(/30\. Juni 2026/)).toBeInTheDocument()
  })

  it("shows generic failure separately from no results and makes retry recoverable", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(json({ error: "Internal server error" }, 500))
      .mockResolvedValueOnce(json({ results: [], total: 0 }))
    vi.stubGlobal("fetch", fetchMock)
    render(<SearchPage />)
    await enterQuery("Northwind")

    expect(await screen.findByRole("heading", { name: "Search unavailable" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry search" }))
    expect(await screen.findByRole("heading", { name: "No agreements found" })).toBeInTheDocument()
  })

  it("keeps search message keys aligned in all supported locales", () => {
    const baseline = Object.keys(en.searchPage).sort()
    for (const catalog of [fr, de, es, ar]) {
      expect(Object.keys(catalog.searchPage).sort()).toEqual(baseline)
    }
  })
})
