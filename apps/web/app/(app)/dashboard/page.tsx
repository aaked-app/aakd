"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { Settings2, Plus, ArrowUpRight, FileText, Clock3, CircleAlert } from "lucide-react"
import { useSession } from "@/lib/auth/client"
import { ContractStatusBadge } from "@/components/contract-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Contract } from "@/lib/types"
import type { AnalyticsSummary } from "@/app/api/analytics/summary/route"
import { useLocale, useTranslations } from "next-intl"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

const DESKTOP_QUERY = "(min-width: 1024px)"

type LoadState = "loading" | "ready" | "error"
type DashboardAction = {
  id: string
  title: string
  status: string
  dueDate: string | null
  assignee: { id: string; name: string } | null
  contract: { id: string; title: string; counterpartyName: string | null }
}

function isFiniteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function hasDashboardAnalyticsShape(value: unknown): value is AnalyticsSummary {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<AnalyticsSummary>
  const obligations = candidate.obligations
  return Boolean(
    candidate.expiringSoon &&
    isFiniteCount(candidate.expiringSoon.next30) &&
    Array.isArray(candidate.byStatus) &&
    candidate.byStatus.every((item) =>
      typeof item?.status === "string" && isFiniteCount(item.count),
    ) &&
    Array.isArray(candidate.monthlyVolume) &&
    candidate.monthlyVolume.every((item) =>
      typeof item?.month === "string" && isFiniteCount(item.count),
    ) &&
    (obligations === null || Boolean(
      obligations &&
      isFiniteCount(obligations.overdue) &&
      isFiniteCount(obligations.dueSoon),
    )),
  )
}

function hasDashboardContractShape(value: unknown): value is Contract {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<Contract>
  const owner = candidate.owner
  return Boolean(
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "string" &&
    (candidate.counterpartyName == null || typeof candidate.counterpartyName === "string") &&
    (candidate.value == null || (typeof candidate.value === "number" && Number.isFinite(candidate.value))) &&
    (candidate.currency == null || typeof candidate.currency === "string") &&
    (candidate.endDate == null || typeof candidate.endDate === "string") &&
    (owner == null || (
      typeof owner === "object" &&
      typeof owner.name === "string" &&
      typeof owner.email === "string" &&
      (owner.image == null || typeof owner.image === "string")
    )),
  )
}

function hasDashboardActionShape(value: unknown): value is DashboardAction {
  if (!value || typeof value !== "object") return false
  const action = value as Partial<DashboardAction>
  return typeof action.id === "string" && typeof action.title === "string" &&
    typeof action.status === "string" && (action.dueDate == null || typeof action.dueDate === "string") &&
    Boolean(action.contract && typeof action.contract.id === "string" && typeof action.contract.title === "string") &&
    (action.assignee == null || (typeof action.assignee.id === "string" && typeof action.assignee.name === "string"))
}

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

function formatDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date)
}

