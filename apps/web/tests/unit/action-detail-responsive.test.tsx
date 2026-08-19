import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { Suspense } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ActionDetailPage from "@/app/(app)/actions/[id]/page"
import en from "@/messages/en.json"
import ar from "@/messages/ar.json"

let locale = "en"
let role = "member"
const replace = vi.fn()
const router = { replace }
const catalogs = { en, ar }

function translate(namespace: string, key: string, values?: Record<string, unknown>) {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) =>
    current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined,
  catalogs[locale as keyof typeof catalogs])
  if (typeof value !== "string") throw new Error(`Missing translation: ${locale}.${namespace}.${key}`)
  return Object.entries(values ?? {}).reduce((result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)), value)
}
const actionQueueTranslator = (key: string, values?: Record<string, unknown>) => translate("actionQueue", key, values)

async function renderActionPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ActionDetailPage params={Promise.resolve({ id: "action-1" })} />
      </Suspense>,
    )
  })
}

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: () => actionQueueTranslator,
}))
vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
  useActiveOrganization: () => ({ data: { members: [{ userId: "user-1", role }] } }),
}))

const action = {
  id: "action-1", title: "Send report", description: "Monthly report", condition: "Section 4",
  dueDate: "2026-09-01T00:00:00.000Z", sourceText: "Provider shall send a report.", sourcePage: 3,
  confidence: 0.9, reviewStatus: "reviewed", status: "IN_PROGRESS", version: 4, hasCitation: true,
  evidenceRequired: "completion_note", contract: { id: "contract-1", title: "Northwind MSA", counterpartyName: "Northwind" },
  assignee: { id: "user-1", name: "Wassim" },
  approvals: [{ id: "approval-1", status: "approved", required: true, actionVersion: 4, step: 1, comment: null, decidedAt: "2026-08-18T10:00:00.000Z", createdAt: "2026-08-18T09:00:00.000Z", requestedBy: { id: "user-1", name: "Wassim" }, assignedTo: { id: "reviewer-1", name: "Reviewer" } }],
  evidence: [{ id: "evidence-1", kind: "completion_note", note: "Report sent", sourceUrl: null, recordedBy: { name: "Wassim" }, createdAt: "2026-08-18T11:00:00.000Z" }],
  activities: [],
}

describe("Action detail approval and role presentation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED = "true"
    locale = "en"
    role = "member"
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/actions/")
        ? new Response(JSON.stringify(action), { status: 200 })
        : new Response(JSON.stringify([]), { status: 200 })))
  })
  afterEach(() => {
    cleanup()
    delete process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  for (const language of ["en", "ar"] as const) {
    it(`renders lowercase approved context without missing ${language} messages`, async () => {
      locale = language
      await renderActionPage()
      expect(await screen.findByText(action.title)).toBeInTheDocument()
      expect(screen.getByText(translate("actionQueue", "approvalStatuses.approved"))).toBeInTheDocument()
      expect(screen.getByRole("button", { name: translate("actionQueue", "complete") })).toBeEnabled()
    })
  }

  it("shows viewers a read-only explanation instead of mutation controls", async () => {
    role = "viewer"
    await renderActionPage()
    expect(await screen.findByText(action.title)).toBeInTheDocument()
    expect(screen.getByText(translate("actionQueue", "readOnly"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: translate("actionQueue", "complete") })).not.toBeInTheDocument()
  })

  it("redirects without reading action data when the UI rollout flag is off", async () => {
    process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED = "false"
    const fetchMock = vi.mocked(fetch)
    await renderActionPage()

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
