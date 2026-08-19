import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import ObligationsPage from "@/app/(app)/obligations/page"
import {
  fetchAllObligations,
  PortfolioSummary,
} from "@/app/(app)/obligations/portfolio-helpers"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

let desktop = true
let locale = "en-US"
let role = "admin"

function lookup(namespace: string, key: string): string {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, en)
  return typeof value === "string" ? value : key
}

function translate(template: string, values?: Record<string, unknown>) {
  return Object.entries(values ?? {}).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => translate(lookup(namespace, key), values),
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
  useActiveOrganization: () => ({
    data: { members: [{ userId: "user-1", role }] },
  }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const obligations = [
  {
    id: "obligation-overdue",
    contractId: "contract-a",
    title: "File audit report",
    description: null,
    clauseReference: "Section 4.2",
    priority: "HIGH",
    status: "OVERDUE",
    dueDate: "2026-08-01T00:00:00.000Z",
    assignee: { id: "user-1", name: "Ada Legal", email: "ada@example.com", image: null },
    reminderDays: 7,
    reminderSentAt: null,
    completedAt: null,
    completedBy: null,
    createdBy: { id: "user-1", name: "Ada Legal" },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    subTasks: [],
    contract: { id: "contract-a", title: "Northwind MSA", counterpartyName: "Northwind" },
  },
  {
    id: "obligation-upcoming",
    contractId: "contract-b",
    title: "Renew insurance certificate",
    description: null,
    clauseReference: null,
    priority: "MEDIUM",
    status: "PENDING",
    dueDate: "2026-10-01T00:00:00.000Z",
    assignee: null,
    reminderDays: 14,
    reminderSentAt: null,
    completedAt: null,
    completedBy: null,
    createdBy: { id: "user-2", name: "Sam Ops" },
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    subTasks: [],
    contract: { id: "contract-b", title: "Contoso services agreement", counterpartyName: "Contoso" },
  },
]

function response(items = obligations, total = items.length) {
  return new Response(JSON.stringify({ obligations: items, total }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function membersResponse() {
  return new Response(JSON.stringify([]), {
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

describe("obligations portfolio responsive action queue", () => {
  beforeEach(() => {
    locale = "en-US"
    role = "admin"
    setViewport(true)
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/api/org/members" ? membersResponse() : response(),
    ))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("renders one semantic desktop table whose records open canonical obligation details", async () => {
    render(<ObligationsPage />)

    const table = await screen.findByRole("table", { name: "Obligation results" })
    const link = within(table).getByRole("link", { name: "View File audit report" })
    expect(link).toHaveAttribute(
      "href",
      "/contracts/contract-a/obligations/obligation-overdue",
    )
    expect(screen.queryByRole("list", { name: "Obligation results" })).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders one equivalent named card list on narrow screens without the desktop table", async () => {
    setViewport(false)
    render(<ObligationsPage />)

    const list = await screen.findByRole("list", { name: "Obligation results" })
    const link = within(list).getByRole("link", { name: "View File audit report" })
    expect(link).toHaveAttribute(
      "href",
      "/contracts/contract-a/obligations/obligation-overdue",
    )
    expect(link).toHaveClass("min-h-11")
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("only gives the priority band to an overdue or due-soon obligation", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/api/org/members" ? membersResponse() : response([obligations[1]]),
    ))
    render(<ObligationsPage />)

    await screen.findByRole("table", { name: "Obligation results" })
    expect(screen.getAllByRole("link", { name: "View Renew insurance certificate" })).toHaveLength(1)
  })

  it("shows a decorative check signal on the active operational filter", async () => {
    render(<ObligationsPage />)

    const all = await screen.findByRole("button", { name: "All" })
    expect(all.querySelector("svg[aria-hidden='true']")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Overdue" }))
    const overdue = screen.getByRole("button", { name: "Overdue" })
    expect(overdue).toHaveAttribute("aria-pressed", "true")
    expect(overdue.querySelector("svg[aria-hidden='true']")).not.toBeNull()
  })

  it("keeps stats, filters, and search aligned to the same portfolio records", async () => {
    render(<ObligationsPage />)

    await screen.findByRole("table", { name: "Obligation results" })
    const attention = await screen.findByRole("region", { name: "Obligation attention" })
    expect(within(attention).getAllByText("1")).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Overdue" }))
    expect(screen.getByRole("link", { name: "View File audit report" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "View Renew insurance certificate" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search obligations" }), {
      target: { value: "no such obligation" },
    })
    expect(screen.getByRole("heading", { name: "No matching obligations" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(screen.getByRole("link", { name: "View File audit report" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View Renew insurance certificate" })).toBeInTheDocument()
  })

  it.each([
    { total: 4_999, expectedLimited: false },
    { total: 5_000, expectedLimited: false },
    { total: 5_001, expectedLimited: true },
  ])("reports partial coverage only when $total exceeds the fetched records", async ({ total, expectedLimited }) => {
    const cappedObligations = Array.from({ length: total }, (_, index) => ({
      ...obligations[index % obligations.length],
      id: `capped-obligation-${index + 1}`,
      title: `Capped obligation ${index + 1}`,
    }))

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input), "https://aakd.test").searchParams.get("page") ?? "1")
      const start = (page - 1) * 100
      return new Response(JSON.stringify({
        obligations: cappedObligations.slice(start, start + 100),
        total,
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    const result = await fetchAllObligations(new AbortController().signal)

    expect(result.obligations).toHaveLength(Math.min(total, 5_000))
    expect(result.isLimited).toBe(expectedLimited)
    expect(fetch).toHaveBeenCalledTimes(50)
  })

  it("preserves earlier evidence of unseen records when the reported total changes during pagination", async () => {
    const cappedObligations = Array.from({ length: 5_000 }, (_, index) => ({
      ...obligations[index % obligations.length],
      id: `changing-total-obligation-${index + 1}`,
      title: `Changing total obligation ${index + 1}`,
    }))

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input), "https://aakd.test").searchParams.get("page") ?? "1")
      const start = (page - 1) * 100
      return new Response(JSON.stringify({
        obligations: cappedObligations.slice(start, start + 100),
        total: page === 1 ? 5_001 : 5_000,
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    const result = await fetchAllObligations(new AbortController().signal)

    expect(result.obligations).toHaveLength(5_000)
    expect(result.isLimited).toBe(true)
  })

  it("keeps the coverage limit visible and marks every summary count as partial", () => {
    render(
      <PortfolioSummary
        items={[
          { label: "Overdue", value: 2_500, description: "Requires immediate attention" },
          { label: "Due This Week", value: 0, description: "Action needed soon" },
          { label: "Upcoming", value: 2_500, description: "Next 60 days" },
          { label: "Completed", value: 0, description: "This quarter" },
        ]}
        isLimited
        attentionLabel="Obligation attention"
        partialCount="Partial data"
        partialCountDescription="Complete total unavailable on this page."
        coverageLabel="Portfolio coverage"
        coverageNotice="This page is limited to the first 5,000 obligations. Rows, search, filters, and summaries cover only records within this partial set. Complete totals require a narrower server-side query, which is not available on this page."
      />,
    )

    const notice = screen.getByRole("note", { name: "Portfolio coverage" })
    expect(notice).toHaveTextContent("limited to the first 5,000 obligations")
    expect(notice).toHaveTextContent("Rows, search, filters, and summaries cover only records within this partial set")
    expect(notice).toHaveTextContent("Complete totals require a narrower server-side query")

    const attention = screen.getByRole("region", { name: "Obligation attention" })
    expect(within(attention).getAllByText("Partial data")).toHaveLength(4)
    expect(within(attention).queryByText("2500")).not.toBeInTheDocument()
  })

  it("exposes a loading status, then a retryable error without replacing existing data", async () => {
    let attempts = 0
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/org/members") return membersResponse()
      attempts += 1
      if (attempts === 1) return new Response(null, { status: 503 })
      return response()
    }))

    render(<ObligationsPage />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading obligations")

    expect(await screen.findByRole("heading", { name: "Obligations unavailable" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("link", { name: "View File audit report" })).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it("distinguishes a global empty portfolio from filtered emptiness", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/api/org/members" ? membersResponse() : response([]),
    ))
    const { unmount } = render(<ObligationsPage />)
    expect(await screen.findByRole("heading", { name: "No obligations yet" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument()
    unmount()

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/api/org/members" ? membersResponse() : response(),
    ))
    render(<ObligationsPage />)
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search obligations" }), {
      target: { value: "missing" },
    })
    expect(screen.getByRole("heading", { name: "No matching obligations" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument()
  })

  it("keeps selection and destructive bulk actions out of read-only roles", async () => {
    role = "member"
    render(<ObligationsPage />)

    await screen.findByRole("link", { name: "View File audit report" })
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument()
  })

  it("labels selection, exposes indeterminate state, and confirms destructive deletion", async () => {
    render(<ObligationsPage />)
    const selectOne = await screen.findByRole("checkbox", { name: "Select File audit report" })
    fireEvent.click(selectOne)

    const selectAll = screen.getByRole("checkbox", { name: "Select all obligations" }) as HTMLInputElement
    expect(selectAll.indeterminate).toBe(true)
    const actions = screen.getByRole("region", { name: "Bulk actions" })
    fireEvent.click(within(actions).getByRole("button", { name: "Delete 1 obligation" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Delete selected obligations?")
    expect(within(dialog).getByRole("button", { name: "Delete 1 obligation" })).toBeInTheDocument()
  })

  it("does not duplicate a bulk delete when the confirmation is activated twice", async () => {
    let deletes = 0
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deletes += 1
        await new Promise<void>((resolve) => setTimeout(resolve, 1))
        return new Response(null, { status: 204 })
      }
      return String(input) === "/api/org/members" ? membersResponse() : response([obligations[0]])
    }))
    render(<ObligationsPage />)

    await screen.findByRole("link", { name: "View File audit report" })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all obligations" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete 1 obligation" }))
    const confirm = within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete 1 obligation" })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    await waitFor(() => expect(deletes).toBe(1))
  })

  it("bounds bulk-delete concurrency while attempting every selected obligation and preserving partial failures", async () => {
    const manyObligations = Array.from({ length: 101 }, (_, index) => ({
      ...obligations[0],
      id: `obligation-${index + 1}`,
      title: `Obligation ${index + 1}`,
    }))
    let activeDeletes = 0
    let maxConcurrentDeletes = 0
    let attemptedDeletes = 0

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "DELETE") {
        attemptedDeletes += 1
        activeDeletes += 1
        maxConcurrentDeletes = Math.max(maxConcurrentDeletes, activeDeletes)
        const attempt = attemptedDeletes
        await new Promise<void>((resolve) => queueMicrotask(resolve))
        activeDeletes -= 1
        return new Response(null, { status: attempt % 10 === 0 ? 503 : 204 })
      }

      const page = Number(new URL(url, "https://aakd.test").searchParams.get("page") ?? "1")
      const start = (page - 1) * 100
      return new Response(JSON.stringify({
        obligations: manyObligations.slice(start, start + 100),
        total: manyObligations.length,
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    render(<ObligationsPage />)
    await screen.findByRole("link", { name: "View Obligation 101" })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all obligations" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete 101 obligations" }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete 101 obligations" }))

    await waitFor(() => expect(attemptedDeletes).toBe(101))
    expect(maxConcurrentDeletes).toBeLessThanOrEqual(100)
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("91 obligations deleted")
      expect(toast.error).toHaveBeenCalledWith("10 deletions failed")
    })
    expect(screen.getAllByText("10 selected")).toHaveLength(2)
  })

  it("refetches a 5,001-total partial portfolio after deleting every loaded record without showing a global empty state", async () => {
    const unseenObligation = {
      ...obligations[1],
      id: "obligation-unseen",
      title: "Unseen obligation",
    }
    let obligationRequests = 0
    let resolveRefetch!: (value: Response) => void
    const refetchResponse = new Promise<Response>((resolve) => {
      resolveRefetch = resolve
    })

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      if (String(input) === "/api/org/members") return membersResponse()

      obligationRequests += 1
      if (obligationRequests === 1) return response([obligations[0]], 5_001)
      if (obligationRequests === 2) return response([], 5_001)
      return refetchResponse
    }))

    render(<ObligationsPage />)
    await screen.findByRole("link", { name: "View File audit report" })
    expect(screen.getByRole("note", { name: "Portfolio coverage" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all obligations" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete 1 obligation" }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete 1 obligation" }))

    expect(await screen.findByRole("status")).toHaveTextContent("Loading obligations")
    expect(screen.queryByRole("heading", { name: "No obligations yet" })).not.toBeInTheDocument()

    resolveRefetch(response([unseenObligation], 1))
    expect(await screen.findByRole("link", { name: "View Unseen obligation" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "No obligations yet" })).not.toBeInTheDocument()
  })

  it("formats due dates with the active locale and UTC semantics", async () => {
    locale = "ar-EG"
    render(<ObligationsPage />)

    const expected = new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date("2026-08-01T00:00:00.000Z"))
    expect(await screen.findByText(expected)).toBeInTheDocument()
    expect(screen.getByRole("searchbox")).toHaveClass("ps-10", "pe-3")
  })
})

describe("obligation portfolio coverage translations", () => {
  const catalogs = { en, fr, de, es, ar }

  it.each(Object.entries(catalogs))("defines complete %s coverage-limit copy", (_locale, catalog) => {
    const messages = catalog.obligations as unknown as Record<string, string>
    expect(messages.coverageLabel).toBeTruthy()
    expect(messages.coverageLimitNotice).toContain("{count}")
    expect(messages.partialCount).toBeTruthy()
    expect(messages.partialCountDescription).toBeTruthy()
  })
})
