"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AlertCircle, ArrowUpRight, CalendarDays, FileText, Loader2, Search, Target, Trash2, User } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useActiveOrganization, useSession } from "@/lib/auth/client"
import { cn } from "@/lib/utils"
import { FocusBand, OperationsShell } from "@/components/portfolio/operations-shell"
import type { Obligation, ObligationPriority, ObligationStatus } from "@/components/obligations/types"
import {
  fetchAllObligations,
  formatDate,
  isOverdue,
  isThisQuarter,
  isWithinDays,
  OBLIGATIONS_FETCH_CAP,
  PortfolioSummary,
} from "./portfolio-helpers"

type FlatObligation = Obligation & {
  contractTitle: string
  contractCounterparty: string | null
  contract: { id: string; title: string; counterpartyName: string | null }
}

type FilterKey = "All" | "Overdue" | "Due Soon" | "Upcoming" | "Completed"
type LoadState = "loading" | "ready" | "error"

const OBLIGATIONS_PAGE_LIMIT = 100
const DESKTOP_QUERY = "(min-width: 1024px)"
const DAY_MS = 86_400_000

function subscribeToDesktop(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getDesktopSnapshot() {
  return typeof window === "undefined" || !window.matchMedia
    ? true
    : window.matchMedia(DESKTOP_QUERY).matches
}

function PriorityBadge({ priority, label }: { priority: ObligationPriority; label: string }) {
  if (priority === "HIGH") return <Badge variant="destructive">{label}</Badge>
  if (priority === "MEDIUM") {
    return <span className="inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning ring-1 ring-warning/30">{label}</span>
  }
  return <Badge variant="secondary">{label}</Badge>
}

function StatusBadge({
  status,
  dueDate,
  now,
  label,
  dueSoonLabel,
}: {
  status: ObligationStatus
  dueDate: string
  now: Date
  label: string
  dueSoonLabel: string
}) {
  if (status === "OVERDUE") return <Badge variant="destructive">{label}</Badge>
  if (status === "COMPLETED") {
    return <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-success/30">{label}</span>
  }
  if (isWithinDays(dueDate, 7, now)) {
    return <span className="inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning ring-1 ring-warning/30">{dueSoonLabel}</span>
  }
  return <span className="inline-flex rounded-full bg-info/15 px-2 py-0.5 text-xs font-medium text-info ring-1 ring-info/30">{label}</span>
}

function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
}: {
  icon: typeof Target
  title: string
  description: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
      <Icon className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && actionLabel ? <Button className="mt-5 min-h-11" variant="outline" onClick={action}>{actionLabel}</Button> : null}
    </section>
  )
}

function Person({ obligation, unassigned }: { obligation: FlatObligation; unassigned: string }) {
  const person = obligation.assignee
  if (!person) return <span className="text-muted-foreground">{unassigned}</span>
  const initials = person.name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-7" aria-hidden="true">
        {person.image ? <AvatarImage src={person.image} alt="" /> : null}
        <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{initials}</AvatarFallback>
      </Avatar>
      <span className="truncate">{person.name}</span>
    </span>
  )
}

