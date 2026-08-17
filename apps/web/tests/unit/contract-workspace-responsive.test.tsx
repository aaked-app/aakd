import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ContractDetailPage from "@/app/(app)/contracts/[id]/page"

let tabParam: string | null = null
let memberRole = "admin"
const push = vi.fn()
const router = { push }

const copy: Record<string, string> = {
  breadcrumb: "Contract navigation",
  actions: "Contract actions",
  tabs: "Contract workspace",
  changeStatus: "Change status",
  moveTo: "Move to",
  sendForApproval: "Send for approval",
  sendForSigning: "Send for signing",
  archive: "Archive",
  overview: "Overview",
  files: "Files",
  aiExtractions: "AI extractions",
  approvals: "Approvals",
  signing: "Signing",
  obligations: "Obligations",
  risk: "Risk",
  details: "Contract details",
  editContract: "Edit contract",
  activity: "Activity",
  noActivity: "No activity yet",
  counterparty: "Counterparty",
  contractValue: "Contract value",
  startDate: "Start date",
  endDate: "End date",
  owner: "Owner",
  type: "Type",
  governingLaw: "Governing law",
  noticePeriod: "Notice period",
  folder: "Folder",
  days: "days",
  removeTag: "Remove {tag}",
  addTag: "Add tag",
  editor: "Editor",
  sourcePage: "Source page {page}",
  "DRAFT": "Draft",
  "ACTIVE": "Active",
}

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "contract-1" }),
  useSearchParams: () => new URLSearchParams(tabParam ? `tab=${tabParam}` : ""),
  useRouter: () => router,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const message = copy[key] ?? key
    return Object.entries(values ?? {}).reduce(
      (result, [name, value]) => result.replace(`{${name}}`, String(value)),
      message,
    )
  },
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1", name: "Ada Legal" } } }),
}))

vi.mock("@/components/editor/editor-tab", () => ({
  EditorTab: () => <div>Document editor workspace</div>,
}))

vi.mock("@/components/crm/contract-crm-section", () => ({
  ContractCrmSection: () => <div>Linked deals</div>,
}))

vi.mock("@/components/obligations/obligation-list", () => ({
  ObligationList: () => <div>Obligation list</div>,
}))

vi.mock("@/components/relative-time", () => ({
  RelativeTime: () => <span>recently</span>,
}))

const contract = {
  id: "contract-1",
  title: "Master Services Agreement",
  status: "DRAFT",
  counterpartyName: "Acme Ltd",
  value: 120000,
  currency: "USD",
  startDate: "2026-08-01T00:00:00.000Z",
  endDate: "2027-08-01T00:00:00.000Z",
  owner: { name: "Ada Legal" },
  contractType: "MSA",
  governingLaw: "England and Wales",
  noticePeriodDays: 30,
  folder: { name: "Customer agreements" },
  tags: [{ id: "tag-1", name: "Priority" }],
  notes: null,
  signingStatus: null,
}

function apiResponse(url: string) {
  if (url === "/api/contracts/contract-1") {
    return { contract, files: [], activities: [] }
  }
  if (url === "/api/contracts/contract-1/extractions") {
    return {
      extractions: [{
        id: "extraction-1",
        field: "termination",
        rawValue: "30 days notice",
        confidence: 0.92,
        sourceText: "Either party may terminate on thirty days notice.",
        sourcePage: 4,
        status: "pending",
      }],
    }
  }
  if (url === "/api/org/members") {
    return [{ userId: "user-1", role: memberRole, user: { name: "Ada Legal", email: "ada@example.com" } }]
  }
  if (url === "/api/tags") return []
  if (url.includes("/approvals")) return { approvals: [] }
  if (url.includes("/obligations")) return { obligations: [] }
  if (url.includes("/risk-score")) return { riskScore: null, riskScoredAt: null, riskDetails: null }
  if (url.startsWith("/api/alerts")) return { alerts: [] }
  return {}
}

describe("contract workspace responsive hierarchy", () => {
  beforeEach(() => {
    tabParam = null
    memberRole = "admin"
    push.mockReset()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      return new Response(JSON.stringify(apiResponse(url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }))
  })

  it("makes the contract identity primary and keeps actions usable at narrow widths", async () => {
    render(<ContractDetailPage />)

    expect(await screen.findByRole("heading", { name: "Master Services Agreement", level: 1 })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Contract navigation" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Contract actions" })).toHaveClass("flex-wrap")
    expect(screen.getByRole("tablist", { name: "Contract workspace" })).toHaveClass("overflow-x-auto")
    expect(screen.getByTestId("contract-overview-layout")).toHaveClass("grid-cols-1", "xl:grid-cols-[minmax(0,1fr)_20rem]")
    expect(screen.getByTestId("contract-detail-grid")).toHaveClass("grid-cols-1", "sm:grid-cols-2")
  })

  it("preserves the editor deep link and every existing workspace destination", async () => {
    tabParam = "editor"
    render(<ContractDetailPage />)

    expect(await screen.findByText("Document editor workspace")).toBeVisible()
    for (const name of ["Overview", "Files", "AI extractions", "Approvals", "Obligations", "Risk"]) {
      expect(screen.getByRole("tab", { name: new RegExp(name, "i") })).toBeInTheDocument()
    }
  })

  it("preserves role-gated approval and archive actions", async () => {
    memberRole = "member"
    render(<ContractDetailPage />)

    await screen.findByRole("heading", { name: "Master Services Agreement" })
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Send for approval" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()
    })
  })

  it("keeps AI output reviewable with exact source, page, confidence, and review controls", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    fireEvent.click(screen.getByRole("tab", { name: /AI extractions/i }))

    expect(screen.getByText("Either party may terminate on thirty days notice.")).toBeInTheDocument()
    expect(screen.getByText("Source page 4")).toBeInTheDocument()
    expect(screen.getByText("92%")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
  })

  it("does not expose bulk acceptance, keeping every AI value individually reviewable", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })
    fireEvent.click(screen.getByRole("tab", { name: /AI extractions/i }))

    expect(screen.queryByRole("button", { name: "Accept All" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
  })
})
