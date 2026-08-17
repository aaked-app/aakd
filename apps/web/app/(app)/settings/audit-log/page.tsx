"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import {
  Download, FileText, Upload, CheckCircle, RefreshCw,
  Key, UserPlus, XCircle, Trash2, PenLine, Eye,
  Bell, Tag, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ─── Activity mapping ─────────────────────────────────────────────────────────

type Category = "green" | "amber" | "red" | "blue"

const ACTION_ICON_CAT: Record<string, { category: Category; Icon: React.ElementType }> = {
  CREATED:             { category: "green", Icon: FileText },
  UPLOADED:            { category: "green", Icon: Upload },
  UPDATED:             { category: "amber", Icon: RefreshCw },
  STATUS_CHANGED:      { category: "amber", Icon: RefreshCw },
  COMMENTED:           { category: "blue",  Icon: FileText },
  APPROVAL_REQUESTED:  { category: "blue",  Icon: UserPlus },
  APPROVED:            { category: "green", Icon: CheckCircle },
  REJECTED:            { category: "red",   Icon: XCircle },
  SENT_FOR_SIGNATURE:  { category: "blue",  Icon: PenLine },
  SIGNED:              { category: "green", Icon: PenLine },
  ALERT_FIRED:         { category: "amber", Icon: Bell },
  METADATA_EXTRACTED:  { category: "green", Icon: Key },
  METADATA_UPDATED:    { category: "amber", Icon: RefreshCw },
  DOWNLOADED:          { category: "blue",  Icon: Download },
  DELETED:             { category: "red",   Icon: Trash2 },
  ARCHIVED:            { category: "red",   Icon: Trash2 },
  TAGGED:              { category: "green", Icon: Tag },
}

const FALLBACK_ICON_CAT: { category: Category; Icon: React.ElementType } = { category: "blue", Icon: Eye }

const CATEGORY_STYLE: Record<Category, string> = {
  green: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red:   "bg-red-100 text-red-600",
  blue:  "bg-sky-100 text-sky-600",
}

// ─── API types ────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  action: string
  actorLabel: string
  detail: string | null
  createdAt: string
  user: { id: string; name: string; image?: string | null } | null
  contract: { id: string; title: string } | null
}

// ─── Filter options ───────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: "7", key: "last7Days" },
  { value: "30", key: "last30Days" },
  { value: "90", key: "last90Days" },
  { value: "0", key: "allTime" },
]

