const OPEN_STATUSES = new Set([
  "PROPOSED",
  "PENDING_REVIEW",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "BLOCKED",
  "STALE",
])

export type PrioritizableAction = {
  id: string
  status: string
  dueDate: Date | null
  assigneeId: string | null
  createdAt: Date
}

const DAY_MS = 86_400_000

function bucket(action: PrioritizableAction, now: Date): number {
  if (action.status === "STALE" || action.status === "BLOCKED") return 1
  if (action.status === "PENDING_REVIEW") return 2
  if (action.dueDate && action.dueDate.getTime() < now.getTime()) return 3
  if (
    action.dueDate &&
    action.dueDate.getTime() >= now.getTime() &&
    action.dueDate.getTime() <= now.getTime() + 30 * DAY_MS
  ) return 4
  if (!action.assigneeId) return 5
  return 6
}

function compareNullableDates(left: Date | null, right: Date | null): number {
  if (left && right) return left.getTime() - right.getTime()
  if (left) return -1
  if (right) return 1
  return 0
}

export function orderPriorityActions<T extends PrioritizableAction>(rows: readonly T[], now: Date): T[] {
  return rows
    .filter((row) => OPEN_STATUSES.has(row.status))
    .slice()
    .sort((left, right) =>
      bucket(left, now) - bucket(right, now) ||
      compareNullableDates(left.dueDate, right.dueDate) ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
    )
}
