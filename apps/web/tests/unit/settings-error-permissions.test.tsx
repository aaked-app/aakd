import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import ActivityPage from "@/app/(app)/settings/audit-log/page"
import ApiKeysPage from "@/app/(app)/settings/api-keys/page"
import MembersPage from "@/app/(app)/settings/members/page"
import OrgPage from "@/app/(app)/settings/org/page"

let orgRole = "viewer"
vi.mock("next-intl", () => ({ useLocale: () => "en-US", useTranslations: (ns: string) => (key: string) => `${ns}.${key}` }))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } }, isPending: false }),
  useActiveOrganization: () => ({ data: { id: "org-1", name: "Acme", members: [{ userId: "user-1", role: orgRole }] }, isPending: false }),
  organization: { setActive: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("Settings error, permission, and accessibility behavior", () => {
  beforeEach(() => { orgRole = "viewer" })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })

  it("shows only error+retry after an initial activity 500 and labels both filters", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "failed" }, 500)))
    render(<ActivityPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent("contractActivity.error")
    expect(screen.getByRole("button", { name: "contractActivity.retry" })).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "contractActivity.actionFilterLabel" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "contractActivity.dateFilterLabel" })).toBeInTheDocument()
  })

  it("ignores an older retry response after a newer filtered response", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let resolveRetry!: (response: Response) => void
    const retry = new Promise<Response>((resolve) => { resolveRetry = resolve })
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({}, 500))
      .mockReturnValueOnce(retry)
      .mockResolvedValueOnce(json({ activities: [{ id: "new", action: "CREATED", actorLabel: "Actor", detail: null, createdAt: "2026-08-17T10:00:00Z", user: null, contract: { id: "new", title: "New result" } }], total: 1 })))
    render(<ActivityPage />)
    await screen.findByRole("alert")
    fireEvent.click(screen.getByRole("button", { name: "contractActivity.retry" }))
    fireEvent.change(screen.getByRole("textbox", { name: "contractActivity.searchLabel" }), { target: { value: "new" } })
    await act(async () => { vi.advanceTimersByTime(300) })
    expect((await screen.findAllByText("New result")).length).toBeGreaterThan(0)
    await act(async () => { resolveRetry(json({ activities: [{ id: "old", action: "CREATED", actorLabel: "Actor", detail: null, createdAt: "2026-08-17T09:00:00Z", user: null, contract: { id: "old", title: "Old result" } }], total: 1 })); await Promise.resolve() })
    expect(screen.queryAllByText("Old result")).toHaveLength(0)
  })

  it("renders a non-interactive empty logo state for a viewer", async () => {
    const role = "viewer"
    orgRole = role
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org" ? json({ name: "Acme", meta: {}, logo: null }) : json({ provider: null, model: null })))
    const { container } = render(<OrgPage />)
    const state = await screen.findByText("org.logoReadOnly")
    expect(screen.getByLabelText("org.orgName")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "org.saveChanges" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "org.setupAi" })).not.toBeInTheDocument()
    expect(screen.queryByText("org.clickToUpload")).not.toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument()
    expect(state.parentElement).not.toHaveClass("cursor-pointer")
  })

  it("keeps admin logo upload and a one-column mobile organization form", async () => {
    orgRole = "admin"
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org" ? json({ name: "Acme", meta: {}, logo: null }) : json({ provider: null, model: null })))
    const { container } = render(<OrgPage />)
    expect(await screen.findByText("org.clickToUpload")).toBeInTheDocument()
    expect(screen.getByLabelText("org.orgName")).toBeEnabled()
    expect(screen.getByRole("button", { name: "org.saveChanges" })).toBeEnabled()
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument()
    expect(container.querySelector("form > .grid")).toHaveClass("grid-cols-1", "sm:grid-cols-2")
  })

  it("does not present a failed team-member request as an empty team", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "failed" }, 500)))
    render(<MembersPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("members.loadError")
    expect(screen.getByRole("button", { name: "members.retry" })).toBeInTheDocument()
  })

  it("keeps known organization data visible but makes a failed settings load explicit and retryable", async () => {
    orgRole = "admin"
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org" ? json({ error: "failed" }, 500) : json({ provider: null, model: null }))
    vi.stubGlobal("fetch", fetchMock)
    render(<OrgPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("org.loadFailed")
    fireEvent.click(screen.getByRole("button", { name: "org.retry" }))
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/api/org")).toHaveLength(2))
  })

  it.each(["viewer", "legal"])("shows an existing logo without a remove action for %s", async (role) => {
    orgRole = role
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org" ? json({ name: "Acme", meta: {}, logo: "/logo.png" }) : json({ provider: null, model: null })))
    render(<OrgPage />)
    expect(await screen.findByRole("img", { name: "org.logoAlt" })).toHaveAttribute("src", "/logo.png")
    expect(screen.queryByRole("button", { name: "org.remove" })).not.toBeInTheDocument()
  })

  it.each([
    { role: "viewer", logo: false, aiConfig: false, aiTest: false, general: false },
    { role: "legal", logo: false, aiConfig: true, aiTest: false, general: false },
    { role: "admin", logo: true, aiConfig: true, aiTest: true, general: true },
    { role: "owner", logo: true, aiConfig: true, aiTest: true, general: true },
  ])("keeps the organization permission matrix for $role", async ({ role, logo, aiConfig, aiTest, general }) => {
    orgRole = role
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org" ? json({ name: "Acme", meta: {}, logo: null }) : json({ provider: null, model: null, hasKey: false, source: null })))
    const { container } = render(<OrgPage />)
    await screen.findByDisplayValue("Acme")
    expect(Boolean(container.querySelector('input[type="file"]'))).toBe(logo)
    expect(Boolean(screen.queryByRole("button", { name: "org.saveChanges" }))).toBe(general)
    expect(Boolean(screen.queryByRole("button", { name: "org.setupAi" }))).toBe(aiConfig)
    if (aiConfig) {
      fireEvent.click(screen.getByRole("button", { name: "org.setupAi" }))
      expect(screen.getByRole("button", { name: "org.save" })).toBeInTheDocument()
      expect(Boolean(screen.queryByRole("button", { name: "org.test" }))).toBe(aiTest)
    }
  })

  it("keeps logo upload read-only for legal and never calls the upload endpoint", async () => {
    orgRole = "legal"
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org" ? json({ name: "Acme", meta: {}, logo: null }) : json({ provider: null, model: null, hasKey: false, source: null }))
    vi.stubGlobal("fetch", fetchMock)
    const { container } = render(<OrgPage />)
    const state = await screen.findByText("org.logoReadOnly")
    fireEvent.drop(state.parentElement!, { dataTransfer: { files: [new File(["logo"], "logo.png", { type: "image/png" })] } })
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/org/logo")).toBe(false)
  })

  it("keeps an admin logo pending until organization persistence succeeds", async () => {
    orgRole = "admin"
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/org" && !init?.method) return json({ name: "Acme", meta: {}, logo: "/old.png" })
      if (String(input) === "/api/ai-status") return json({ provider: null, model: null, hasKey: false, source: null })
      if (String(input) === "/api/org/logo") return json({ url: "/new.png" }, 201)
      if (String(input) === "/api/org" && init?.method === "PATCH") return json({ error: "failed" }, 500)
      return json({})
    })
    vi.stubGlobal("fetch", fetchMock)
    const { container } = render(<OrgPage />)
    expect(await screen.findByRole("img", { name: "org.logoAlt" })).toHaveAttribute("src", "/old.png")
    fireEvent.click(screen.getByRole("button", { name: "org.remove" }))
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["logo"], "logo.png", { type: "image/png" })] } })
    expect(await screen.findByRole("img", { name: "org.logoAlt" })).toHaveAttribute("src", "/new.png")
    expect(toast.success).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "org.saveChanges" }))
    await waitFor(() => expect(screen.getByRole("img", { name: "org.logoAlt" })).toHaveAttribute("src", "/old.png"))
    expect(toast.error).toHaveBeenCalledWith("org.failedToUpdate")
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each([
    { label: "403", result: json({ error: "forbidden" }, 403) },
    { label: "500", result: json({ error: "failed" }, 500) },
    { label: "network rejection", result: new Error("offline") },
  ])("preserves AI configuration and reports a localized error after delete $label", async ({ result }) => {
    orgRole = "admin"
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/org") return json({ name: "Acme", meta: {}, logo: null })
      if (String(input) === "/api/ai-status") return json({ provider: "anthropic", model: "claude", hasKey: true, source: "org" })
      if (String(input) === "/api/org/ai-config" && init?.method === "DELETE") {
        if (result instanceof Error) throw result
        return result
      }
      return json({})
    }))
    render(<OrgPage />)
    expect(await screen.findByText("Anthropic")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "org.remove" }))
    fireEvent.click(screen.getByRole("button", { name: "org.confirm" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("org.aiRemoveFailed"))
    expect(screen.getByText("Anthropic")).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("keeps the secret visible with manual-copy feedback when clipboard rejects", async () => {
    orgRole = "admin"
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? json({ rawKey: "cf_live_secret", apiKey: { id: "key" } }, 201) : json([])))
    render(<ApiKeysPage />)
    fireEvent.click(await screen.findByRole("button", { name: "apiKeys.createNewKey" }))
    fireEvent.change(screen.getByRole("textbox", { name: "apiKeys.keyName" }), { target: { value: "Agent" } })
    fireEvent.click(screen.getByRole("button", { name: "apiKeys.createKey" }))
    expect(await screen.findByDisplayValue("cf_live_secret")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "apiKeys.copyKey" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("apiKeys.copyFailedManual")
    expect(screen.getByDisplayValue("cf_live_secret")).toBeInTheDocument()
  })

  it("does not request API keys for a member without administration permission", async () => {
    orgRole = "viewer"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<ApiKeysPage />)
    expect(await screen.findByText("apiKeys.adminOnly")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("displays localized API-key scope metadata without changing stored scope values", async () => {
    orgRole = "admin"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([{
      id: "key-1", name: "Agent", prefix: "cf_live_1234", scopes: ["read", "text_read", "write"],
      createdAt: "2026-01-01T00:00:00Z", lastUsedAt: null, expiresAt: null, revokedAt: null,
    }])))
    render(<ApiKeysPage />)
    expect(await screen.findByText(/apiKeys\.scopeRead, apiKeys\.scopeTextRead, apiKeys\.scopeWrite/)).toBeInTheDocument()
    expect(screen.queryByText(/read, text_read, write/)).not.toBeInTheDocument()
  })

  it("defaults a second API-key creation to read after a broader first key", async () => {
    orgRole = "admin"
    const submittedScopes: string[][] = []
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        submittedScopes.push(JSON.parse(String(init.body)).scopes)
        return json({ rawKey: `cf_live_secret_${submittedScopes.length}`, apiKey: { id: `key-${submittedScopes.length}` } }, 201)
      }
      return json([])
    }))
    render(<ApiKeysPage />)

    fireEvent.click(await screen.findByRole("button", { name: "apiKeys.createNewKey" }))
    fireEvent.change(screen.getByRole("textbox", { name: "apiKeys.keyName" }), { target: { value: "Broad key" } })
    fireEvent.click(screen.getByRole("radio", { name: "apiKeys.readWrite" }))
    fireEvent.click(screen.getByRole("button", { name: "apiKeys.createKey" }))
    expect(await screen.findByDisplayValue("cf_live_secret_1")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "apiKeys.done" }))

    fireEvent.click(screen.getByRole("button", { name: "apiKeys.createNewKey" }))
    expect(screen.getByRole("radio", { name: "apiKeys.readOnly" })).toBeChecked()
    fireEvent.change(screen.getByRole("textbox", { name: "apiKeys.keyName" }), { target: { value: "Second key" } })
    fireEvent.click(screen.getByRole("button", { name: "apiKeys.createKey" }))
    expect(await screen.findByDisplayValue("cf_live_secret_2")).toBeInTheDocument()
    expect(submittedScopes).toEqual([["read", "text_read", "write"], ["read"]])
  })

  it("renders localized member roles and remove action labels", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org/members" ? json({ members: [
      { id: "one", userId: "user-1", organizationId: "org-1", role: "owner", createdAt: "2026-01-01T00:00:00Z", user: { name: "Owner", email: "owner@example.com", image: null } },
      { id: "two", userId: "user-2", organizationId: "org-1", role: "member", createdAt: "2026-01-02T00:00:00Z", user: { name: "Member", email: "member@example.com", image: null } },
    ] }) : json([])))
    render(<MembersPage />)
    expect((await screen.findAllByText("members.roles.owner.label")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("members.roles.member.label").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: "members.actions.removeMember" }).length).toBeGreaterThan(0)
  })

  it("offers an authorized role-change control on desktop and mobile with localized options", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/org/members" ? json({ members: [
      { id: "one", userId: "user-1", organizationId: "org-1", role: "owner", createdAt: "2026-01-01T00:00:00Z", user: { name: "Owner", email: "owner@example.com", image: null } },
      { id: "two", userId: "user-2", organizationId: "org-1", role: "member", createdAt: "2026-01-02T00:00:00Z", user: { name: "Member", email: "member@example.com", image: null } },
    ] }) : json([])))
    const { container } = render(<MembersPage />)
    const [visibleControl] = await screen.findAllByRole("combobox", { name: "members.actions.changeRole" })
    expect(container.querySelectorAll('[aria-label="members.actions.changeRole"]')).toHaveLength(2)
    fireEvent.click(visibleControl)
    expect(await screen.findByRole("option", { name: "members.roles.admin.label" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "admin" })).not.toBeInTheDocument()
  })

  it("uses a localized invitation fallback without exposing an unknown server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/org/members" && !init?.method) return json({ members: [
        { id: "one", userId: "user-1", organizationId: "org-1", role: "owner", createdAt: "2026-01-01T00:00:00Z", user: { name: "Owner", email: "owner@example.com", image: null } },
      ] })
      if (String(input) === "/api/org/members/invite" && init?.method === "POST") return json({ error: "database_connection_string" }, 500)
      return json([])
    }))
    render(<MembersPage />)
    fireEvent.click(await screen.findByRole("button", { name: "members.inviteMember" }))
    fireEvent.change(screen.getByLabelText("members.emailAddress"), { target: { value: "new@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "members.sendInvite" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("members.failedToInvite"))
    expect(toast.error).not.toHaveBeenCalledWith("database_connection_string")
  })
})
