"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Plus, Search, ChevronLeft, ChevronRight,
  MoreHorizontal, FileText, Archive, Eye, Download,
} from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/contract-badges"
import { RiskBadge } from "@/components/risk-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Contract, ContractStatus } from "@/lib/types"
import { useSession } from "@/lib/auth/client"
import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "next-intl"

// ── Filter configuration ───────────────────────────────────────────────────
interface FilterConfig {
  label: string
  status: ContractStatus | "ALL"
}

// ── Utilities ──────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatRecordedValue(value: number, currency: string | null | undefined, locale: string) {
  const numberOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }

  if (!currency) return new Intl.NumberFormat(locale, numberOptions).format(value)

  try {
    return new Intl.NumberFormat(locale, {
      ...numberOptions,
      style: "currency",
      currency,
    }).format(value)
  } catch {
    return `${new Intl.NumberFormat(locale, numberOptions).format(value)} ${currency}`
  }
}

function formatEndDate(value: string | Date, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/** Returns two-letter initials from a full name (e.g. "Alex Johnson" → "AJ") */
function ownerInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ContractsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const t = useTranslations("contracts")
  const locale = useLocale()
  const isRtl = locale.toLowerCase().startsWith("ar")

  const FILTERS: FilterConfig[] = [
    { label: t("filterAll"),      status: "ALL"                },
    { label: t("filterActive"),   status: "ACTIVE"             },
    { label: t("filterDraft"),    status: "DRAFT"              },
    { label: t("filterInReview"), status: "INTERNAL_REVIEW"    },
    { label: t("filterSigned"),   status: "AWAITING_SIGNATURE" },
    { label: t("filterPending"),  status: "PENDING_APPROVAL"   },
    { label: t("filterExpiring"), status: "EXPIRED"            },
  ]

  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [activeFilter, setActiveFilter] = useState<ContractStatus | "ALL">(
    (searchParams.get("status") as ContractStatus) ?? "ALL",
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [role, setRole] = useState<string>("member")
  const contractsRequestId = useRef(0)
  const debouncedSearch = useDebounce(search, 300)

  const canManage = role === "admin" || role === "legal" || role === "owner"

  // Fetch current user's org role
  useEffect(() => {
    if (!session?.user) return
    const controller = new AbortController()
    fetch("/api/org/members", { signal: controller.signal })
      .then((r) => r.json())
      .then((members) => {
        if (Array.isArray(members)) {
          const me = members.find(
            (m: { userId: string; role: string }) => m.userId === session.user.id,
          )
          if (me?.role) setRole(me.role)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [session?.user])

  const fetchContracts = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++contractsRequestId.current
      setLoading(true)
      setLoadError(false)
      try {
        const params = new URLSearchParams()
        if (debouncedSearch) params.set("search", debouncedSearch)
        if (activeFilter && activeFilter !== "ALL") params.set("status", activeFilter)
        params.set("limit", String(pageSize))
        params.set("page", String(page))

        const res = await fetch(`/api/contracts?${params}`, { signal })
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        if (requestId !== contractsRequestId.current) return
        setContracts(data.contracts ?? data ?? [])
        setTotal(data.total ?? (data.contracts ?? data ?? []).length)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        if (requestId !== contractsRequestId.current) return
        setLoadError(true)
        toast.error(t("failedToLoad"))
      } finally {
        if (requestId === contractsRequestId.current) setLoading(false)
      }
    },
    [debouncedSearch, activeFilter, page, t],
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchContracts(controller.signal)
    setSelectedIds(new Set())
    return () => controller.abort()
  }, [fetchContracts])

  // ── Actions ──────────────────────────────────────────────────────────────
  async function archiveContract(id: string) {
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.message ?? err.error ?? t("failedToArchive"))
        return
      }
      toast.success(t("contractArchived"))
      // Bust the router cache so the dashboard reflects the removal immediately.
      router.refresh()
      fetchContracts()
    } catch {
      toast.error(t("failedToArchive"))
    }
  }

  async function archiveSelected() {
    await Promise.allSettled(Array.from(selectedIds).map(archiveContract))
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === contracts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(contracts.map((c) => c.id)))
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const allSelected = contracts.length > 0 && selectedIds.size === contracts.length
  const someSelected = selectedIds.size > 0 && !allSelected
  const selectionLabel = allSelected ? t("deselectAll") : t("selectAll")
  const riskLabel = (level: string | null | undefined) => {
    switch (level?.toUpperCase()) {
      case "LOW": return t("riskLow")
      case "MEDIUM": return t("riskMedium")
      case "HIGH": return t("riskHigh")
      default: return level ? t("riskUnknown") : t("riskNotScored")
    }
  }
  const tableColumns = [
    { label: t("tableContract"), className: "" },
    { label: t("tableCounterparty"), className: "hidden lg:table-cell" },
    { label: t("tableStatus"), className: "" },
    { label: t("tableRisk"), className: "" },
    { label: t("tableValue"), className: "hidden xl:table-cell" },
    { label: t("tableEndDate"), className: "hidden xl:table-cell" },
    { label: t("tableOwner"), className: "hidden xl:table-cell" },
    { label: "", className: "w-10" },
  ]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-full min-w-0 flex-col">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6 lg:px-7 lg:py-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle", { count: total, plural: total !== 1 ? "s" : "" })}
          </p>
        </div>
        <Link href="/contracts/new" className={cn(buttonVariants({ size: "sm" }), "min-h-11")}>
          <Plus className="size-4" />
          {t("newContract")}
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6 lg:p-7">

        {/* ── Filters bar ───────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search input */}
          <div className="relative w-full lg:w-auto">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              aria-label={t("searchLabel")}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="h-11 w-full ps-9 text-sm lg:w-64"
            />
          </div>

          {/* Status pill filters */}
          <select
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value as ContractStatus | "ALL")
              setPage(1)
            }}
            aria-label={t("filterByStatus")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:hidden"
          >
            {FILTERS.map((filter) => (
              <option key={filter.status} value={filter.status}>{filter.label}</option>
            ))}
          </select>
          <div className="hidden min-w-0 gap-1 overflow-x-auto pb-1 sm:flex lg:pb-0">
            {FILTERS.map((f) => (
              <button
                type="button"
                aria-pressed={activeFilter === f.status}
                key={f.label}
                onClick={() => { setActiveFilter(f.status); setPage(1) }}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  activeFilter === f.status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/80 hover:bg-muted-foreground/[0.12] hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Bulk actions — visible when at least one row is selected */}
          {selectedIds.size > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto lg:flex-nowrap">
              <span className="me-auto text-sm text-muted-foreground lg:me-0">
                {t("selected", { count: selectedIds.size })}
              </span>
              <Button variant="outline" size="sm" className="min-h-11">
                <Download className="size-3.5" />
                {t("export")}
              </Button>
              {canManage && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-11"
                  onClick={archiveSelected}
                >
                  <Archive className="size-3.5" />
                  {t("archive")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Table ─────────────────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton */
          <div
            role="status"
            aria-label={t("loading")}
            aria-busy="true"
            aria-live="polite"
            className="space-y-2"
          >
            <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block [&_th]:text-start">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-9 bg-muted" />
                    {tableColumns.map((column, index) => (
                      <TableHead
                        key={`${column.label}-${index}`}
                        className={cn("h-10 bg-muted text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground", column.className)}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3"><Skeleton className="size-4" /></TableCell>
                      {tableColumns.map((column, j) => (
                        <TableCell key={j} className={cn("py-3", column.className)}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border bg-card p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-4 w-1/3" />
                  <div className="mt-4 flex gap-2"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-16" /></div>
                </div>
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-4 rounded-[var(--radius)] border border-border bg-card px-5 py-16 text-center"
          >
            <div className="flex size-14 items-center justify-center rounded-xl bg-muted text-muted-foreground/60">
              <FileText className="size-6" />
            </div>
            <p className="text-[15px] font-semibold">{t("failedToLoad")}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => fetchContracts()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : contracts.length === 0 ? (
          /* Empty state */
          <EmptyState
            icon={FileText}
            title={t("noContracts")}
            description={
              search || activeFilter !== "ALL"
                ? t("noContractsFilter")
                : t("createFirst")
            }
            action={!search && activeFilter === "ALL" ? t("newContract") : undefined}
            onAction={
              !search && activeFilter === "ALL"
                ? () => router.push("/contracts/new")
                : undefined
            }
          />
        ) : (
          /* Data table */
          <>
          <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block [&_th]:text-start">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {/* Checkbox column */}
                  <TableHead className="w-12 border-b border-border bg-muted p-0 ps-1">
                    <label className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md outline-none focus-within:ring-2 focus-within:ring-primary/30">
                      <input
                        ref={(element) => {
                          if (element) element.indeterminate = someSelected
                        }}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="size-4 cursor-pointer rounded border-border accent-primary"
                      />
                      <span className="sr-only">{selectionLabel}</span>
                    </label>
                  </TableHead>
                  {tableColumns.map((column, index) => (
                      <TableHead
                        key={`${column.label}-${index}`}
                        className={cn("h-10 border-b border-border bg-muted text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground", column.className)}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c, idx) => (
                  <TableRow
                    key={c.id}
                    onClick={() => router.push(`/contracts/${c.id}`)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      idx < contracts.length - 1 && "border-b border-border",
                      selectedIds.has(c.id) ? "bg-muted/40" : "hover:bg-muted/50",
                    )}
                  >
                    {/* ── Checkbox ──────────────────────────────────────── */}
                    <TableCell
                      className="w-12 p-0 ps-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md outline-none focus-within:ring-2 focus-within:ring-primary/30">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="size-4 cursor-pointer rounded border-border accent-primary"
                        />
                        <span className="sr-only">
                          {t(selectedIds.has(c.id) ? "deselectContract" : "selectContract", { title: c.title })}
                        </span>
                      </label>
                    </TableCell>

                    {/* ── Contract name + optional CRM badge ────────────── */}
                    <TableCell className="py-3 text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/contracts/${c.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex min-h-11 items-center rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {c.title}
                        </Link>
                        {c.crmLinks && c.crmLinks.length > 0 && (
                          <span className="rounded-[3px] bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                            {c.crmLinks[0].provider.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* ── Counterparty ───────────────────────────────────── */}
                    <TableCell className="hidden py-3 text-sm text-muted-foreground lg:table-cell">
                      {c.counterpartyName ?? "—"}
                    </TableCell>

                    {/* ── Status badge ───────────────────────────────────── */}
                    <TableCell className="py-2">
                      <StatusBadge status={c.status} />
                    </TableCell>

                    {/* ── Risk badge ─────────────────────────────────────── */}
                    <TableCell className="py-2">
                      <RiskBadge
                        level={(c as { riskScore?: string | null }).riskScore}
                        size="sm"
                        label={riskLabel((c as { riskScore?: string | null }).riskScore)}
                      />
                    </TableCell>

                    {/* ── Value ──────────────────────────────────────────── */}
                    <TableCell className="hidden py-3 text-sm tabular-nums text-muted-foreground xl:table-cell">
                      {c.value != null
                        ? formatRecordedValue(c.value, c.currency, locale)
                        : "—"}
                    </TableCell>

                    {/* ── End date ───────────────────────────────────────── */}
                    <TableCell className="hidden py-3 text-sm text-muted-foreground xl:table-cell">
                      {c.endDate
                        ? formatEndDate(c.endDate, locale)
                        : "—"}
                    </TableCell>

                    {/* ── Owner avatar ───────────────────────────────────── */}
                    <TableCell className="hidden py-3 xl:table-cell">
                      {c.owner?.image ? (
                        <img
                          src={c.owner.image}
                          className="w-full h-full object-cover rounded-full"
                          alt={c.owner?.name ?? c.ownerId}
                          title={c.owner?.name ?? c.ownerId}
                          style={{ width: "22px", height: "22px" }}
                        />
                      ) : (
                        <div
                          title={c.owner?.name ?? c.ownerId}
                          className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          style={{ fontSize: 11, fontWeight: 700 }}
                        >
                          {ownerInitials(c.owner?.name)}
                        </div>
                      )}
                    </TableCell>

                    {/* ── Row menu ───────────────────────────────────────── */}
                    <TableCell
                      className="py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger aria-label={`${t("view")}: ${c.title}`} className="inline-flex size-11 items-center justify-center rounded outline-none text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30">
                          <MoreHorizontal className="size-[15px]" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/contracts/${c.id}`)}
                          >
                            <Eye className="size-4" />
                            {t("view")}
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem
                              onClick={() => archiveContract(c.id)}
                              variant="destructive"
                            >
                              <Archive className="size-4" />
                              {t("archiveAction")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden">
            <div className="mb-2 flex items-center justify-between px-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <label className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md outline-none focus-within:ring-2 focus-within:ring-primary/30">
                <input
                  ref={(element) => {
                    if (element) element.indeterminate = someSelected
                  }}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="size-4 cursor-pointer rounded border-border accent-primary"
                />
                  <span className="sr-only">{selectionLabel}</span>
                </label>
                <span>{t("title")}</span>
              </div>
              <span>{total}</span>
            </div>
            <ul className="space-y-2" aria-label={t("title")}>
              {contracts.map((contract) => (
                <li key={contract.id} className={cn(
                  "rounded-lg border border-border bg-card p-4 transition-colors",
                  selectedIds.has(contract.id) && "border-primary/30 bg-primary/[0.03]",
                )}>
                  <div className="flex min-w-0 items-start gap-3">
                    <label className="-ms-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-within:ring-2 focus-within:ring-primary/30">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contract.id)}
                        onChange={() => toggleSelect(contract.id)}
                        className="size-4 cursor-pointer rounded border-border accent-primary"
                      />
                      <span className="sr-only">
                        {t(selectedIds.has(contract.id) ? "deselectContract" : "selectContract", { title: contract.title })}
                      </span>
                    </label>
                    <div className="min-w-0 flex-1">
                      <Link href={`/contracts/${contract.id}`} className="flex min-h-11 items-center truncate rounded-sm text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30">
                        {contract.title}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        <span className="sr-only">{t("tableCounterparty")}: </span>
                        {contract.counterpartyName ?? "—"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`${t("view")}: ${contract.title}`} className="-me-1 inline-flex size-11 items-center justify-center rounded outline-none text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}`)}>
                          <Eye className="size-4" />
                          {t("view")}
                        </DropdownMenuItem>
                        {canManage && (
                          <DropdownMenuItem onClick={() => archiveContract(contract.id)} variant="destructive">
                            <Archive className="size-4" />
                            {t("archiveAction")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={contract.status} />
                    <RiskBadge
                      level={(contract as { riskScore?: string | null }).riskScore}
                      size="sm"
                      label={riskLabel((contract as { riskScore?: string | null }).riskScore)}
                    />
                    {contract.crmLinks && contract.crmLinks.length > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                        {contract.crmLinks[0].provider.toLowerCase()}
                      </span>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{t("tableValue")}</dt>
                      <dd className="mt-0.5 truncate font-medium tabular-nums text-foreground">
                        {contract.value != null ? formatRecordedValue(contract.value, contract.currency, locale) : "—"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{t("tableEndDate")}</dt>
                      <dd className="mt-0.5 truncate font-medium text-foreground">
                        {contract.endDate
                          ? formatEndDate(contract.endDate, locale)
                          : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="text-xs text-muted-foreground">{t("tableOwner")}</dt>
                      <dd className="mt-1 flex min-w-0 items-center gap-2 text-foreground">
                        {contract.owner?.image ? (
                          <img
                            src={contract.owner.image}
                            className="size-6 shrink-0 rounded-full object-cover"
                            alt={contract.owner.name ?? contract.ownerId}
                          />
                        ) : (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {ownerInitials(contract.owner?.name)}
                          </span>
                        )}
                        <span className="truncate">{contract.owner?.name ?? "—"}</span>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
          </>
        )}

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("subtitle", { count: total, plural: total !== 1 ? "s" : "" })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label={t("previousPage")}
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                {isRtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </Button>
              <span className="px-2 text-sm text-foreground/70" aria-current="page">
                {t("pageOf", { page, totalPages })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label={t("nextPage")}
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                {isRtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
