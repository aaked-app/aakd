import { describe, expect, it } from "vitest"
import { orderPriorityActions } from "@/lib/actions/priority"

const now = new Date("2026-08-18T12:00:00.000Z")

function action(
  id: string,
  status: string,
  dueDate: string | null,
  assigneeId: string | null = "owner-1",
  createdAt = "2026-08-01T00:00:00.000Z",
) {
  return {
    id,
    status,
    dueDate: dueDate ? new Date(dueDate) : null,
    assigneeId,
    createdAt: new Date(createdAt),
  }
}

describe("Phase 1 dashboard action priority", () => {
  it("uses the CEO bucket precedence and first matching bucket", () => {
    const rows = [
      action("other", "ACKNOWLEDGED", "2026-10-01T00:00:00.000Z"),
      action("unassigned", "ACKNOWLEDGED", null, null),
      action("due-soon", "ACKNOWLEDGED", "2026-08-25T00:00:00.000Z"),
      action("overdue", "ACKNOWLEDGED", "2026-08-17T00:00:00.000Z"),
      action("review", "PENDING_REVIEW", "2026-08-01T00:00:00.000Z", null),
      action("blocked", "BLOCKED", null),
      action("stale", "STALE", "2026-08-30T00:00:00.000Z"),
    ]

    expect(orderPriorityActions(rows, now).map((row) => row.id)).toEqual([
      "stale",
      "blocked",
      "review",
      "overdue",
      "due-soon",
      "unassigned",
      "other",
    ])
  })

  it("sorts within every bucket by due date null-last, created time, then id", () => {
    const rows = [
      action("z", "BLOCKED", null, "owner-1", "2026-08-01T00:00:00.000Z"),
      action("b", "BLOCKED", "2026-08-20T00:00:00.000Z", "owner-1", "2026-08-02T00:00:00.000Z"),
      action("a", "STALE", "2026-08-20T00:00:00.000Z", "owner-1", "2026-08-02T00:00:00.000Z"),
      action("c", "BLOCKED", "2026-08-20T00:00:00.000Z", "owner-1", "2026-08-01T00:00:00.000Z"),
    ]

    expect(orderPriorityActions(rows, now).map((row) => row.id)).toEqual(["c", "a", "b", "z"])
    expect(rows.map((row) => row.id)).toEqual(["z", "b", "a", "c"])
  })

  it("excludes completed and dismissed actions", () => {
    expect(orderPriorityActions([
      action("completed", "COMPLETED", "2026-08-01T00:00:00.000Z"),
      action("dismissed", "DISMISSED", "2026-08-01T00:00:00.000Z"),
    ], now)).toEqual([])
  })
})
