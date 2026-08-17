import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ObligationDetailPage from "@/app/(app)/contracts/[id]/obligations/[obligationId]/page"
import { SubTaskList } from "@/components/obligations/subtask-list"
import type { Obligation } from "@/components/obligations/types"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

let memberRole = "admin"
let memberStatus = 200
let testLocale = "en"
let obligationStatus = 200
let obligation: Obligation
let contractActivities: Array<Record<string, unknown>>
const members = [
  {
    id: "member-1",
    userId: "user-1",
    organizationId: "org-1",
    role: "admin",
    createdAt: "2026-08-17T10:00:00.000Z",
    user: { id: "user-1", name: "Ada Legal", email: "ada@example.com" },
  },
]

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "contract-1", obligationId: "obl-1" }),
}))

vi.mock("next-intl", () => ({
  useLocale: () => testLocale,
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const copy: Record<string, string> = {
      backToContract: "Back to contract",
      statusLabel: "Status",
      "status.PENDING": "Pending",
      "status.IN_PROGRESS": "In progress",
      "status.COMPLETED": "Completed",
      "status.OVERDUE": "Overdue",
      "priority.LOW": "Low",
      "priority.MEDIUM": "Medium",
      "priority.HIGH": "High",
      start: "Start",
      complete: "Complete",
      reopen: "Reopen",
      edit: "Edit obligation",
      delete: "Delete obligation",
      description: "What is required",
      noDescription: "No additional description.",
      tasks: "Sub-tasks",
      taskProgress: "{done} of {total} complete",
      details: "Details",
      dueDate: "Due date",
      priority: "Priority",
      assignee: "Owner",
      unassigned: "Unassigned",
      clauseReference: "Source reference",
      reminder: "Reminder",
      reminderDaysBeforeOne: "{count} day before due",
      reminderDaysBeforeMany: "{count} days before due",
      reminderOptionOne: "{count} day",
      reminderOptionMany: "{count} days",
      createdBy: "Created by",
      completedBy: "Completed by",
      history: "History",
      historyScope: "Showing matching activity from the contract's latest 20 events. Older events may not appear.",
      historyNone: "No matching activity appears in the contract's latest 20 events.",
      historyRefreshUnavailable: "Recent activity could not be refreshed. The entries below may be out of date.",
      historySubtaskCreated: testLocale === "fr" ? "Sous-tâche créée : {detail}" : "Sub-task created: {detail}",
      historySubtaskUpdated: "Sub-task updated: {detail}",
      historySubtaskCompleted: "Sub-task completed: {detail}",
      historySubtaskReopened: "Sub-task reopened: {detail}",
      historySubtaskDeleted: "Sub-task deleted: {detail}",
      historyObligationCreated: "Obligation created: {detail}",
      historyObligationUpdated: "Obligation updated: {detail}",
      historyObligationCompleted: "Obligation completed: {detail}",
      historyObligationDeleted: "Obligation deleted: {detail}",
      sourceUnavailable: "No source reference is recorded.",
      readOnly: "Read-only access",
      readOnlyDescription: "You can review this obligation but cannot change it.",
      notFoundTitle: "Obligation not found",
      notFoundDescription: "This obligation may have been removed or is not available to you.",
      unavailableTitle: "Obligation unavailable",
      unavailableDescription: "We couldn't load this obligation. Your data is unchanged.",
      retry: "Retry",
      membersLoading: "Loading organization members…",
      membersUnavailable: "Organization members are unavailable. Editing is disabled until they can be loaded.",
      retryMembers: "Retry member list",
      deleteConfirmTitle: "Delete obligation?",
      deleteConfirm: "Delete this obligation? This cannot be undone.",
      addTaskPlaceholder: "Add a sub-task",
      addTask: "Add",
      emptyTasks: "No sub-tasks yet.",
      toggleTask: "Mark {title} complete",
      deleteTask: "Delete {title}",
      taskUpdateError: "Failed to update sub-task",
      taskDeleteError: "Failed to delete sub-task",
      taskAddError: "Failed to add sub-task",
      taskLimitError: "Maximum 20 sub-tasks per obligation",
      editTitle: "Edit obligation",
      editSubtitle: "Update the details below and save.",
      closeEditor: "Close obligation editor",
      titleField: "Title",
      titlePlaceholder: "e.g. Submit quarterly compliance report",
      descriptionPlaceholder: "Optional context",
      clauseReferencePlaceholder: "e.g. Section 4.2",
      cancel: "Cancel",
      saveChanges: "Save changes",
    }
    return Object.entries(values ?? {}).reduce(
      (message, [name, value]) => message.replace(`{${name}}`, String(value)),
      copy[key] ?? key,
    )
  },
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1", name: "Ada Legal" } } }),
  useActiveOrganization: () => ({
    data: { id: "org-1", members: [{ userId: "user-1", role: memberRole }] },
  }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((next) => { resolve = next })
  return { promise, resolve }
}

function leafKeys(value: unknown, prefix = ""): string[] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
}

function buildObligation(): Obligation {
  return {
    id: "obl-1",
    contractId: "contract-1",
    title: "Submit quarterly compliance report",
    description: "Send the signed report to the customer.",
    clauseReference: "Section 4.2",
    priority: "HIGH",
    status: "PENDING",
    dueDate: "2026-09-18T00:00:00.000Z",
    reminderDays: 7,
    reminderSentAt: null,
    assignee: { id: "user-1", name: "Ada Legal", email: "ada@example.com" },
    completedAt: null,
    completedBy: null,
    createdBy: { id: "user-1", name: "Ada Legal" },
    subTasks: [{
      id: "sub-1",
      title: "Collect evidence",
      isCompleted: false,
      completedAt: null,
      completedBy: null,
      createdAt: "2026-08-17T10:00:00.000Z",
    }],
    createdAt: "2026-08-17T10:00:00.000Z",
    updatedAt: "2026-08-17T10:00:00.000Z",
  }
}

describe("obligation detail responsive action surface", () => {
  beforeEach(() => {
    memberRole = "admin"
    memberStatus = 200
    testLocale = "en"
    obligationStatus = 200
    obligation = buildObligation()
    contractActivities = [
      { id: "activity-1", action: "OBLIGATION_UPDATED", detail: "Sub-task created: Collect evidence", metadata: { obligationId: "obl-1" }, createdAt: "2026-08-17T10:00:00.000Z", user: { name: "Ada Legal" } },
      { id: "activity-2", action: "OBLIGATION_UPDATED", detail: "Another obligation changed", metadata: { obligationId: "obl-2" }, createdAt: "2026-08-17T09:00:00.000Z", user: { name: "Ada Legal" } },
    ]
    vi.stubGlobal("confirm", vi.fn(() => true))
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/obligations/obl-1")) return response(obligation, obligationStatus)
      if (url === "/api/contracts/contract-1") {
        return response({
          id: "contract-1",
          title: "Master Services Agreement",
          activities: contractActivities,
        })
      }
      if (url === "/api/org/members") return response({ members }, memberStatus)
      throw new Error(`Unexpected fetch: ${url}`)
    }))
  })

  it("reads the flat contract response and presents an action-first responsive hierarchy", async () => {
    render(<ObligationDetailPage />)

    const heading = await screen.findByRole("heading", { name: obligation.title, level: 1 })
    expect(heading).toBeVisible()
    expect(heading).toHaveClass("break-words", "[overflow-wrap:anywhere]")
    expect(screen.getByText("Master Services Agreement")).toBeVisible()
    expect(screen.getByTestId("obligation-detail-layout")).toHaveClass(
      "grid-cols-1",
      "xl:grid-cols-[minmax(0,1fr)_20rem]",
    )
    expect(screen.getByRole("group", { name: "Status" })).toHaveClass("flex-wrap")
    expect(screen.getByRole("button", { name: "Start" })).toHaveClass("min-h-11")
    expect(screen.getByText("Sep 18, 2026")).toBeVisible()
    expect(screen.getByText("Section 4.2")).toBeVisible()
    expect(screen.getByText("Sub-task created: Collect evidence")).toBeVisible()
    expect(screen.getByText("Collect evidence")).toHaveClass("break-words", "[overflow-wrap:anywhere]")
    expect(screen.queryByText("Another obligation changed")).not.toBeInTheDocument()
    expect(screen.getByText("Showing matching activity from the contract's latest 20 events. Older events may not appear.")).toBeVisible()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 of 1 complete")
  })

  it("localizes known structured audit events without translating unknown detail", async () => {
    testLocale = "fr"
    contractActivities = [
      {
        id: "activity-1",
        action: "OBLIGATION_UPDATED",
        detail: "Sub-task created: Collect evidence",
        metadata: { obligationId: "obl-1", subtaskId: "sub-1", subtaskOperation: "created" },
        createdAt: "2026-08-17T10:00:00.000Z",
        user: { name: "Ada Legal" },
      },
      {
        id: "activity-2",
        action: "OBLIGATION_UPDATED",
        detail: "External sync: Keep this verbatim",
        metadata: { obligationId: "obl-1" },
        createdAt: "2026-08-17T09:00:00.000Z",
        user: { name: "Ada Legal" },
      },
    ]

    render(<ObligationDetailPage />)

    expect(await screen.findByText("Sous-tâche créée : Collect evidence")).toBeVisible()
    expect(screen.queryByText("Sub-task created: Collect evidence")).not.toBeInTheDocument()
    expect(screen.getByText("External sync: Keep this verbatim")).toBeVisible()
  })

  it("keeps editing disabled and offers retry when the member directory is unavailable", async () => {
    memberStatus = 503
    render(<ObligationDetailPage />)

    const edit = await screen.findByRole("button", { name: "Edit obligation" })
    expect(edit).toBeDisabled()
    expect(screen.getByText(
      "Organization members are unavailable. Editing is disabled until they can be loaded.",
    )).toBeVisible()

    memberStatus = 200
    fireEvent.click(screen.getByRole("button", { name: "Retry member list" }))
    await waitFor(() => expect(edit).toBeEnabled())
  })

  it("treats a malformed successful member response as unavailable", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/obligations/obl-1")) return response(obligation)
      if (url === "/api/contracts/contract-1") {
        return response({ id: "contract-1", title: "Master Services Agreement", activities: [] })
      }
      if (url === "/api/org/members") return response({ members: [null] })
      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<ObligationDetailPage />)

    const edit = await screen.findByRole("button", { name: "Edit obligation" })
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry member list" })).toBeVisible())
    expect(edit).toBeDisabled()
  })

  it("states the bounded history and missing source without inventing either", async () => {
    obligation.clauseReference = null
    contractActivities = []

    render(<ObligationDetailPage />)

    expect(await screen.findByText("No source reference is recorded.")).toBeVisible()
    expect(screen.getByText("No matching activity appears in the contract's latest 20 events.")).toBeVisible()
    expect(screen.queryByText("No obligation history yet.")).not.toBeInTheDocument()
  })

  it("marks bounded history as potentially stale when a post-mutation refresh fails", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/subtasks/sub-1") && init?.method === "PATCH") {
        return response({ ...obligation.subTasks[0], isCompleted: true })
      }
      if (url === "/api/contracts/contract-1") return response({}, 503)
      throw new Error(`Unexpected fetch: ${url}`)
    })

    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Collect evidence complete" }))

    expect(await screen.findByText(
      "Recent activity could not be refreshed. The entries below may be out of date.",
    )).toBeVisible()
  })

  it("derives viewer access from the active organization without fetching member details", async () => {
    memberRole = "viewer"
    render(<ObligationDetailPage />)

    expect(await screen.findByText("Read-only access")).toBeVisible()
    expect(screen.getByText("Collect evidence")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit obligation" })).not.toBeInTheDocument()
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith("/api/org/members", expect.anything())
  })

  it("distinguishes not-found from retryable server failure", async () => {
    obligationStatus = 500
    const { unmount } = render(<ObligationDetailPage />)
    expect(await screen.findByRole("heading", { name: "Obligation unavailable" })).toBeVisible()
    obligationStatus = 200
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("heading", { name: obligation.title })).toBeVisible()
    unmount()

    obligationStatus = 404
    render(<ObligationDetailPage />)
    expect(await screen.findByRole("heading", { name: "Obligation not found" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument()
  })

  it("opens a keyboard-native, labelled obligation editor", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })

    fireEvent.click(screen.getByRole("button", { name: "Edit obligation" }))
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Owner" })).toBeVisible()
    expect(screen.getByRole("radiogroup", { name: "Priority" })).toBeVisible()
    const priorityRadios = screen.getAllByRole("radio", { name: /Low|Medium|High/ })
    expect(priorityRadios).toHaveLength(3)
    expect(screen.getByRole("radio", { name: "High" })).toHaveAttribute("type", "radio")
    expect(screen.getByRole("radio", { name: "High" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "7 days" })).toHaveAttribute("name", "obligation-reminder")
    expect(screen.getByLabelText("Title")).toBeRequired()
    expect(screen.getByLabelText("Due date")).toBeRequired()
    expect(screen.getByRole("button", { name: "Close obligation editor" })).toHaveClass("h-11", "w-11")
  })

  it("traps delete confirmation focus and restores it to the trigger on cancel", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })
    const trigger = screen.getByRole("button", { name: "Delete obligation" })

    fireEvent.click(trigger)
    expect(await screen.findByRole("dialog", { name: "Delete obligation?" })).toBeVisible()
    const cancel = screen.getByRole("button", { name: "Cancel" })
    await waitFor(() => expect(cancel).toHaveFocus())
    fireEvent.click(cancel)

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it.each(["aggregate-first", "subtask-first"] as const)(
    "preserves a confirmed sub-task when the status response completes %s",
    async (completionOrder) => {
      render(<ObligationDetailPage />)
      await screen.findByRole("heading", { name: obligation.title })

      const aggregate = deferredResponse()
      const subtask = deferredResponse()
      vi.mocked(fetch).mockClear()
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith("/subtasks/sub-1") && init?.method === "PATCH") return subtask.promise
        if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
        if (url === "/api/contracts/contract-1") {
          return Promise.resolve(response({
            id: "contract-1",
            title: "Master Services Agreement",
            activities: contractActivities,
          }))
        }
        throw new Error(`Unexpected fetch: ${url}`)
      })

      fireEvent.click(screen.getByRole("button", { name: "Start" }))
      fireEvent.click(screen.getByRole("checkbox"))

      if (completionOrder === "aggregate-first") {
        aggregate.resolve(response({ ...obligation, status: "IN_PROGRESS" }))
        await screen.findByRole("button", { name: "Complete" })
        subtask.resolve(response({ ...obligation.subTasks[0], isCompleted: true }))
      } else {
        subtask.resolve(response({ ...obligation.subTasks[0], isCompleted: true }))
        await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))
        aggregate.resolve(response({ ...obligation, status: "IN_PROGRESS" }))
      }

      await screen.findByRole("button", { name: "Complete" })
      await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked())
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 1 complete")
    },
  )

  it.each(["aggregate-first", "subtask-first"] as const)(
    "preserves a confirmed sub-task when the edit response completes %s",
    async (completionOrder) => {
      render(<ObligationDetailPage />)
      await screen.findByRole("heading", { name: obligation.title })
      await waitFor(() => expect(screen.getByRole("button", { name: "Edit obligation" })).toBeEnabled())

      const aggregate = deferredResponse()
      const subtask = deferredResponse()
      vi.mocked(fetch).mockClear()
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith("/subtasks/sub-1") && init?.method === "PATCH") return subtask.promise
        if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
        if (url === "/api/contracts/contract-1") {
          return Promise.resolve(response({
            id: "contract-1",
            title: "Master Services Agreement",
            activities: contractActivities,
          }))
        }
        throw new Error(`Unexpected fetch: ${url}`)
      })

      fireEvent.click(screen.getByRole("checkbox"))
      fireEvent.click(screen.getByRole("button", { name: "Edit obligation" }))
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Revised obligation" } })
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

      if (completionOrder === "aggregate-first") {
        aggregate.resolve(response({ ...obligation, title: "Revised obligation" }))
        await screen.findByRole("heading", { name: "Revised obligation" })
        subtask.resolve(response({ ...obligation.subTasks[0], isCompleted: true }))
      } else {
        subtask.resolve(response({ ...obligation.subTasks[0], isCompleted: true }))
        await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))
        aggregate.resolve(response({ ...obligation, title: "Revised obligation" }))
      }

      expect(await screen.findByRole("heading", { name: "Revised obligation" })).toBeVisible()
      await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked())
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 1 complete")
    },
  )

  it("keeps a confirmed deletion when a status request starts after the optimistic delete", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })

    const aggregate = deferredResponse()
    const deletion = deferredResponse()
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/subtasks/sub-1") && init?.method === "DELETE") return deletion.promise
      if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
      if (url === "/api/contracts/contract-1") {
        return Promise.resolve(response({
          id: "contract-1",
          title: "Master Services Agreement",
          activities: contractActivities,
        }))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    fireEvent.click(screen.getByRole("button", { name: "Delete Collect evidence" }))
    expect(screen.queryByText("Collect evidence")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    deletion.resolve(response(null, 204))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))
    aggregate.resolve(response({ ...obligation, status: "IN_PROGRESS" }))

    await screen.findByRole("button", { name: "Complete" })
    expect(screen.queryByText("Collect evidence")).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 of 0 complete")
  })

  it("keeps a confirmed deletion when an edit request starts after the optimistic delete", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit obligation" })).toBeEnabled())

    const aggregate = deferredResponse()
    const deletion = deferredResponse()
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/subtasks/sub-1") && init?.method === "DELETE") return deletion.promise
      if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
      if (url === "/api/contracts/contract-1") {
        return Promise.resolve(response({
          id: "contract-1",
          title: "Master Services Agreement",
          activities: contractActivities,
        }))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    fireEvent.click(screen.getByRole("button", { name: "Delete Collect evidence" }))
    expect(screen.queryByText("Collect evidence")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit obligation" }))
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Revised obligation" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    deletion.resolve(response(null, 204))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))
    aggregate.resolve(response({ ...obligation, title: "Revised obligation" }))

    expect(await screen.findByRole("heading", { name: "Revised obligation" })).toBeVisible()
    expect(screen.queryByText("Collect evidence")).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 of 0 complete")
  })

  it("reasserts a status-concurrent deletion when the stale aggregate response lands first", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })

    const aggregate = deferredResponse()
    const deletion = deferredResponse()
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/subtasks/sub-1") && init?.method === "DELETE") return deletion.promise
      if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
      if (url === "/api/contracts/contract-1") {
        return Promise.resolve(response({
          id: "contract-1",
          title: "Master Services Agreement",
          activities: contractActivities,
        }))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    fireEvent.click(screen.getByRole("button", { name: "Delete Collect evidence" }))
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    aggregate.resolve(response({ ...obligation, status: "IN_PROGRESS" }))
    await screen.findByRole("button", { name: "Complete" })

    deletion.resolve(response(null, 204))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))

    expect(screen.queryByText("Collect evidence")).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 of 0 complete")
  })

  it("reasserts an edit-concurrent deletion when the stale aggregate response lands first", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit obligation" })).toBeEnabled())

    const aggregate = deferredResponse()
    const deletion = deferredResponse()
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/subtasks/sub-1") && init?.method === "DELETE") return deletion.promise
      if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
      if (url === "/api/contracts/contract-1") {
        return Promise.resolve(response({
          id: "contract-1",
          title: "Master Services Agreement",
          activities: contractActivities,
        }))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    fireEvent.click(screen.getByRole("button", { name: "Delete Collect evidence" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit obligation" }))
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Revised obligation" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    aggregate.resolve(response({ ...obligation, title: "Revised obligation" }))
    expect(await screen.findByRole("heading", { name: "Revised obligation" })).toBeVisible()

    deletion.resolve(response(null, 204))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))

    expect(screen.queryByText("Collect evidence")).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 of 0 complete")
  })

  it("takes the edit snapshot when save starts after earlier sub-task work settles", async () => {
    render(<ObligationDetailPage />)
    await screen.findByRole("heading", { name: obligation.title })
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit obligation" })).toBeEnabled())

    const aggregate = deferredResponse()
    const subtask = deferredResponse()
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/subtasks/sub-1") && init?.method === "PATCH") return subtask.promise
      if (url.endsWith("/obligations/obl-1") && init?.method === "PATCH") return aggregate.promise
      if (url === "/api/contracts/contract-1") {
        return Promise.resolve(response({
          id: "contract-1",
          title: "Master Services Agreement",
          activities: contractActivities,
        }))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Edit obligation" }))
    subtask.resolve(response({ ...obligation.subTasks[0], isCompleted: true }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/contracts/contract-1"))

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Revised obligation" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    aggregate.resolve(response({
      ...obligation,
      title: "Revised obligation",
      subTasks: [
        { ...obligation.subTasks[0], isCompleted: true },
        {
          id: "sub-2",
          title: "Send evidence",
          isCompleted: false,
          completedAt: null,
          completedBy: null,
          createdAt: "2026-08-17T11:00:00.000Z",
        },
      ],
    }))

    expect(await screen.findByText("Send evidence")).toBeVisible()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 2 complete")
  })

  it("keeps obligation detail copy in five-locale parity", () => {
    const catalogs = { en, fr, de, es, ar } as const
    const expected = leafKeys(en.obligationDetail).sort()
    for (const [locale, catalog] of Object.entries(catalogs)) {
      expect(leafKeys(catalog.obligationDetail).sort(), locale).toEqual(expected)
    }
  })
})