export default function ObligationsPage() {
  const t = useTranslations("obligations")
  const locale = useLocale()
  const { data: session } = useSession()
  const { data: activeOrganization } = useActiveOrganization()
  const loadErrorToast = t("loadErrorToast")
  const isDesktop = useSyncExternalStore(subscribeToDesktop, getDesktopSnapshot, () => true)
  const requestRef = useRef(0)
  const [obligations, setObligations] = useState<FlatObligation[]>([])
  const [isPortfolioLimited, setIsPortfolioLimited] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("All")
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  const role = useMemo(() => {
    const userId = session?.user?.id
    if (!userId) return "viewer"
    return activeOrganization?.members?.find((member) => member.userId === userId)?.role ?? "viewer"
  }, [activeOrganization?.members, session?.user?.id])
  const canDelete = ["owner", "admin", "legal"].includes(role)

  const loadObligations = useCallback(async (signal: AbortSignal) => {
    const requestId = ++requestRef.current
    setLoadState("loading")
    try {
      const result = await fetchAllObligations(signal)
      if (signal.aborted || requestId !== requestRef.current) return
      const flat = result.obligations.map((obligation): FlatObligation => ({
        ...obligation,
        contractTitle: obligation.contract.title,
        contractCounterparty: obligation.contract.counterpartyName,
      }))
      setObligations(flat)
      setIsPortfolioLimited(result.isLimited)
      setCheckedIds((previous) => {
        const available = new Set(flat.map((obligation) => obligation.id))
        return new Set(Array.from(previous).filter((id) => available.has(id)))
      })
      setLoadState("ready")
    } catch {
      if (signal.aborted || requestId !== requestRef.current) return
      setLoadState("error")
      toast.error(loadErrorToast)
    }
  }, [loadErrorToast])

  useEffect(() => {
    const controller = new AbortController()
    void loadObligations(controller.signal)
    return () => controller.abort()
  }, [loadObligations, retryKey])

  const [now] = useState(() => new Date())
  const stats = useMemo(() => {
    const dueSoon = obligations.filter((obligation) =>
      (obligation.status === "PENDING" || obligation.status === "IN_PROGRESS") && isWithinDays(obligation.dueDate, 7, now),
    ).length
    const upcoming = obligations.filter((obligation) => {
      if (obligation.status !== "PENDING" && obligation.status !== "IN_PROGRESS") return false
      const due = new Date(obligation.dueDate)
      return !Number.isNaN(due.getTime()) && due > new Date(now.getTime() + 7 * DAY_MS) && due <= new Date(now.getTime() + 60 * DAY_MS)
    }).length
    return {
      overdue: obligations.filter((obligation) => obligation.status === "OVERDUE").length,
      dueSoon,
      upcoming,
      completed: obligations.filter((obligation) => obligation.status === "COMPLETED" && isThisQuarter(obligation.completedAt, now)).length,
    }
  }, [obligations, now])

  const filtered = useMemo(() => {
    let list = obligations
    if (activeFilter === "Overdue") list = list.filter((obligation) => obligation.status === "OVERDUE")
    else if (activeFilter === "Due Soon") {
      list = list.filter((obligation) => (obligation.status === "PENDING" || obligation.status === "IN_PROGRESS") && isWithinDays(obligation.dueDate, 7, now))
    } else if (activeFilter === "Upcoming") {
      list = list.filter((obligation) => {
        if (obligation.status !== "PENDING" && obligation.status !== "IN_PROGRESS") return false
        const due = new Date(obligation.dueDate)
        return !Number.isNaN(due.getTime()) && due > new Date(now.getTime() + 7 * DAY_MS) && due <= new Date(now.getTime() + 60 * DAY_MS)
      })
    } else if (activeFilter === "Completed") list = list.filter((obligation) => obligation.status === "COMPLETED")
    const query = search.trim().toLocaleLowerCase(locale)
    if (!query) return list
    return list.filter((obligation) =>
      obligation.title.toLocaleLowerCase(locale).includes(query) ||
      obligation.contractTitle.toLocaleLowerCase(locale).includes(query) ||
      (obligation.contractCounterparty ?? "").toLocaleLowerCase(locale).includes(query) ||
      (obligation.assignee?.name ?? "").toLocaleLowerCase(locale).includes(query),
    )
  }, [activeFilter, locale, now, obligations, search])

  const filterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: "All", label: t("filterAll") },
    { key: "Overdue", label: t("filterOverdue") },
    { key: "Due Soon", label: t("filterDueSoon") },
    { key: "Upcoming", label: t("filterUpcoming") },
    { key: "Completed", label: t("filterCompleted") },
  ]
  const filteredIds = filtered.map((obligation) => obligation.id)
  const allChecked = filteredIds.length > 0 && filteredIds.every((id) => checkedIds.has(id))
  const someChecked = filteredIds.some((id) => checkedIds.has(id))

  function toggleAll() {
    setCheckedIds((previous) => {
      const next = new Set(previous)
      if (allChecked) filteredIds.forEach((id) => next.delete(id))
      else filteredIds.forEach((id) => next.add(id))
      return next
    })
  }

  function toggleOne(id: string) {
    setCheckedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearFilters() {
    setSearch("")
    setActiveFilter("All")
  }

  async function handleBulkDelete() {
    if (!canDelete || bulkDeleting || checkedIds.size === 0) return
    setBulkDeleteConfirmOpen(true)
  }

  async function confirmBulkDelete() {
    if (!canDelete || bulkDeleting || checkedIds.size === 0) return
    setBulkDeleting(true)
    setBulkDeleteConfirmOpen(false)
    const targets = obligations.filter((obligation) => checkedIds.has(obligation.id))
    const results: PromiseSettledResult<Response>[] = []
    for (let index = 0; index < targets.length; index += OBLIGATIONS_PAGE_LIMIT) {
      const batch = targets.slice(index, index + OBLIGATIONS_PAGE_LIMIT)
      results.push(...await Promise.allSettled(batch.map((obligation) =>
        fetch(`/api/contracts/${obligation.contractId}/obligations/${obligation.id}`, { method: "DELETE" }),
      )))
    }
    const deletedIds = new Set(targets.filter((_, index) => {
      const result = results[index]
      return result.status === "fulfilled" && result.value.ok
    }).map((obligation) => obligation.id))
    const failed = targets.length - deletedIds.size
    if (deletedIds.size > 0) {
      setObligations((previous) => previous.filter((obligation) => !deletedIds.has(obligation.id)))
      setCheckedIds((previous) => {
        const next = new Set(previous)
        deletedIds.forEach((id) => next.delete(id))
        return next
      })
      toast.success(t(deletedIds.size === 1 ? "bulkDeleteSuccessOne" : "bulkDeleteSuccessMany", { count: deletedIds.size }))
      if (isPortfolioLimited) {
        setLoadState("loading")
        setRetryKey((value) => value + 1)
      }
    }
    if (failed > 0) toast.error(t(failed === 1 ? "bulkDeleteErrorOne" : "bulkDeleteErrorMany", { count: failed }))
    setBulkDeleting(false)
  }

  const priorityLabel = (priority: ObligationPriority) => t(`priority.${priority}`)
  const statusLabel = (status: ObligationStatus) => t(`status.${status}`)
  const detailHref = (obligation: FlatObligation) => `/contracts/${obligation.contractId}/obligations/${obligation.id}`
  const priorityObligation = obligations.find((obligation) => obligation.status === "OVERDUE")
    ?? obligations.find((obligation) => (obligation.status === "PENDING" || obligation.status === "IN_PROGRESS") && isWithinDays(obligation.dueDate, 7, now))
    ?? obligations[0]
  const selectionCheckbox = (obligation: FlatObligation) => canDelete ? (
    <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checkedIds.has(obligation.id)}
        onChange={() => toggleOne(obligation.id)}
        aria-label={t("selectObligation", { title: obligation.title })}
        className="size-4 rounded border-border accent-primary"
      />
    </label>
  ) : null

  return (
    <OperationsShell
      className="relative"
      eyebrow={t("attentionLabel")}
      title={t("title")}
      description={t("subtitle")}
      action={<Link href="/contracts" className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            {t("goToContracts")}<ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>}
    >
        <div className="space-y-5">
          {loadState === "ready" && priorityObligation ? <FocusBand
            label={priorityObligation.status === "OVERDUE" ? t("overdue") : t("dueThisWeek")}
            title={priorityObligation.title}
            detail={`${priorityObligation.contractTitle} · ${t("tableDueDate")}: ${formatDate(priorityObligation.dueDate, locale)}`}
            action={<Link href={detailHref(priorityObligation)} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{t("goToContracts")}<ArrowUpRight className="ms-1 size-4 rtl:-scale-x-100" aria-hidden="true" /></Link>}
          /> : null}
          <PortfolioSummary
            items={[
              { label: t("overdue"), value: stats.overdue, description: t("overdueRequires") },
              { label: t("dueThisWeek"), value: stats.dueSoon, description: t("actionNeeded") },
              { label: t("upcoming"), value: stats.upcoming, description: t("next60Days") },
              { label: t("completed"), value: stats.completed, description: t("thisQuarter") },
            ]}
            isLimited={isPortfolioLimited}
            attentionLabel={t("attentionLabel")}
            partialCount={t("partialCount")}
            partialCountDescription={t("partialCountDescription")}
            coverageLabel={t("coverageLabel")}
            coverageNotice={t("coverageLimitNotice", { count: new Intl.NumberFormat(locale).format(OBLIGATIONS_FETCH_CAP) })}
          />

          <section aria-label={t("filtersLabel")} className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={t("searchLabel")}
                  placeholder={t("searchPlaceholder")}
                  className="min-h-11 w-full rounded-lg border border-input bg-background ps-10 pe-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              <fieldset className="min-w-0">
                <legend className="sr-only">{t("statusFiltersLabel")}</legend>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={activeFilter === option.key}
                      onClick={() => setActiveFilter(option.key)}
                      className={cn(
                        "min-h-11 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        activeFilter === option.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >{option.label}</button>
                  ))}
                </div>
              </fieldset>
            </div>
            {canDelete && loadState === "ready" && filtered.length > 0 ? (
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(element) => { if (element) element.indeterminate = someChecked && !allChecked }}
                    onChange={toggleAll}
                    aria-label={t("selectAll")}
                    className="size-4 rounded border-border accent-primary"
                  />
                  {t("selectAll")}
                </label>
                {checkedIds.size > 0 ? <span className="text-sm tabular-nums text-muted-foreground">{t("selectedCount", { count: checkedIds.size })}</span> : null}
              </div>
            ) : null}
          </section>

          {loadState === "loading" ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 size-5 animate-spin" aria-hidden="true" />{t("loading")}
            </div>
          ) : loadState === "error" ? (
            <StatePanel icon={AlertCircle} title={t("unavailableTitle")} description={t("unavailableDescription")} action={() => setRetryKey((value) => value + 1)} actionLabel={t("retry")} />
          ) : obligations.length === 0 ? (
            <StatePanel icon={Target} title={t("emptyTitle")} description={t("noObligationsDesc")} />
          ) : filtered.length === 0 ? (
            <StatePanel icon={Search} title={t("noMatchesTitle")} description={t("noObligationsFilter")} action={clearFilters} actionLabel={t("clearFilters")} />
          ) : isDesktop ? (
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table aria-label={t("resultsLabel")} className="w-full table-fixed border-collapse text-sm">
                <thead className="bg-muted/70 text-xs uppercase tracking-[0.04em] text-muted-foreground">
                  <tr className="border-b border-border">
                    {canDelete ? <th className="w-12" aria-label={t("selectAll")} /> : null}
                    <th scope="col" className="w-[28%] px-3 py-3 text-start font-semibold">{t("tableObligation")}</th>
                    <th scope="col" className="w-[14%] px-3 py-3 text-start font-semibold">{t("tableDueDate")}</th>
                    <th scope="col" className="w-[14%] px-3 py-3 text-start font-semibold">{t("tableStatus")}</th>
                    <th scope="col" className="w-[18%] px-3 py-3 text-start font-semibold">{t("tableAssignee")}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t("tableContract")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((obligation) => (
                    <tr key={obligation.id} className={cn("border-b border-border last:border-0", checkedIds.has(obligation.id) && "bg-primary/5")}>
                      {canDelete ? <td className="w-12 align-middle">{selectionCheckbox(obligation)}</td> : null}
                      <td className="min-w-0 px-3 py-2 align-middle">
                        <Link href={detailHref(obligation)} aria-label={t("viewObligation", { title: obligation.title })} className="group flex min-h-11 min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-foreground group-hover:underline">{obligation.title}</span>
                            <span className="mt-1 block"><PriorityBadge priority={obligation.priority} label={priorityLabel(obligation.priority)} /></span>
                          </span>
                        </Link>
                      </td>
                      <td className={cn("px-3 py-2 align-middle tabular-nums", isOverdue(obligation, now) ? "font-semibold text-destructive" : "text-muted-foreground")}>{formatDate(obligation.dueDate, locale)}</td>
                      <td className="px-3 py-2 align-middle"><StatusBadge status={obligation.status} dueDate={obligation.dueDate} now={now} label={statusLabel(obligation.status)} dueSoonLabel={t("dueSoonBadge")} /></td>
                      <td className="min-w-0 px-3 py-2 align-middle"><Person obligation={obligation} unassigned={t("unassigned")} /></td>
                      <td className="min-w-0 px-3 py-2 align-middle">
                        <span className="block truncate font-medium text-foreground">{obligation.contractTitle}</span>
                        <span className="block truncate text-xs text-muted-foreground">{obligation.contractCounterparty ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul aria-label={t("resultsLabel")} className="space-y-3">
              {filtered.map((obligation) => (
                <li key={obligation.id} className={cn("flex min-w-0 items-stretch rounded-xl border border-border bg-card shadow-sm", checkedIds.has(obligation.id) && "border-primary/40 bg-primary/5")}>
                  {selectionCheckbox(obligation)}
                  <Link href={detailHref(obligation)} aria-label={t("viewObligation", { title: obligation.title })} className="min-h-11 min-w-0 flex-1 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{obligation.title}</h2>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{obligation.contractTitle}{obligation.contractCounterparty ? ` · ${obligation.contractCounterparty}` : ""}</p>
                      </div>
                      <PriorityBadge priority={obligation.priority} label={priorityLabel(obligation.priority)} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-xs">
                      <div><dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" />{t("tableDueDate")}</dt><dd className={cn("mt-1 tabular-nums", isOverdue(obligation, now) && "font-semibold text-destructive")}>{formatDate(obligation.dueDate, locale)}</dd></div>
                      <div><dt className="text-muted-foreground">{t("tableStatus")}</dt><dd className="mt-1"><StatusBadge status={obligation.status} dueDate={obligation.dueDate} now={now} label={statusLabel(obligation.status)} dueSoonLabel={t("dueSoonBadge")} /></dd></div>
                      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-muted-foreground"><User className="size-3.5" aria-hidden="true" />{t("tableAssignee")}</dt><dd className="mt-1 min-w-0"><Person obligation={obligation} unassigned={t("unassigned")} /></dd></div>
                      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-muted-foreground"><FileText className="size-3.5" aria-hidden="true" />{t("tableContract")}</dt><dd className="mt-1 truncate">{obligation.contractTitle}</dd></div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

      {canDelete && checkedIds.size > 0 ? (
        <section aria-label={t("bulkActionsLabel")} className="absolute inset-x-4 bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xl sm:inset-x-auto sm:start-1/2 sm:w-fit sm:-translate-x-1/2 sm:flex-nowrap">
          <span className="text-sm font-medium tabular-nums text-foreground">{t("selectedCount", { count: checkedIds.size })}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="destructive" className="min-h-11 gap-2" disabled={bulkDeleting} onClick={() => void handleBulkDelete()}>
              {bulkDeleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              {t(checkedIds.size === 1 ? "deleteSelectedOne" : "deleteSelectedMany", { count: checkedIds.size })}
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setCheckedIds(new Set())}>{t("clearSelection")}</Button>
          </div>
        </section>
      ) : null}

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSelectedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteSelectedConfirm", { count: checkedIds.size })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={bulkDeleting} onClick={() => void confirmBulkDelete()}>
              {t(checkedIds.size === 1 ? "deleteSelectedOne" : "deleteSelectedMany", { count: checkedIds.size })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OperationsShell>
  )
}
