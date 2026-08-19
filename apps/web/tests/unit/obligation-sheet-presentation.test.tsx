import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ObligationSheet } from "@/components/obligations/obligation-sheet"

const copy: Record<string, string> = {
  newTitle: "New obligation",
  newSubtitle: "Track a commitment or deliverable from this contract.",
  recordEyebrow: "Contract action",
  coreDetails: "Core details",
  planningAndOwnership: "Plan and ownership",
  sourceContext: "Source context",
  titleField: "Title",
  description: "Description",
  priorityLabel: "Priority",
  dueDate: "Due date",
  reminder: "Reminder",
  assignee: "Owner",
  clauseReference: "Clause reference",
  titlePlaceholder: "Title",
  descriptionPlaceholder: "Description",
  clauseReferencePlaceholder: "Clause reference",
  unassigned: "Unassigned",
  cancel: "Cancel",
  createObligation: "Create obligation",
  priority: "Priority",
  "priority.LOW": "Low",
  "priority.MEDIUM": "Medium",
  "priority.HIGH": "High",
  reminderOptionOne: "{count} day",
  reminderOptionMany: "{count} days",
}

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const message = copy[key] ?? key
    return Object.entries(values ?? {}).reduce(
      (result, [name, value]) => result.replace(`{${name}}`, String(value)),
      message,
    )
  },
}))

describe("obligation editor presentation", () => {
  it("uses the same structured record sheet as contract editing", () => {
    render(
      <ObligationSheet
        open
        onOpenChange={vi.fn()}
        contractId="contract-1"
        obligation={null}
        members={[]}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByRole("dialog", { name: "New obligation" })).toBeVisible()
    expect(screen.getByText("Contract action")).toBeInTheDocument()
    expect(screen.getByRole("form", { name: "New obligation" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Core details" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Plan and ownership" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Source context" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create obligation" })).toHaveClass("min-h-11")
  })
})