function formatValue(value: number | null | undefined, currency: string | null | undefined, locale: string): string {
  if (value == null || !Number.isFinite(value)) return "—"
  try {
    return new Intl.NumberFormat(locale, currency ? {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    } : {
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  loading,
  locale,
  unavailableLabel,
}: {
  title: string
  value: number | null
  sub: string
  loading?: boolean
  locale: string
  unavailableLabel?: string
}) {
  return (
    <article className="rounded-[var(--radius)] border border-border bg-card px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">{title}</p>
      {loading
        ? <Skeleton className="h-8 w-16 my-0.5" />
        : <p className="text-[28px] font-extrabold leading-none tabular-nums text-foreground">
            {value == null ? "—" : new Intl.NumberFormat(locale).format(value)}
          </p>
      }
      <p className="text-[11.5px] text-muted-foreground mt-1.5">
        {!loading && value == null && unavailableLabel ? unavailableLabel : sub}
      </p>
    </article>
  )
}

// ─── Renewal bar chart ────────────────────────────────────────────────────────

function RenewalChart({
  monthlyVolume,
  locale,
  chartLabel,
  noDataLabel,
}: {
  monthlyVolume: Array<{ month: string; count: number }>
  locale: string
  chartLabel: (summary: string) => string
  noDataLabel: string
}) {
  const slice = monthlyVolume.slice(-8)
  if (slice.length === 0) {
    return <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">{noDataLabel}</div>
  }
  const max = Math.max(...slice.map((d) => d.count), 1)
  const barW = 28, gap = 10, chartH = 100
  const points = slice.map((item) => {
    const date = new Date(`${item.month}-01T00:00:00.000Z`)
    const month = Number.isNaN(date.getTime())
      ? item.month
      : new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date)
    return { ...item, label: month }
  })
  const summary = points
    .map((item) => `${item.label}: ${new Intl.NumberFormat(locale).format(item.count)}`)
    .join(", ")

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${slice.length * (barW + gap) - gap} ${chartH + 28}`}
        className="block"
        role="img"
        aria-label={chartLabel(summary)}
      >
        {points.map((d, i) => {
          const barH = Math.max(4, (d.count / max) * chartH)
          const x = i * (barW + gap)
          const isHigh = d.count === max && d.count > 0
          return (
            <g key={d.month}>
              <rect x={x} y={chartH - barH} width={barW} height={barH} rx={3}
                fill={isHigh ? "hsl(38 85% 52%)" : "hsl(148 58% 30%)"} opacity={isHigh ? 1 : 0.75} />
              {d.count > 0 && (
                <text x={x + barW / 2} y={chartH - barH - 5} textAnchor="middle"
                  fontSize={10} fontWeight={600} fill="hsl(215 35% 11%)" className="dark:fill-[hsl(210_25%_96%)]">
                  {d.count}
                </text>
              )}
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={10} fill="hsl(215 8% 45%)">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession()
  const t = useTranslations("dashboard")
  const locale = useLocale()
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    () => true,
  )
  const [analytics, setAnalytics]     = useState<AnalyticsSummary | null>(null)
  const [contracts, setContracts]     = useState<Contract[]>([])
  const [actions, setActions] = useState<DashboardAction[]>([])
  const [loadState, setLoadState]     = useState<LoadState>("loading")
  const requestIdRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const loadDashboard = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    const requestId = ++requestIdRef.current
    controllerRef.current = controller
    setLoadState("loading")

    try {
      const [analyticsResponse, contractsResponse, actionsResponse] = await Promise.all([
        fetch("/api/analytics/summary", {
          credentials: "include",
          signal: controller.signal,
        }),
        fetch("/api/contracts?limit=5", {
          credentials: "include",
          signal: controller.signal,
        }),
        isActionLedgerUiEnabled()
          ? fetch("/api/actions?view=dashboard&limit=5", { credentials: "include", signal: controller.signal })
          : Promise.resolve(new Response(JSON.stringify({ actions: [] }), { status: 200 })),
      ])
      if (!analyticsResponse.ok || !contractsResponse.ok || !actionsResponse.ok) throw new Error("dashboard_request_failed")

      const [analyticsData, contractsData, actionsData] = await Promise.all([
        analyticsResponse.json() as Promise<AnalyticsSummary>,
        contractsResponse.json() as Promise<{ contracts?: Contract[] }>,
        actionsResponse.json() as Promise<{ actions?: DashboardAction[] }>,
      ])
      if (
        !hasDashboardAnalyticsShape(analyticsData) ||
        !Array.isArray(contractsData?.contracts) ||
        !contractsData.contracts.every(hasDashboardContractShape) ||
        !Array.isArray(actionsData?.actions) ||
        !actionsData.actions.every(hasDashboardActionShape)
      ) {
        throw new Error("dashboard_response_invalid")
      }
      if (controller.signal.aborted || requestId !== requestIdRef.current) return

      setAnalytics(analyticsData)
      setContracts(contractsData.contracts)
      setActions(actionsData.actions)
      setLoadState("ready")
    } catch {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return
      setLoadState("error")
    }
  }, [])

  // Fetch on every mount — no Next.js cache layer involved, always fresh.
  useEffect(() => {
    void loadDashboard()
    return () => {
      requestIdRef.current += 1
      controllerRef.current?.abort()
    }
  }, [loadDashboard])

  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? t("greeting.morning") : hour < 17 ? t("greeting.afternoon") : t("greeting.evening")
  const fullName   = session?.user?.name ?? session?.user?.email ?? t("teamFallback")
  const firstName  = fullName.split(" ")[0]

  const activeCount   = analytics?.byStatus.find((s) => s.status === "ACTIVE")?.count ?? 0
  const expiringCount = analytics?.expiringSoon.next30 ?? 0
  const overdueCount = analytics?.obligations?.overdue ?? null
  const dueSoonCount = analytics?.obligations?.dueSoon ?? null

  const totalContracts = analytics?.byStatus.reduce((sum, s) => sum + s.count, 0) ?? null

  return (
    <main className="flex min-h-full flex-col" dir={locale.startsWith("ar") ? "rtl" : "ltr"}>
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7">
        <div className="min-w-0">
          {loadState === "loading"
            ? <Skeleton className="h-6 w-48 mb-1" />
            : <h1 className="text-[18px] font-bold tracking-tight leading-snug">{greeting}, {firstName}</h1>
          }
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/settings/notifications"
            aria-label={t("settings")}
            title={t("settings")}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings2 className="h-[15px] w-[15px]" />
          </Link>
          <Link
            href="/contracts/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newContract")}
          </Link>
        </div>
      </header>

      {loadState === "loading" ? (
        <section
          className="grid flex-1 gap-4 px-4 py-5 sm:px-6 lg:px-7"
          role="status"
          aria-label={t("loading")}
          aria-busy="true"
        >
          <span className="sr-only">{t("loading")}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[var(--radius)] border border-border bg-card px-5 py-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="my-2 h-8 w-16" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </section>
      ) : loadState === "error" ? (
        <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6" role="alert">
          <div className="max-w-md rounded-[var(--radius)] border border-destructive/30 bg-card p-6 text-center">
            <h2 className="text-base font-semibold text-foreground">{t("loadErrorTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("loadErrorDescription")}</p>
            <button
              type="button"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void loadDashboard()}
            >
              {t("retry")}
            </button>
          </div>
        </section>
      ) : totalContracts === 0 ? (
        <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-primary/10">
              <FileText className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("uploadFirstTitle")}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("uploadFirst")}</p>
            </div>
            <Link
              href="/contracts/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("uploadContract")}
            </Link>
          </div>
        </section>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-7">
          {isActionLedgerUiEnabled() ? <section className="rounded-[var(--radius)] border border-primary/20 bg-card p-4 sm:p-5" aria-labelledby="agreement-work-heading">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="agreement-work-heading" className="text-base font-semibold">{t("agreementWork")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("agreementWorkDescription")}</p></div>
              <Link href="/actions?view=my_work" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary">{t("viewActionQueue")}<ArrowUpRight className="size-3 rtl:-scale-x-100" /></Link>
            </div>
            {actions.length === 0 ? <p className="mt-4 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{t("noAgreementWork")}</p> : <ol className="mt-4 grid gap-2">{actions.map((action) => <li key={action.id}><Link href={`/actions/${action.id}`} className="flex min-h-11 flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><span className="block font-medium">{action.title}</span><span className="block truncate text-xs text-muted-foreground">{action.contract.title} · {action.assignee?.name ?? t("unassigned")}</span></span><span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{action.status === "STALE" || action.status === "BLOCKED" ? <CircleAlert className="size-4 text-destructive" /> : <Clock3 className="size-4" />}{action.dueDate ? formatDate(action.dueDate, locale) : t("conditionBased")}</span></Link></li>)}</ol>}
          </section> : null}
          <section aria-labelledby="workspace-summary-heading">
            <h2 id="workspace-summary-heading" className="sr-only">{t("workspaceSummary")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title={t("activeContracts")} value={activeCount} sub={t("totalInPortfolio")} locale={locale} />
              <StatCard title={t("expiringSoon")} value={expiringCount} sub={t("workspaceScope")} locale={locale} />
              <StatCard
                title={t("overdueObligations")}
                value={overdueCount}
                sub={t("needsAttention")}
                locale={locale}
                unavailableLabel={t("obligationsUnavailable")}
              />
              <StatCard
                title={t("dueSoonObligations")}
                value={dueSoonCount}
                sub={t("needsAttention")}
                locale={locale}
                unavailableLabel={t("obligationsUnavailable")}
              />
            </div>
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex min-w-0 flex-col" aria-labelledby="recent-contracts-heading">
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div>
                  <h2 id="recent-contracts-heading" className="text-sm font-semibold">{t("recentContracts")}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("recentContractsDescription")}</p>
                </div>
                <Link href="/contracts" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t("viewAll")} <ArrowUpRight className="h-3 w-3 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </div>

              {contracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
                  <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t("noRecentContracts")}</p>
                </div>
              ) : isDesktop ? (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
                  <table className="w-full min-w-[720px] border-collapse text-[12.5px]" aria-label={t("recentContracts")}>
                    <thead>
                      <tr className="border-b border-border bg-muted">
                        {[t("tableContract"), t("tableCounterparty"), t("tableValue"), t("tableEndDate"), t("tableStatus"), t("tableOwner")].map((header) => (
                          <th key={header} scope="col" className="px-3 py-2 text-start text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((contract) => (
                        <tr key={contract.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                          <td className="px-3 py-3 font-medium">
                            <Link href={`/contracts/${contract.id}`} className="inline-flex min-h-11 items-center transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{contract.title}</Link>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{contract.counterpartyName ?? "—"}</td>
                          <td className="px-3 py-3 tabular-nums">{formatValue(contract.value, contract.currency, locale)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{formatDate(contract.endDate, locale)}</td>
                          <td className="px-3 py-3"><ContractStatusBadge status={contract.status} /></td>
                          <td className="px-3 py-3">
                            {contract.owner ? (
                              contract.owner.image ? (
                                <img
                                  src={contract.owner.image}
                                  className="h-7 w-7 rounded-full object-cover"
                                  alt={contract.owner.name || contract.owner.email}
                                  title={contract.owner.name || contract.owner.email}
                                />
                              ) : (
                                <span
                                  title={contract.owner.name || contract.owner.email}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
                                >
                                  {getInitials(contract.owner.name || contract.owner.email)}
                                </span>
                              )
                            ) : <span className="text-muted-foreground">{t("unassigned")}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ul className="grid gap-3" role="list" aria-label={t("recentContracts")}>
                  {contracts.map((contract) => (
                    <li key={contract.id} className="rounded-[var(--radius)] border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/contracts/${contract.id}`} className="inline-flex min-h-11 items-center font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {contract.title}
                          </Link>
                          <p className="truncate text-sm text-muted-foreground">{contract.counterpartyName ?? "—"}</p>
                        </div>
                        <ContractStatusBadge status={contract.status} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                        <div>
                          <dt className="text-muted-foreground">{t("tableValue")}</dt>
                          <dd className="mt-0.5 tabular-nums text-foreground">{formatValue(contract.value, contract.currency, locale)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t("tableEndDate")}</dt>
                          <dd className="mt-0.5 text-foreground">{formatDate(contract.endDate, locale)}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">{t("owner")}</dt>
                          <dd className="mt-0.5 text-foreground">{contract.owner?.name || contract.owner?.email || t("unassigned")}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col rounded-[var(--radius)] border border-border bg-card px-5 py-4" aria-labelledby="contracts-added-heading">
              <h2 id="contracts-added-heading" className="text-[13px] font-semibold">{t("contractsAdded")}</h2>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{t("contractsAddedDescription")}</p>
              <RenewalChart
                monthlyVolume={analytics?.monthlyVolume ?? []}
                locale={locale}
                chartLabel={(summary) => t("chartSummary", { summary })}
                noDataLabel={t("noData")}
              />
            </section>
          </div>
        </div>
      )}
    </main>
  )
}