function formatRelativeTime(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (minutes < 1) return relative.format(0, "minute")
  if (minutes < 60) return relative.format(-minutes, "minute")
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, "hour")
  const days = Math.floor(hours / 24)
  if (days < 7) return relative.format(-days, "day")
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(dateStr))
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const t = useTranslations("contractActivity")
  const activityT = useTranslations("activity")
  const locale = useLocale()

  const ACTION_OPTIONS = [
    { value: "",                   label: t("allActions") },
    { value: "CREATED",            label: activityT("CREATED") },
    { value: "UPLOADED",           label: activityT("UPLOADED") },
    { value: "UPDATED",            label: activityT("UPDATED") },
    { value: "STATUS_CHANGED",     label: activityT("STATUS_CHANGED") },
    { value: "APPROVED",           label: activityT("APPROVED") },
    { value: "REJECTED",           label: activityT("REJECTED") },
    { value: "SENT_FOR_SIGNATURE", label: activityT("SENT_FOR_SIGNATURE") },
    { value: "SIGNED",             label: activityT("SIGNED") },
    { value: "ARCHIVED",           label: activityT("ARCHIVED") },
    { value: "ALERT_FIRED",        label: activityT("ALERT_FIRED") },
    { value: "METADATA_EXTRACTED", label: activityT("METADATA_EXTRACTED") },
  ]

  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const requestSequence = useRef(0)
  const [page, setPage]     = useState(1)
  const pageSize = 20

  const [search,       setSearch]       = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [daysFilter,   setDaysFilter]   = useState("30")

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchActivities = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(pageSize),
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (actionFilter)    params.set("action", actionFilter)
      if (daysFilter !== "0") params.set("days", daysFilter)

      const res = await fetch(`/api/activities?${params}`, { signal, credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      if (requestId !== requestSequence.current) return
      setActivities(data.activities ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      if (requestId === requestSequence.current) setError(true)
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [debouncedSearch, actionFilter, daysFilter, page])

  useEffect(() => {
    const controller = new AbortController()
    fetchActivities(controller.signal)
    return () => controller.abort()
  }, [fetchActivities])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, actionFilter, daysFilter])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-border shrink-0">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">{t("title")}</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            {t("subtitle", { count: total })}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:px-7 sm:py-5">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] h-8"
          />
          <select
            aria-label={t("actionFilterLabel")}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-8 rounded-[var(--radius)] border border-border bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            aria-label={t("dateFilterLabel")}
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value)}
            className="h-8 rounded-[var(--radius)] border border-border bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{t("error")}</p>
            <Button className="mt-3 min-h-11" variant="outline" onClick={() => fetchActivities()}>{t("retry")}</Button>
          </div>
        ) : (
        <div className={cn("hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block", loading && "opacity-60")}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("action"), t("actor"), t("resource"), t("time")].map((h) => (
                  <th key={h} className="py-2.5 px-4 text-start text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[13px] text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                activities.map((entry) => {
                  const iconCat = ACTION_ICON_CAT[entry.action] ?? FALLBACK_ICON_CAT
                  const { Icon } = iconCat
                  const label = entry.action in ACTION_ICON_CAT ? activityT(entry.action as Parameters<typeof activityT>[0]) : entry.action
                  const displayName = entry.user?.name ?? entry.actorLabel
                  return (
                    <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      {/* Action */}
                      <td className="py-3 px-4 text-[13px]">
                        <div className="flex items-center gap-2.5">
                          <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0", CATEGORY_STYLE[iconCat.category])}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div>
                            <p className="font-medium text-foreground leading-tight">{label}</p>
                            {entry.detail && (
                              <p className="text-[11px] text-muted-foreground leading-tight truncate max-w-[240px]">{entry.detail}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Actor */}
                      <td className="py-3 px-4 text-[13px]">
                        <div className="flex items-center gap-2">
                          {entry.user?.image ? (
                            <img
                              src={entry.user.image}
                              className="w-full h-full object-cover rounded-full"
                              alt={displayName}
                              style={{ width: "24px", height: "24px" }}
                            />
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
                              {getInitials(displayName)}
                            </span>
                          )}
                          <span className="text-foreground">{displayName}</span>
                        </div>
                      </td>
                      {/* Resource — link to contract when available */}
                      <td className="py-3 px-4 text-[13px] text-foreground/80 max-w-[200px]">
                        {entry.contract ? (
                          <Link
                            href={`/contracts/${entry.contract.id}`}
                            className="truncate hover:text-primary transition-colors block"
                          >
                            {entry.contract.title}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* Time */}
                      <td className="py-3 px-4 text-[13px] text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(entry.createdAt, locale)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {!error && <div className="space-y-3 md:hidden">
          {!loading && activities.length === 0 ? (
            <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : activities.map((entry) => (
            <article key={entry.id} className="rounded-md border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-medium">{entry.action in ACTION_ICON_CAT ? activityT(entry.action as Parameters<typeof activityT>[0]) : entry.action}</p><p className="text-sm text-muted-foreground">{entry.user?.name ?? entry.actorLabel}</p></div>
                <time className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(entry.createdAt, locale)}</time>
              </div>
              {entry.contract && <Link className="mt-3 block truncate text-sm text-primary" href={`/contracts/${entry.contract.id}`}>{entry.contract.title}</Link>}
            </article>
          ))}
        </div>}

        {/* Pagination */}
        {!error && totalPages > 1 && (
          <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>
              {t("showing", { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}
            </span>
            <div className="flex items-center gap-1">
              <Button aria-label={t("previousPage")} variant="outline" size="icon" className="size-11" onClick={() => setPage((p) => p - 1)} disabled={page === 1 || loading}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2">{t("page", { page, totalPages })}</span>
              <Button aria-label={t("nextPage")} variant="outline" size="icon" className="size-11" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages || loading}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {!error && loading && activities.length === 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
