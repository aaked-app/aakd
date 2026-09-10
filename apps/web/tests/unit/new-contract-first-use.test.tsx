import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import NewContractPage from "@/app/(app)/contracts/new/page"

const labels: Record<string, string> = {
  "title": "Contracts",
  "newContract": "New contract",
  "create.workspaceEyebrow": "Contract intake",
  "create.pageTitle": "Add an agreement to the workspace",
  "create.pageDescription": "Upload the signed source, review suggested details, then create the contract record.",
  "create.workflowLabel": "Contract intake progress",
  "create.stepUpload": "Upload agreement",
  "create.stepReview": "Review details",
  "create.stepCreate": "Create record",
  "create.dropTitle": "Drop your contract here",
  "create.uploadHint": "PDF or DOCX · Max 50 MB",
  "create.uploadPrivacy": "The original file stays attached to the contract record.",
  "create.browseFiles": "Browse files",
  "create.continueReview": "Continue to review",
  "create.removeFile": "Remove file",
  "create.reviewStatus": "Review required",
  "create.sourceAttached": "Source attached",
  "create.readingDocument": "Reading document",
  "create.continueWithoutExtraction": "Continue without extraction",
  "create.manualMode": "Manual review",
  "create.basicInformation": "Basic information",
  "create.contractTitle": "Contract title",
  "create.contractTitlePlaceholder": "Service Agreement Q1 2026",
  "create.contractType": "Contract type",
  "create.selectType": "Select type",
  "create.description": "Description",
  "create.descriptionPlaceholder": "Brief summary",
  "create.parties": "Parties",
  "create.counterpartyName": "Counterparty name",
  "create.counterpartyPlaceholder": "Acme Corporation",
  "create.timeline": "Timeline",
  "create.startDate": "Start date",
  "create.endDate": "End date",
  "create.financial": "Financial",
  "create.contractValue": "Contract value",
  "create.currency": "Currency",
  "create.paymentTerms": "Payment terms",
  "create.paymentTermsPlaceholder": "Net 30",
  "create.autoRenewal": "Auto-renewal",
  "create.autoRenewalDescription": "Contract renews automatically",
  "create.toggleAutoRenewal": "Toggle auto-renewal",
  "create.governingLaw": "Governing law",
  "create.governingLawPlaceholder": "State of Delaware",
  "create.extractionReview": "Suggested details",
  "create.aiReading": "Reading the document in the background. You can keep editing.",
  "create.noConfidence": "No suggested details are available yet.",
  "create.reviewExtractedValues": "Review every suggested value before creating the record.",
  "create.changeFile": "Change file",
  "create.back": "Back",
  "create.createContract": "Create contract",
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const scopedKey = namespace === "contracts.create" ? `create.${key}` : key
    return labels[scopedKey] ?? key
  },
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }))
vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "intake-test-user" } } }),
  useActiveOrganization: () => ({ data: { id: "intake-test-org" } }),
}))

describe("new contract first-use presentation", () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("retries an uncertain save with the same file, identity and reviewed values", async () => {
    const requests: globalThis.FormData[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/contracts/intake") {
        requests.push(options!.body as globalThis.FormData)
        throw new TypeError("Network disconnected after commit")
      }
      return Response.json({ error: "Preview unavailable" }, { status: 503 })
    }))
    render(<NewContractPage />)
    fireEvent.change(screen.getByLabelText("Browse files"), { target: { files: [new File(["%PDF-1.7"], "source.pdf", { type: "application/pdf" })] } })
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }))
    fireEvent.change(screen.getByLabelText(/Contract title/), { target: { value: "Reviewed title" } })
    fireEvent.click(screen.getByRole("button", { name: "Create contract" }))
    await waitFor(() => expect(requests).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole("button", { name: "retrySave" })).toBeEnabled())
    expect(screen.getByLabelText(/Contract title/)).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "retrySave" }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0]).toBe(requests[1])
    expect(toast.error).not.toHaveBeenCalled()
    expect(JSON.parse(String(requests[1].get("metadata"))).title).toBe("Reviewed title")
    expect(sessionStorage.getItem("aakd:intake:intake-test-user:intake-test-org")).toBe(requests[0].get("requestId"))
    expect([...requests[0].keys()].sort()).toEqual(["extractions", "file", "metadata", "requestId"])
  })

  it("shows a restrained three-step intake before asking for a file", () => {
    render(<NewContractPage />)

    expect(screen.getByRole("heading", { name: "Add an agreement to the workspace" })).toBeInTheDocument()
    const workflow = screen.getByRole("list", { name: "Contract intake progress" })
    expect(workflow).toHaveTextContent("Upload agreement")
    expect(workflow).toHaveTextContent("Review details")
    expect(workflow).toHaveTextContent("Create record")
    expect(screen.getByText("The original file stays attached to the contract record.")).toBeInTheDocument()
    expect(screen.queryByText(/powered by ai/i)).not.toBeInTheDocument()
  })

  it("keeps document reading reviewable and lets the user continue manually", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)))
    render(<NewContractPage />)

    const file = new File(["%PDF-1.7"], "northwind.pdf", { type: "application/pdf" })
    fireEvent.change(screen.getByLabelText("Browse files"), { target: { files: [file] } })
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }))

    expect(await screen.findByText("Reading document")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Contract intake progress" })).toHaveTextContent("Review details")
    fireEvent.click(screen.getByRole("button", { name: "Continue without extraction" }))

    await waitFor(() => expect(screen.getByText("Manual review")).toBeInTheDocument())
    expect(screen.getByLabelText(/Contract title/)).toHaveValue("Northwind")
  })

  it("polls a queued preview and never overwrites fields edited while it runs", async () => {
    let finishPoll: ((response: Response) => void) | undefined
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        jobId: "00000000-0000-4000-8000-000000000001",
        status: "pending",
      }, { status: 202 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishPoll = resolve }))
    vi.stubGlobal("fetch", fetchMock)
    render(<NewContractPage />)

    const file = new File(["%PDF-1.7"], "northwind.pdf", { type: "application/pdf" })
    fireEvent.change(screen.getByLabelText("Browse files"), { target: { files: [file] } })
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    fireEvent.change(screen.getByLabelText(/Contract title/), { target: { value: "Human title" } })
    await act(async () => {
      finishPoll?.(Response.json({
        status: "completed",
        result: {
          title: "AI title",
          counterpartyName: "Synthetic Orchard Labs",
          confidence: { title: 0.9, counterpartyName: 0.8 },
        },
      }))
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/Contract title/)).toHaveValue("Human title")
      expect(screen.getByLabelText(/Counterparty name/)).toHaveValue("Synthetic Orchard Labs")
    })
  })
})
