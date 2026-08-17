import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import NotificationsPage from "@/app/(app)/settings/notifications/page"
import ProfileNotificationsPage from "@/app/(app)/settings/profile/notifications/page"
import DeliveriesPage from "@/app/(app)/settings/notifications/webhooks/[id]/deliveries/page"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import de from "@/messages/de.json"
import es from "@/messages/es.json"
import ar from "@/messages/ar.json"

let currentRole = "member"
vi.mock("next-intl", () => ({
  useLocale: () => "en-US",
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key}:${JSON.stringify(values)}` : `${namespace}.${key}`,
}))
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "webhook-1" }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function orgFetch(input: RequestInfo | URL) {
  const url = String(input)
  if (url === "/api/org/members") return Promise.resolve(json({ members: [{ userId: "user-1", role: currentRole }] }))
  if (url === "/api/org/notification-channels") return Promise.resolve(json({ channels: [{ id: "channel-1", channelType: "slack", label: "Legal", enabled: true, createdAt: "2026-01-01T00:00:00Z" }] }))
  if (url === "/api/org/webhooks") return Promise.resolve(json({ webhooks: [{ id: "webhook-1", label: "CRM", enabled: true, urlPreview: "https://hooks.example.com", createdAt: "2026-01-01T00:00:00Z" }] }))
  return Promise.resolve(json({}))
}

describe("notification settings behavior", () => {
  beforeEach(() => { currentRole = "member" })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks() })

  it("keeps organization notification history and mutations out of the member UI", async () => {
    vi.stubGlobal("fetch", vi.fn(orgFetch))
    render(<NotificationsPage />)

    expect(await screen.findByText("CRM")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /deliver/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument()
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true")
  })

  it.each(["(unavailable)", null])("localizes an unavailable webhook preview returned as %s", async (urlPreview) => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/org/webhooks") {
        return Promise.resolve(json({
          webhooks: [{
            id: "webhook-1",
            label: "CRM",
            enabled: true,
            urlPreview,
            createdAt: "2026-01-01T00:00:00Z",
          }],
        }))
      }
      return orgFetch(input)
    }))

    render(<NotificationsPage />)

    expect(await screen.findByText("orgNotifications.previewUnavailable")).toBeInTheDocument()
    expect(screen.queryByText("(unavailable)")).not.toBeInTheDocument()
  })

  it("clears channel and webhook drafts before either form is reopened", async () => {
    currentRole = "admin"
    vi.stubGlobal("fetch", vi.fn(orgFetch))
    render(<NotificationsPage />)

    fireEvent.click(await screen.findByRole("button", { name: "orgNotifications.addSlack" }))
    fireEvent.change(screen.getByLabelText("orgNotifications.channelLabel"), { target: { value: "Private channel" } })
    fireEvent.change(screen.getByLabelText("orgNotifications.channelUrl"), { target: { value: "https://secret.example.com/slack" } })
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.addSlack" }))
    expect(screen.getByLabelText("orgNotifications.channelLabel")).toHaveValue("")
    expect(screen.getByLabelText("orgNotifications.channelUrl")).toHaveValue("")

    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.addWebhook" }))
    fireEvent.change(screen.getByLabelText("orgNotifications.webhookLabel"), { target: { value: "Private endpoint" } })
    fireEvent.change(screen.getByLabelText("orgNotifications.webhookUrl"), { target: { value: "https://secret.example.com/outbound" } })
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.addWebhook" }))
    expect(screen.getByLabelText("orgNotifications.webhookLabel")).toHaveValue("")
    expect(screen.getByLabelText("orgNotifications.webhookUrl")).toHaveValue("")
  })

  it.each([
    ["Slack", "Teams", "orgNotifications.addSlack", "orgNotifications.addTeams"],
    ["Teams", "Slack", "orgNotifications.addTeams", "orgNotifications.addSlack"],
  ])("clears a %s channel draft before switching to %s", async (_from, _to, fromButton, toButton) => {
    currentRole = "admin"
    vi.stubGlobal("fetch", vi.fn(orgFetch))
    render(<NotificationsPage />)

    fireEvent.click(await screen.findByRole("button", { name: fromButton }))
    fireEvent.change(screen.getByLabelText("orgNotifications.channelLabel"), { target: { value: "Private channel" } })
    fireEvent.change(screen.getByLabelText("orgNotifications.channelUrl"), { target: { value: "https://secret.example.com/channel" } })
    fireEvent.click(screen.getByRole("button", { name: toButton }))

    expect(screen.getByLabelText("orgNotifications.channelLabel")).toHaveValue("")
    expect(screen.getByLabelText("orgNotifications.channelUrl")).toHaveValue("")
  })

  it("groups all 16 existing personal events and labels every checkbox", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ preferences: [] })))
    render(<ProfileNotificationsPage />)

    expect(await screen.findByText("profileNotifications.groups.contracts")).toBeInTheDocument()
    expect(screen.getByText("profileNotifications.groups.approvals")).toBeInTheDocument()
    expect(screen.getByText("profileNotifications.groups.obligations")).toBeInTheDocument()
    expect(screen.getByText("profileNotifications.groups.workspace")).toBeInTheDocument()
    expect(screen.getAllByRole("checkbox")).toHaveLength(16)
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toHaveAccessibleName()
  })

  it("shows a retryable personal-preference error instead of an empty success state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "failed" }, 500)))
    render(<ProfileNotificationsPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("profileNotifications.loadError")
    expect(screen.getByRole("button", { name: "profileNotifications.retry" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("keeps a one-time webhook secret visible and offers manual copy after clipboard rejection", async () => {
    currentRole = "admin"
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/org/webhooks" && init?.method === "POST") return json({ signingSecret: "once-only-secret" }, 201)
      return orgFetch(input)
    }))
    render(<NotificationsPage />)
    fireEvent.click(await screen.findByRole("button", { name: "orgNotifications.addWebhook" }))
    fireEvent.change(screen.getByLabelText("orgNotifications.webhookLabel"), { target: { value: "CRM" } })
    fireEvent.change(screen.getByLabelText("orgNotifications.webhookUrl"), { target: { value: "https://hooks.example.com/new" } })
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.create" }))
    expect(await screen.findByDisplayValue("once-only-secret")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.copySecret" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("orgNotifications.copyFailedManual")
    expect(screen.getByDisplayValue("once-only-secret")).toBeInTheDocument()
  })

  it("clears copied and copy-error feedback whenever the one-time secret dialog closes", async () => {
    currentRole = "admin"
    const writeText = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("denied"))
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    let secretNumber = 0
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/org/webhooks" && init?.method === "POST") {
        secretNumber += 1
        return json({ signingSecret: `secret-${secretNumber}` }, 201)
      }
      return orgFetch(input)
    }))
    render(<NotificationsPage />)

    const createSecret = async () => {
      fireEvent.click(await screen.findByRole("button", { name: "orgNotifications.addWebhook" }))
      fireEvent.change(screen.getByLabelText("orgNotifications.webhookLabel"), { target: { value: "CRM" } })
      fireEvent.change(screen.getByLabelText("orgNotifications.webhookUrl"), { target: { value: "https://hooks.example.com/new" } })
      fireEvent.click(screen.getByRole("button", { name: "orgNotifications.create" }))
    }

    await createSecret()
    expect(await screen.findByDisplayValue("secret-1")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.copySecret" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "orgNotifications.copySecret" }).querySelector(".lucide-check")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.done" }))

    await createSecret()
    expect(await screen.findByDisplayValue("secret-2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "orgNotifications.copySecret" }).querySelector(".lucide-copy")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.copySecret" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("orgNotifications.copyFailedManual")
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.done" }))

    await createSecret()
    expect(await screen.findByDisplayValue("secret-3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "orgNotifications.copySecret" }).querySelector(".lucide-copy")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it.each(["resolve", "reject"] as const)("ignores a clipboard %s that settles after the secret dialog closes", async (settlement) => {
    currentRole = "admin"
    let settleClipboard!: () => void
    const clipboardResult = new Promise<void>((resolve, reject) => {
      settleClipboard = () => settlement === "resolve" ? resolve() : reject(new Error("denied"))
    })
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => clipboardResult) } })
    let secretNumber = 0
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/org/webhooks" && init?.method === "POST") {
        secretNumber += 1
        return json({ signingSecret: `delayed-secret-${secretNumber}` }, 201)
      }
      return orgFetch(input)
    }))
    render(<NotificationsPage />)

    const createSecret = async () => {
      fireEvent.click(await screen.findByRole("button", { name: "orgNotifications.addWebhook" }))
      fireEvent.change(screen.getByLabelText("orgNotifications.webhookLabel"), { target: { value: "CRM" } })
      fireEvent.change(screen.getByLabelText("orgNotifications.webhookUrl"), { target: { value: "https://hooks.example.com/new" } })
      fireEvent.click(screen.getByRole("button", { name: "orgNotifications.create" }))
    }

    await createSecret()
    expect(await screen.findByDisplayValue("delayed-secret-1")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.copySecret" }))
    fireEvent.click(screen.getByRole("button", { name: "orgNotifications.done" }))
    await createSecret()
    expect(await screen.findByDisplayValue("delayed-secret-2")).toBeInTheDocument()

    await act(async () => { settleClipboard(); await clipboardResult.catch(() => undefined) })

    expect(screen.getByRole("button", { name: "orgNotifications.copySecret" }).querySelector(".lucide-copy")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("renders a delivery error with retry and no stale table", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/deliveries") ? json({ error: "failed" }, 500) : json({ webhooks: [] })))
    render(<DeliveriesPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("webhookDeliveries.loadError")
    expect(screen.getByRole("button", { name: "webhookDeliveries.retry" })).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("ignores an older delivery response after a newer page response", async () => {
    let resolveFirst!: (value: Response) => void
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("page=1")) return first
      if (url.includes("page=2")) return Promise.resolve(json({ deliveries: [{ id: "new", eventName: "contract.signed", attempt: 1, httpStatus: 200, status: "success", durationMs: 12, deliveredAt: "2026-01-02T00:00:00Z", createdAt: "2026-01-02T00:00:00Z" }], total: 51 }))
      return Promise.resolve(json({ webhooks: [{ id: "webhook-1", label: "CRM", enabled: true, urlPreview: "https://hooks.example.com", createdAt: "2026-01-01T00:00:00Z" }] }))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<DeliveriesPage />)
    await act(async () => { resolveFirst(json({ deliveries: [{ id: "old", eventName: "contract.uploaded", attempt: 1, httpStatus: 200, status: "success", durationMs: 5, deliveredAt: null, createdAt: "2026-01-01T00:00:00Z" }], total: 51 })); await Promise.resolve() })
    fireEvent.click(await screen.findByRole("button", { name: "webhookDeliveries.next" }))
    expect(await screen.findAllByText("contract.signed")).not.toHaveLength(0)
    await waitFor(() => expect(screen.queryAllByText("contract.uploaded")).toHaveLength(0))
  })

  it("keeps every notification namespace in five-locale parity", () => {
    const leafKeys = (value: unknown, prefix = ""): string[] => value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
      : [prefix]
    const catalogs = { en, fr, de, es, ar } as const
    for (const namespace of ["orgNotifications", "profileNotifications", "webhookDeliveries"] as const) {
      const expected = leafKeys(en[namespace]).sort()
      for (const [locale, catalog] of Object.entries(catalogs)) expect(leafKeys(catalog[namespace]).sort(), `${locale}.${namespace}`).toEqual(expected)
    }
  })
})
