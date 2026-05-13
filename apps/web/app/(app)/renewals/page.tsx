"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { RefreshCw, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RiskBadge } from "@/components/risk-badge"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenewalContract {
  id: string
  title: string
  counterpartyName: string | null
  endDate: string | null
  noticePeriodDays: number | null
  value: number | null
  currency: string | null
  riskScore: string | null
  status: string
  noticeDeadlineDate: string | null
  daysUntilDeadline: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string | null) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ─── UrgencyPill ─────────────────────────────────────────────────────────────

function UrgencyPill({ days }: { days: number | null }) {
  if (days == null) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const rounded = Math.ceil(days)

  if (rounded < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        OVERDUE
      </span>
    )
  }
  if (rounded <= 7) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        {rounded}d left
      </span>
    )
  }
  if (rounded <= 30) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {rounded}d left
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      {rounded}d left
    </span>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  count,
  label,
  borderColor,
}: {
  count: number
  label: string
  borderColor: string
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border bg-card p-4 border-l-4",
        borderColor,
      )}
    >
      <p className="text-2xl font-bold text-foreground">{count}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RenewalsPage() {
  const [renewals, setRenewals] = useState<RenewalContract[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRenewals = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch("/api/renewals", { signal })
      if (!res.ok) throw new Error("Failed to load renewals")
      const data = await res.json()
      setRenewals(data.renewals ?? [])
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      toast.error("Failed to load renewal data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchRenewals(controller.signal)
    return () => controller.abort()
  }, [fetchRenewals])

  // Compute stat buckets
  const actionRequired = renewals.filter(
    (r) => r.daysUntilDeadline != null && r.daysUntilDeadline <= 7,
  ).length
  const comingSoon = renewals.filter(
    (r) => r.daysUntilDeadline != null && r.daysUntilDeadline > 7 && r.daysUntilDeadline <= 30,
  ).length
  const onTrack = renewals.filter(
    (r) => r.daysUntilDeadline == null || r.daysUntilDeadline > 30,
  ).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-7 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Renewal Watch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-renewing contracts sorted by notice deadline
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRenewals()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} strokeWidth={1.8} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-7 space-y-5">
        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              count={actionRequired}
              label="Action Required (≤7 days or overdue)"
              borderColor="border-l-red-500"
            />
            <StatCard
              count={comingSoon}
              label="Coming Soon (8–30 days)"
              borderColor="border-l-amber-500"
            />
            <StatCard
              count={onTrack}
              label="On Track (>30 days)"
              borderColor="border-l-emerald-500"
            />
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Contract", "Counterparty", "Value", "End Date", "Notice Period", "Notice Deadline", "Days Left", "Risk", ""].map((h) => (
                    <TableHead key={h} className="h-9 bg-muted text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j} className="py-2.5">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : renewals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <RefreshCw className="size-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No auto-renewal contracts</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Contracts with auto-renewal enabled will appear here with their notice deadlines.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Contract", "Counterparty", "Value", "End Date", "Notice Period", "Notice Deadline", "Days Left", "Risk", ""].map((h) => (
                    <TableHead
                      key={h}
                      className="h-9 border-b border-border bg-muted text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewals.map((r, idx) => (
                  <TableRow
                    key={r.id}
                    className={cn(
                      "transition-colors",
                      idx < renewals.length - 1 && "border-b border-border",
                      "hover:bg-muted/50",
                    )}
                  >
                    {/* Contract */}
                    <TableCell className="py-2.5 text-[12.5px] font-medium max-w-[200px]">
                      <span className="truncate block">{r.title}</span>
                    </TableCell>

                    {/* Counterparty */}
                    <TableCell className="py-2.5 text-[12.5px] text-muted-foreground">
                      {r.counterpartyName ?? "—"}
                    </TableCell>

                    {/* Value */}
                    <TableCell className="py-2.5 text-[12.5px] tabular-nums text-muted-foreground">
                      {r.value != null ? formatCurrency(r.value, r.currency ?? "USD") : "—"}
                    </TableCell>

                    {/* End Date */}
                    <TableCell className="py-2.5 text-[12px] text-muted-foreground">
                      {formatDate(r.endDate)}
                    </TableCell>

                    {/* Notice Period */}
                    <TableCell className="py-2.5 text-[12px] text-muted-foreground">
                      {r.noticePeriodDays != null ? `${r.noticePeriodDays}d` : "—"}
                    </TableCell>

                    {/* Notice Deadline */}
                    <TableCell className="py-2.5 text-[12px] text-muted-foreground">
                      {formatDate(r.noticeDeadlineDate)}
                    </TableCell>

                    {/* Days Left */}
                    <TableCell className="py-2.5">
                      <UrgencyPill days={r.daysUntilDeadline} />
                    </TableCell>

                    {/* Risk */}
                    <TableCell className="py-2.5">
                      <RiskBadge level={r.riskScore} size="sm" />
                    </TableCell>

                    {/* Action */}
                    <TableCell className="py-2.5">
                      <Link href={`/contracts/${r.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[12px]">
                          View
                          <ExternalLink className="size-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
