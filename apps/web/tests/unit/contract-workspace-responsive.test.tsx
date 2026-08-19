import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ContractDetailPage from "@/app/(app)/contracts/[id]/page"

let tabParam: string | null = null
let memberRole = "admin"
let hasAssignedPendingApproval = false
let includeContractFile = false
let includeRiskAnalysis = false
let locale = "en"
const push = vi.fn()
const router = { push }

const copy: Record<string, string> = {
  breadcrumb: "Contract navigation",
  contracts: "Contracts",
  actions: "Contract actions",
  tabs: "Contract workspace",
  changeStatus: "Change status",
  moveTo: "Move to",
  sendForApproval: "Send for approval",
  sendForSigning: "Send for signing",
  archive: "Archive",
  overview: "Overview",
  summary: "Summary",
  review: "Review",
  actionsTab: "Actions",
  reviewSuggestions: "Review suggestions",
  allSuggestionsReviewed: "All suggested details have been reviewed",
  reviewApproval: "Review approval",
  pendingApproval: "An approval decision is waiting for you",
  openAction: "Open action",
  files: "Files",
  aiExtractions: "AI extractions",
  approvals: "Approvals",
  signing: "Signing",
  obligations: "Obligations",
  risk: "Risk",
  summaryEyebrow: "Agreement operations",
  summaryTitle: "Agreement brief",
  summaryDescription: "Agreement brief",
  workflowReadiness: "Workflow readiness",
  workflowReadinessDescription: "A factual snapshot of the agreement work that is available now.",
  openTab: "Open {tab}",
  fileCount: "{count} file(s) on record",
  noApprovals: "No approvals awaiting review",
  activeActions: "{count} active action(s)",
  noActiveActions: "No active actions",
  noRiskAnalysis: "No risk analysis available",
  riskAnalysisAvailable: "Risk analysis available",
  riskPermissions: "Risk review is available to legal, admin, or owner members.",
  noRiskAnalysisYet: "No risk analysis yet",
  noRiskAnalysisDescription: "Analyze this agreement to see a reviewable breakdown across the available risk categories.",
  riskProcessing: "The document is still being converted to text.",
  riskNeedsSource: "Upload a document first to enable risk review.",
  previewFile: "Preview file",
  downloadFile: "Download file",
  deleteFile: "Delete file",
  currentVersion: "Current version",
  filesEyebrow: "Document record",
  filesTitle: "File ledger",
  reviewEyebrow: "Review queue",
  reviewTitle: "Source-backed suggestions",
  approvalsEyebrow: "Decision workflow",
  approvalsTitle: "Approval workflow",
  requestApproval: "Request approval",
  approvalRequestTitle: "Ask for a decision",
  noApprovalRequests: "No approval requests are open.",
  actionsEyebrow: "Execution tracking",
  actionsTitle: "Contract actions",
  riskEyebrow: "Assisted review",
  riskTitle: "Risk review",
  riskOverall: "Overall assessment",
  riskScore: "Score",
  riskScoreOutOf: "out of 100",
  riskAnalyzed: "Analyzed",
  riskLiability: "Liability",
  riskTermination: "Termination",
  riskAutoRenewal: "Auto renewal",
  riskIpOwnership: "IP ownership",
  riskPaymentTerms: "Payment terms",
  riskGoverningLaw: "Governing law",
  details: "Contract details",
  editContract: "Edit contract",
  editRecordEyebrow: "Contract record",
  editRecordDescription: "Update the operational details for this agreement. Changes are recorded in activity.",
  coreDetails: "Core details",
  counterpartyDetails: "Counterparty",
  termAndValue: "Term and value",
  additionalDetails: "Additional details",
  title: "Title",
  contractType: "Contract type",
  counterpartyName: "Counterparty name",
  counterpartyEmail: "Counterparty email",
  value: "Value",
  currency: "Currency",
  notes: "Notes",
  selectType: "Select type",
  saveChanges: "Save changes",
  cancel: "Cancel",
  savingChanges: "Saving changes…",
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
  tagNamePlaceholder: "Name the tag",
  editor: "Editor",
  editorPausedTitle: "Document editing is paused",
  editorPausedDescription: "Phase 0 focuses on uploading, reviewing and tracking executed contracts.",
  loadFailed: "This contract could not be loaded.",
  loadFailedDescription: "No contract data was changed.",
  retry: "Retry",
  backToContracts: "Back to contracts",
  reviewGuidance: "Review each suggestion against its cited source. Accepting updates only that field.",
  extractionInProgress: "Document analysis is in progress…",
  extractionInProgressDescription: "Suggestions will appear here with their source text and confidence.",
  noExtractions: "No suggestions are available yet. Upload a document to create reviewable suggestions.",
  rerunExtraction: "Run extraction again",
  rerunningExtraction: "Running…",
  manual: "Manual",
  manualEntry: "Manually entered or edited",
  localExtraction: "Deterministic local extraction",
  aiAssistedSuggestion: "AI-assisted suggestion",
  saving: "Saving…",
  accept: "Accept",
  reject: "Reject",
  accepted: "Accepted",
  rejected: "Rejected",
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
  useLocale: () => locale,
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1", name: "Ada Legal" } } }),
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
    return {
      contract,
      files: includeContractFile ? [{
        id: "file-1",
        filename: "Master-services-agreement.pdf",
        sizeBytes: 125_000,
        createdAt: "2026-08-01T00:00:00.000Z",
        isLatest: true,
        version: 1,
      }] : [],
      activities: [],
    }
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
  if (url.includes("/approvals")) {
    return {
      approvals: hasAssignedPendingApproval ? [{
        id: "approval-1",
        contractId: "contract-1",
        requestedById: "user-2",
        requestedBy: { id: "user-2", name: "Mina", email: "mina@example.com" },
        assignedToId: "user-1",
        assignedTo: { id: "user-1", name: "Ada Legal", email: "ada@example.com" },
        status: "pending",
        required: true,
        step: 1,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      }] : [],
    }
  }
  if (url.includes("/obligations")) return { obligations: [] }
  if (url.includes("/risk-score")) return includeRiskAnalysis ? {
    riskScore: "MEDIUM",
    riskScoredAt: "2026-08-01T00:00:00.000Z",
    riskDetails: {
      score: 52,
      summary: "A reviewable finding from the agreement record.",
      categories: {
        liability: {
          level: "MEDIUM",
          finding: "Liability is capped at twelve months of fees.",
          clause: "Liability shall not exceed fees paid in the prior twelve months.",
        },
      },
    },
  } : { riskScore: null, riskScoredAt: null, riskDetails: null }
  if (url.includes("/api/actions?")) return { actions: [{ id: "action-1", title: "Send non-renewal notice", status: "PENDING_REVIEW", dueDate: "2026-10-01T00:00:00.000Z" }] }
  if (url.startsWith("/api/alerts")) return { alerts: [] }
  return {}
}

