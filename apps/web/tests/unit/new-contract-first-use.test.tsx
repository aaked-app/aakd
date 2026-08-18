import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

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

describe("new contract first-use presentation", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
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
})