describe("sub-task mutation sequencing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obligation = buildObligation()
  })

  it("admits only one in-flight toggle per sub-task", async () => {
    let release!: (value: Response) => void
    const pending = new Promise<Response>((resolve) => { release = resolve })
    vi.stubGlobal("fetch", vi.fn(() => pending))
    const onChange = vi.fn()
    render(
      <SubTaskList
        contractId="contract-1"
        obligation={obligation}
        canWrite
        onChange={onChange}
      />,
    )

    const toggle = screen.getByRole("checkbox", { name: "Mark Collect evidence complete" })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(fetch).toHaveBeenCalledTimes(1)

    release(response({ ...obligation.subTasks[0], isCompleted: true }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "sub-1", isCompleted: true }),
    ]))
  })

  it("preserves a concurrently added sub-task when a delete rolls back", async () => {
    let rejectDelete!: (reason: Error) => void
    const deletePending = new Promise<Response>((_resolve, reject) => { rejectDelete = reject })
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return deletePending
      return Promise.resolve(response({
        id: "sub-2",
        title: "Send evidence",
        isCompleted: false,
        completedAt: null,
        completedBy: null,
      }, 201))
    }))
    const onChange = vi.fn()
    render(<SubTaskList contractId="contract-1" obligation={obligation} canWrite onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Delete Collect evidence" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Add a sub-task" }), { target: { value: "Send evidence" } })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "sub-2" }),
    ]))

    rejectDelete(new Error("network failed"))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "sub-1" }),
      expect.objectContaining({ id: "sub-2" }),
    ]))
  })

  it("reports a rejected add request inline and releases the input", async () => {
    const { toast } = await import("sonner")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    render(<SubTaskList contractId="contract-1" obligation={obligation} canWrite onChange={vi.fn()} />)
    const input = screen.getByRole("textbox", { name: "Add a sub-task" })

    fireEvent.change(input, { target: { value: "Send evidence" } })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to add sub-task"))
    expect(input).toBeEnabled()
    expect(input).toHaveValue("Send evidence")
  })

  it("notifies the page to refresh bounded history after a successful mutation", async () => {
    const onMutationComplete = vi.fn()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      id: "sub-2",
      title: "Send evidence",
      isCompleted: false,
      completedAt: null,
      completedBy: null,
    }, 201)))
    render(
      <SubTaskList
        contractId="contract-1"
        obligation={obligation}
        canWrite
        onChange={vi.fn()}
        onMutationComplete={onMutationComplete}
      />,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Add a sub-task" }), {
      target: { value: "Send evidence" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onMutationComplete).toHaveBeenCalledOnce())
  })
})