describe("contract workspace responsive hierarchy", () => {
  beforeEach(() => {
    tabParam = null
    memberRole = "admin"
    hasAssignedPendingApproval = false
    includeContractFile = false
    includeRiskAnalysis = false
    locale = "en"
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
    expect(screen.getByRole("button", { name: "Change status" })).toHaveClass("min-h-11")
    expect(screen.getByRole("button", { name: "Send for approval" })).toHaveClass("min-h-11")
    expect(screen.getByRole("tablist", { name: "Contract workspace" })).toHaveClass("overflow-x-auto")
    expect(screen.getByTestId("contract-overview-layout")).toHaveClass("grid-cols-1", "xl:grid-cols-[minmax(0,1fr)_20rem]")
    expect(screen.getByTestId("contract-detail-grid")).toHaveClass("grid-cols-1", "sm:grid-cols-2")
  })

  it("keeps CRM out of the contract workspace and presents editing as a structured record", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    expect(screen.queryByText("Linked deals")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit contract" }))

    expect(screen.getByRole("heading", { name: "Edit contract" })).toBeVisible()
    expect(screen.getByRole("form", { name: "Edit contract" })).toBeInTheDocument()
    expect(screen.getByText("Core details")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Counterparty" })).toBeInTheDocument()
    expect(screen.getByText("Term and value")).toBeInTheDocument()
    expect(screen.getByText("Additional details")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass("min-h-11")

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved title" } })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit contract" }))
    expect(screen.getByLabelText("Title")).toHaveValue("Master Services Agreement")
  })

  it("preserves the editor deep link and every existing workspace destination", async () => {
    tabParam = "editor"
    render(<ContractDetailPage />)

    expect(await screen.findByText("Document editing is paused")).toBeVisible()
    for (const name of ["Summary", "Files", "Review", "Approvals", "Actions", "Risk"]) {
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

    fireEvent.click(screen.getByRole("tab", { name: /Review/i }))

    expect(screen.getByText("Review each suggestion against its cited source. Accepting updates only that field.")).toBeInTheDocument()
    expect(screen.getByText("Either party may terminate on thirty days notice.")).toBeInTheDocument()
    expect(screen.getByText("Source page 4")).toBeInTheDocument()
    expect(screen.getByText("92%")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toHaveClass("min-h-11")
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
  })

  it("does not expose bulk acceptance, keeping every AI value individually reviewable", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })
    fireEvent.click(screen.getByRole("tab", { name: /Review/i }))

    expect(screen.queryByRole("button", { name: "Accept All" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
  })

  it("puts pending source suggestions ahead of a separate contract action", async () => {
    vi.stubEnv("NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED", "true")
    render(<ContractDetailPage />)

    expect(await screen.findByRole("link", { name: "Review suggestions" })).toHaveAttribute(
      "href",
      "/contracts/contract-1?tab=ai-extractions",
    )
    expect(screen.queryByRole("link", { name: "Open action" })).not.toBeInTheDocument()
  })

  it("puts an approval assigned to the current person ahead of source suggestions", async () => {
    hasAssignedPendingApproval = true
    render(<ContractDetailPage />)

    expect(await screen.findByRole("link", { name: "Review approval" })).toHaveAttribute(
      "href",
      "/contracts/contract-1?tab=approvals",
    )
    expect(screen.queryByRole("link", { name: "Review suggestions" })).not.toBeInTheDocument()
  })

  it("uses task-oriented workspace navigation while retaining existing tab values", async () => {
    render(<ContractDetailPage />)

    await screen.findByRole("heading", { name: "Master Services Agreement" })
    expect(screen.getByRole("tab", { name: "Summary" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Review/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Actions" })).toBeInTheDocument()
  })

  it("gives every operational tab a clear, consistent workspace context", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    expect(screen.getByRole("heading", { name: "Agreement brief", level: 2 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Files" }))
    expect(screen.getByRole("heading", { name: "File ledger", level: 2 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: /Review/ }))
    expect(screen.getByRole("heading", { name: "Source-backed suggestions", level: 2 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Approvals" }))
    expect(screen.getByRole("heading", { name: "Approval workflow", level: 2 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }))
    expect(screen.getByRole("heading", { name: "Contract actions", level: 2 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Risk" }))
    expect(screen.getByRole("heading", { name: "Risk review", level: 2 })).toBeInTheDocument()
  })

  it("surfaces factual workflow readiness with deep links instead of an invented contract score", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    expect(screen.getByRole("heading", { name: "Workflow readiness", level: 2 })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Files" })).toHaveAttribute(
      "href",
      "/contracts/contract-1?tab=documents",
    )
    expect(screen.getByText("No risk analysis available")).toBeInTheDocument()
  })

  it("keeps file-level operations large enough to use on touch devices", async () => {
    includeContractFile = true
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    fireEvent.click(screen.getByRole("tab", { name: /Files/ }))
    expect(screen.getByRole("button", { name: "Preview file" })).toHaveClass("min-h-11", "min-w-11")
    expect(screen.getByRole("button", { name: "Download file" })).toHaveClass("min-h-11", "min-w-11")
    expect(screen.getByRole("button", { name: "Delete file" })).toHaveClass("min-h-11", "min-w-11")
  })

  it("does not leave the current document version label hard-coded to English", async () => {
    includeContractFile = true
    tabParam = "documents"
    render(<ContractDetailPage />)

    expect(await screen.findByText("Current version")).toBeVisible()
  })

  it("keeps the risk capability boundary explicit for read-only members", async () => {
    memberRole = "viewer"
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    fireEvent.click(screen.getByRole("tab", { name: "Risk" }))
    expect(screen.getByText("Risk review is available to legal, admin, or owner members.")).toBeInTheDocument()
  })

  it("labels populated risk findings as a localized, reviewable assessment", async () => {
    includeRiskAnalysis = true
    tabParam = "risk"
    render(<ContractDetailPage />)

    expect(await screen.findByText("Overall assessment")).toBeVisible()
    expect(screen.getByText("Score")).toBeVisible()
    expect(screen.getByText("out of 100")).toBeVisible()
    expect(screen.getByText("Liability")).toBeVisible()
    expect(screen.getByText("Analyzed")).toBeVisible()
  })

  it("uses the workspace locale contract for an empty approval workflow", async () => {
    tabParam = "approvals"
    render(<ContractDetailPage />)

    expect(await screen.findByText("No approval requests are open.")).toBeVisible()
  })

  it("uses the workspace locale contract inside the approval request dialog", async () => {
    tabParam = "approvals"
    render(<ContractDetailPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Request approval" }))
    expect(screen.getByRole("heading", { name: "Ask for a decision" })).toBeVisible()
  })

  it("does not leave tag entry behind as a hard-coded English control", async () => {
    render(<ContractDetailPage />)
    await screen.findByRole("heading", { name: "Master Services Agreement" })

    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    expect(screen.getByPlaceholderText("Name the tag")).toBeVisible()
  })

  it("shows a recovery state rather than a blank page when the contract request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url === "/api/contracts/contract-1") {
        return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })
      }
      return new Response(JSON.stringify(apiResponse(url)), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    render(<ContractDetailPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent(/This contract could not be loaded\.\s*No contract data was changed\./)
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to contracts" })).toHaveAttribute("href", "/contracts")
  })

  it("shows recovery instead of leaving the loading skeleton after the primary request times out", async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url === "/api/contracts/contract-1") {
          return new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
          })
        }
        return Promise.resolve(new Response(JSON.stringify(apiResponse(url)), { status: 200, headers: { "Content-Type": "application/json" } }))
      }))

      render(<ContractDetailPage />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })

      expect(screen.getByRole("alert")).toHaveTextContent("This contract could not be loaded.")
    } finally {
      vi.useRealTimers()
    }
  })

  it("renders the contract record while secondary workspace reads are still pending", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url === "/api/contracts/contract-1") {
        return Promise.resolve(new Response(JSON.stringify(apiResponse(url)), { status: 200, headers: { "Content-Type": "application/json" } }))
      }
      return new Promise<Response>(() => {})
    }))

    render(<ContractDetailPage />)

    expect(await screen.findByRole("heading", { name: "Master Services Agreement", level: 1 })).toBeInTheDocument()
  })

  it("keeps successful secondary panels available when one secondary read fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/extractions")) {
        return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })
      }
      return new Response(JSON.stringify(apiResponse(url)), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    render(<ContractDetailPage />)

    expect(await screen.findByRole("heading", { name: "Master Services Agreement", level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole("status")).toHaveTextContent("No contract data was changed.")
    fireEvent.click(screen.getByRole("tab", { name: "Approvals" }))
    expect(screen.getByText("No approval requests are open.")).toBeInTheDocument()
  })

  it("aborts superseded secondary reads when the user retries", async () => {
    let loadNumber = 0
    const secondarySignals: AbortSignal[] = []
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url === "/api/contracts/contract-1") {
        loadNumber += 1
        return Promise.resolve(new Response(JSON.stringify(apiResponse(url)), { status: 200, headers: { "Content-Type": "application/json" } }))
      }
      if (loadNumber === 1 && url.includes("/extractions")) {
        return Promise.resolve(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }))
      }
      if (loadNumber === 1 && /\/api\/(alerts|contracts\/contract-1\/(approvals|obligations|risk-score))/.test(url)) {
        if (init?.signal) secondarySignals.push(init.signal)
        return new Promise<Response>(() => {})
      }
      return Promise.resolve(new Response(JSON.stringify(apiResponse(url)), { status: 200, headers: { "Content-Type": "application/json" } }))
    }))

    render(<ContractDetailPage />)

    expect(await screen.findByRole("status")).toBeInTheDocument()
    expect(secondarySignals.length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(secondarySignals.every((signal) => signal.aborted)).toBe(true)
  })

  it("formats summary dates and values in the active locale without inventing a currency", async () => {
    locale = "de"
    render(<ContractDetailPage />)

    await screen.findByRole("heading", { name: "Master Services Agreement" })
    expect(screen.getByText("Contract value").parentElement?.textContent?.replace(/\u00a0/g, " ")).toContain(
      new Intl.NumberFormat("de", { style: "currency", currency: "USD" }).format(120000).replace(/\u00a0/g, " "),
    )
    expect(screen.getByText("Start date").parentElement).toHaveTextContent(
      new Intl.DateTimeFormat("de", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(contract.startDate)),
    )
  })
})
