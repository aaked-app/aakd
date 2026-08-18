import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ObligationList } from "@/components/obligations/obligation-list"

const copy: Record<string, string> = {
  filterAll: "All",
  "status.PENDING": "Pending",
  "status.IN_PROGRESS": "In progress",
  "status.OVERDUE": "Overdue",
  "status.COMPLETED": "Completed",
  actionQueueEmptyTitle: "No tracked contract actions",
  actionQueueEmptyDescription: "Record commitments from this agreement and keep their ownership and evidence together.",
  dueOn: "Due {date}",
  pendingStatus: "Pending state",
  "priority.HIGH": "High importance",
  deleteConfirmTitle: "Delete obligation?",
  deleteConfirm: "Delete obligation “{title}”? This cannot be undone.",
  cancel: "Cancel",
  confirmDelete: "Delete",
  deleting: "Deleting…",
}
let locale = "en"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce((message, [name, value]) => message.replace(`{${name}}`, String(value)), key === "status.PENDING" ? copy.pendingStatus : copy[key] ?? key),
  useLocale: () => locale,
}))

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }))
vi.mock("@/components/obligations/obligation-sheet", () => ({ ObligationSheet: () => null }))
vi.mock("@/components/obligations/subtask-list", () => ({ SubTaskList: () => null }))

describe("contract actions list presentation", () => {
  beforeEach(() => {
    locale = "en"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it("uses the localized contract-actions empty state rather than generic obligation copy", () => {
    render(
      <ObligationList
        contractId="contract-1"
        obligations={[]}
        members={[]}
        contractArchived={false}
        role="admin"
        hasContractFile={false}
        hasExtractedText={false}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText("No tracked contract actions")).toBeVisible()
    expect(screen.getByText("Record commitments from this agreement and keep their ownership and evidence together.")).toBeVisible()
  })

  it("formats a recorded action due date in the active locale", () => {
    locale = "de"
    render(
      <ObligationList
        contractId="contract-1"
        obligations={[{
          id: "obligation-1",
          title: "Send the notice",
          dueDate: "2026-01-15T00:00:00.000Z",
          status: "PENDING",
          priority: "HIGH",
          subTasks: [],
          description: null,
          clauseReference: null,
          assignee: null,
        }] as never}
        members={[]}
        contractArchived={false}
        role="viewer"
        hasContractFile={false}
        hasExtractedText={false}
        onChange={vi.fn()}
      />,
    )

    const expectedDate = new Intl.DateTimeFormat("de", { dateStyle: "medium", timeZone: "UTC" }).format(new Date("2026-01-15T00:00:00.000Z"))
    expect(screen.getByText(`Due ${expectedDate}`)).toBeVisible()
    expect(screen.getAllByText("Pending state")).toHaveLength(2)
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument()
    expect(screen.getByTitle("High importance")).toBeVisible()
  })

  it("uses the shared confirmation dialog before deleting an action", () => {
    render(
      <ObligationList
        contractId="contract-1"
        obligations={[{
          id: "obligation-1",
          title: "Send the notice",
          dueDate: "2026-01-15T00:00:00.000Z",
          status: "PENDING",
          priority: "HIGH",
          subTasks: [],
          description: null,
          clauseReference: null,
          assignee: null,
        }] as never}
        members={[]}
        contractArchived={false}
        role="admin"
        hasContractFile={false}
        hasExtractedText={false}
        onChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "deleteObligation" }))
    expect(screen.getByRole("heading", { name: "Delete obligation?" })).toBeVisible()
    expect(screen.getByText("Delete obligation “Send the notice”? This cannot be undone.")).toBeVisible()
  })
})
