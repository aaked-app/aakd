import type { ReactNode } from "react"
import { AlertCircle } from "lucide-react"

import type { Obligation, ObligationStatus } from "@/components/obligations/types"

type RawObligation = Obligation & {
  contract: { id: string; title: string; counterpartyName: string | null }
}

const OBLIGATIONS_PAGE_LIMIT = 100
const OBLIGATIONS_MAX_PAGES = 50
export const OBLIGATIONS_FETCH_CAP = OBLIGATIONS_PAGE_LIMIT * OBLIGATIONS_MAX_PAGES
const DAY_MS = 86_400_000

export async function fetchAllObligations(signal: AbortSignal): Promise<{
  obligations: RawObligation[]
  isLimited: boolean
}> {
  const all: RawObligation[] = []
  let reportedTotal: number | null = null
  for (let page = 1; page <= OBLIGATIONS_MAX_PAGES; page += 1) {
    const response = await fetch(
      `/api/obligations?page=${page}&limit=${OBLIGATIONS_PAGE_LIMIT}`,
      { signal },
    )
    if (!response.ok) throw new Error("obligations_unavailable")
    const data = await response.json()
    const batch: RawObligation[] = Array.isArray(data.obligations) ? data.obligations : []
    if (typeof data.total === "number" && Number.isInteger(data.total) && data.total >= 0) {
      reportedTotal = Math.max(reportedTotal ?? data.total, data.total)
    }
    all.push(...batch)
    if (batch.length === 0 || (reportedTotal !== null && all.length >= reportedTotal)) break
  }
  return {
    obligations: all,
    isLimited: reportedTotal !== null && reportedTotal > all.length,
  }
}

export function isWithinDays(dateValue: string, days: number, now: Date) {
  const due = new Date(dateValue)
  if (Number.isNaN(due.getTime())) return false
  const cutoff = new Date(now.getTime() + days * DAY_MS)
  return due > now && due <= cutoff
}

export function isOverdue(
  obligation: { status: ObligationStatus; dueDate: string },
  now: Date,
) {
  if (obligation.status === "OVERDUE") return true
  if (obligation.status !== "PENDING" && obligation.status !== "IN_PROGRESS") return false
  const due = new Date(obligation.dueDate)
  return !Number.isNaN(due.getTime()) && due < now
}

export function isThisQuarter(dateValue: string | null, now: Date) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const quarterStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    Math.floor(now.getUTCMonth() / 3) * 3,
    1,
  ))
  const quarterEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    Math.floor(now.getUTCMonth() / 3) * 3 + 3,
    1,
  ))
  return date >= quarterStart && date < quarterEnd
}

export function formatDate(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date)
}

export function PortfolioSummary({
  items,
  isLimited,
  attentionLabel,
  partialCount,
  partialCountDescription,
  coverageLabel,
  coverageNotice,
}: {
  items: Array<{ label: string; value: number; description: string; icon?: ReactNode }>
  isLimited: boolean
  attentionLabel: string
  partialCount: string
  partialCountDescription: string
  coverageLabel: string
  coverageNotice: string
}) {
  return (
    <>
      <section aria-label={attentionLabel} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {items.map(({ label, value, description, icon }) => (
          <article key={label} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors motion-safe:duration-200 hover:border-primary/30">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
              {icon ? <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span> : null}
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {isLimited ? partialCount : value}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {isLimited ? partialCountDescription : description}
            </p>
          </article>
        ))}
      </section>

      {isLimited ? (
        <aside
          role="note"
          aria-label={coverageLabel}
          className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6 text-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>{coverageNotice}</p>
        </aside>
      ) : null}
    </>
  )
}
