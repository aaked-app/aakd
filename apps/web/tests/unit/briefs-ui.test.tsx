import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Suspense } from "react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import BriefsPage from "@/app/(app)/briefs/page"
import BriefDetailPage from "@/app/(app)/briefs/[id]/page"
import en from "@/messages/en.json"
import ar from "@/messages/ar.json"

let userId = "recipient"
let role = "member"
const router = { replace: vi.fn() }
vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("@/lib/actions/feature", () => ({ isActionLedgerUiEnabled: () => true }))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: userId } } }),
  useActiveOrganization: () => ({ data: { members: [{ userId, role }] } }),
}))

const brief = {
  id: "brief-1", title: "Quarterly handoff", acknowledgedAt: null, itemCount: 1, canRespond: true,
  publishedBy: { id: "publisher", name: "Pat" }, audienceUser: { id: "recipient", name: "Rae" },
  items: [{ id: "item-1", actionId: "action-1", actionVersion: 4, title: "Send report", condition: "At quarter end",
    dueDate: null, sourceText: "Provider shall send a report.", sourcePage: 1, confidence: 0.9,
    freshness: "CURRENT", assignee: { id: "recipient", name: "Rae" } }],
}
const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks(); userId = "recipient"; role = "member"
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return Response.json({ error: "failure" }, { status: 500 })
    if (init?.method === "POST" && url.includes("/items/")) return Response.json({ id: "result-1" }, { status: 201 })
    if (url === "/api/briefs") return Response.json({ briefs: [brief] })
    if (url === "/api/briefs/brief-1") return Response.json({ ...brief, canRespond: userId === "recipient" })
    if (url.startsWith("/api/actions")) return Response.json({ actions: [{ id: "action-1", title: "Send report", version: 4, reviewStatus: "reviewed", status: "PROPOSED", hasSourceText: true, assigneeId: "recipient", dueDate: null, condition: "At quarter end", sourcePage: 1 }] })
    if (url === "/api/org/members") return Response.json([{ userId: "recipient", user: { id: "recipient", name: "Rae" } }])
    throw new Error(`Unexpected test request ${url}`)
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function mount(detail = false, locale: "en" | "ar" = "en") {
  await act(async () => { render(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
    <Suspense fallback={null}>{detail ? <BriefDetailPage params={Promise.resolve({ id: "brief-1" })} /> : <BriefsPage />}</Suspense>
  </NextIntlClientProvider>) })
}

describe("Team Brief user-visible truth", () => {
  it("does not offer publishing or fetch publication data for recipients", async () => {
    await mount()
    expect(await screen.findByText("Quarterly handoff")).toBeVisible()
    expect(screen.queryByRole("button", { name: en.briefs.publish })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.every(([url]) => url === "/api/briefs")).toBe(true)
  })

  it.each([false, true])("does not claim failed acknowledgement succeeded (detail=%s)", async detail => {
    await mount(detail)
    fireEvent.click(await screen.findByRole("button", { name: en.briefs.acknowledge }))
    expect(await screen.findByRole("alert")).toHaveTextContent(en.briefs.acknowledgeFailed)
    expect(screen.queryByText(en.briefs.acknowledged, { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: en.briefs.acknowledge })).toBeEnabled()
    expect(screen.getByText("Quarterly handoff")).toBeVisible()
  })

  it("renders the server-confirmed acknowledgement", async () => {
    await mount(true)
    fetchMock.mockResolvedValueOnce(Response.json({ acknowledgedAt: "2026-09-09T12:00:00Z" }))
    fireEvent.click(await screen.findByRole("button", { name: en.briefs.acknowledge }))
    expect(await screen.findByText(en.briefs.acknowledged, { exact: true })).toBeVisible()
    expect(screen.queryByRole("button", { name: en.briefs.acknowledge })).not.toBeInTheDocument()
  })

  it("does not offer recipient acknowledgement to a publisher", async () => {
    userId = "publisher"; role = "owner"
    await mount(true)
    expect(await screen.findByText("Quarterly handoff")).toBeVisible()
    expect(screen.queryByRole("button", { name: en.briefs.acknowledge })).not.toBeInTheDocument()
  })

  it("lets the exact recipient submit evidence through the Brief without an action link", async () => {
    await mount(true)
    fireEvent.click(await screen.findByText(en.briefs.addEvidence))
    fireEvent.change(screen.getByLabelText(en.briefs.evidenceKind), { target: { value: "delivery_receipt" } })
    fireEvent.change(screen.getByLabelText(en.briefs.evidenceNote), { target: { value: "Delivered" } })
    fireEvent.click(screen.getByRole("button", { name: en.briefs.submitEvidence }))

    expect(await screen.findByText(en.briefs.evidenceSaved)).toBeVisible()
    const call = fetchMock.mock.calls.find(([url, init]) => url.endsWith("/items/item-1/evidence") && init?.method === "POST")!
    expect(JSON.parse(call[1].body)).toEqual({ expectedVersion: 4, kind: "delivery_receipt", note: "Delivered" })
    expect(screen.queryByRole("link", { name: en.briefs.openAction })).not.toBeInTheDocument()
  })

  it("does not expose recipient commands to the publisher", async () => {
    userId = "publisher"; role = "owner"
    await mount(true)
    expect(await screen.findByText("Quarterly handoff")).toBeVisible()
    expect(screen.queryByText(en.briefs.addEvidence)).not.toBeInTheDocument()
    expect(screen.queryByText(en.briefs.reportBlocker)).not.toBeInTheDocument()
  })

  it("marks a stale snapshot and does not offer its action link", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...brief, items: [{ ...brief.items[0], freshness: "STALE" }] }))
    await mount(true)
    expect(await screen.findByText(en.briefs.stale)).toBeVisible()
    expect(screen.queryByRole("link", { name: en.briefs.openAction })).not.toBeInTheDocument()
    expect(screen.getByText(brief.items[0].sourceText)).toBeVisible()
  })

  it("publishes the exact selected action version and preserves input on conflict", async () => {
    userId = "publisher"; role = "owner"
    await mount()
    fireEvent.change(await screen.findByLabelText(en.briefs.titleField), { target: { value: "My handoff" } })
    await waitFor(() => expect(screen.getByLabelText(en.briefs.recipient).children.length).toBe(2))
    fireEvent.change(screen.getByLabelText(en.briefs.recipient), { target: { value: "recipient" } })
    fireEvent.click(screen.getByRole("checkbox"))
    fetchMock.mockResolvedValueOnce(Response.json({ error: "source_changed" }, { status: 409 }))
    fireEvent.click(screen.getByRole("button", { name: en.briefs.publish }))
    expect(await screen.findByRole("alert")).toHaveTextContent(en.briefs.sourceChanged)
    expect(screen.getByLabelText(en.briefs.titleField)).toHaveValue("My handoff")
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!
    expect(JSON.parse(call[1].body)).toMatchObject({ actionIds: ["action-1"], expectedVersions: { "action-1": 4 } })
  })

  it("renders localized Arabic labels with RTL direction", async () => {
    await mount(true, "ar")
    expect(await screen.findByRole("button", { name: ar.briefs.acknowledge })).toBeVisible()
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl")
    expect(screen.getByText(ar.briefs.reviewedAtPublication, { exact: false })).toBeVisible()
  })
})
