"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { Settings2, Plus, ArrowUpRight, FileText, Upload, ScanText, UserCheck, ShieldCheck } from "lucide-react"
import { useActiveOrganization, useSession } from "@/lib/auth/client"
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
  kind?: string
  status: string
  dueDate: string | null
  assignee: { id: string; name: string } | null
  contract: { id: string; title: string; counterpartyName: string | null }
  sourcePage?: number | null
  hasCitation?: boolean
  confidence?: number | null
  reviewStatus?: string
  evidenceCount?: number
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
    (action.assignee == null || (typeof action.assignee.id === "string" && typeof action.assignee.name === "string")) &&
    (action.sourcePage == null || (typeof action.sourcePage === "number" && Number.isInteger(action.sourcePage) && action.sourcePage > 0)) &&
    (action.confidence == null || typeof action.confidence === "number")
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: activeOrganization } = useActiveOrganization()
  const t = useTranslations("dashboard")
  const tActions = useTranslations("actionQueue")
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

  const role = useMemo(() => {
    const userId = session?.user?.id
    if (!userId) return "viewer"
    return activeOrganization?.members?.find((member) => member.userId === userId)?.role ?? "viewer"
  }, [activeOrganization?.members, session?.user?.id])
  const canCreateContract = role !== "viewer"

  const expiringCount = analytics?.expiringSoon.next30 ?? 0
  const overdueCount = analytics?.obligations?.overdue ?? null
  const dueSoonCount = analytics?.obligations?.dueSoon ?? null

  const totalContracts = analytics?.byStatus.reduce((sum, s) => sum + s.count, 0) ?? null
  const pendingApprovals = analytics?.approvalFunnel.pending ?? null

  const nextStepFor = (action: DashboardAction) => {
    if (action.status === "STALE") return t("nextSteps.reviewChangedSource")
    if (action.status === "BLOCKED") return t("nextSteps.resolveBlocker")
    if (action.status === "PENDING_REVIEW" || action.status === "PROPOSED") return t("nextSteps.reviewSuggestion")
    if (!action.assignee) return t("nextSteps.assignOwner")
    return t("nextSteps.continueAction")
  }

  const provenanceFor = (action: DashboardAction) => {
    if (action.sourcePage != null) return t("citedPage", { page: action.sourcePage })
    if (action.hasCitation) return t("cited")
    return t("sourceUnavailable")
  }

  return (
    <main className="flex min-h-full flex-col" dir={locale.startsWith("ar") ? "rtl" : "ltr"}>
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7">
        <div className="min-w-0">
          {loadState === "loading"
            ? <Skeleton className="h-6 w-48 mb-1" />
            : <h1 className="text-[18px] font-bold tracking-tight leading-snug">{t("title")}</h1>
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
          {canCreateContract ? <Link
              href="/contracts/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newContract")}
            </Link> : null}
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
        <section className="flex flex-1 items-start bg-[#f7f6f2] px-4 py-8 sm:px-6 lg:px-7 lg:py-12">
          <div className="mx-auto grid w-full max-w-5xl overflow-hidden border border-zinc-200 bg-white lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between border-b border-zinc-200 p-6 sm:p-8 lg:border-b-0 lg:border-e lg:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{t("firstRunEyebrow")}</p>
                <h2 className="mt-3 max-w-md text-2xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-3xl">{t("uploadFirstTitle")}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">{t("uploadFirst")}</p>
              </div>
              <div className="mt-8">
                <Link
                  href="/contracts/new"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t("uploadContract")}
                </Link>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-500">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-800" aria-hidden="true" />
                  {t("firstRunTrust")}
                </p>
              </div>
            </div>
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-5 flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{t("firstRunWorkflow")}</p>
                <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">{t("firstRunReviewBadge")}</span>
              </div>
              <ol aria-label={t("firstRunWorkflow")} className="divide-y divide-zinc-200 border-y border-zinc-200">
                {[
                  [Upload, t("firstRunUploadTitle"), t("firstRunUploadDescription")],
                  [ScanText, t("firstRunReviewTitle"), t("firstRunReviewDescription")],
                  [UserCheck, t("firstRunOwnTitle"), t("firstRunOwnDescription")],
                ].map(([Icon, title, description], index) => {
                  const StepIcon = Icon as typeof Upload
                  return (
                    <li key={String(title)} className="grid grid-cols-[36px_1fr] gap-3 py-4">
                      <span className="flex size-9 items-center justify-center border border-zinc-200 bg-[#f7f6f2] text-zinc-700">
                        <StepIcon className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-semibold tabular-nums text-zinc-400">0{index + 1}</span>
                          <h3 className="text-sm font-semibold text-zinc-950">{String(title)}</h3>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-600">{String(description)}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-7">
          {isActionLedgerUiEnabled() ? <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-card" aria-labelledby="agreement-work-heading">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div><h2 id="agreement-work-heading" className="text-base font-semibold">{t("priorityAgreementWork")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("priorityAgreementWorkDescription")}</p></div>
              <Link href="/actions?view=my_work" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("viewActionQueue")}<ArrowUpRight className="size-3 rtl:-scale-x-100" /></Link>
            </div>
            {actions.length === 0 ? <p className="m-4 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{t("noAgreementWork")}</p> : <ol className="divide-y divide-border">{actions.map((action) => {
              const confidence = action.confidence != null && Number.isFinite(action.confidence) && action.confidence >= 0 && action.confidence <= 1
                ? t("suggestionConfidence", { value: Math.round(action.confidence * 100) })
                : null
              return <li key={action.id} className="px-4 py-4 sm:px-5"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">{action.kind ? tActions(`kinds.${action.kind}`) : t("action")}</span>
                    <span className={action.status === "STALE" || action.status === "BLOCKED" ? "text-destructive" : "text-muted-foreground"}>{action.status ? tActions(`statuses.${action.status}`) : t("action")}</span>
                  </div>
                  <p className="mt-2 font-medium text-foreground">{action.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{action.contract.title}{action.contract.counterpartyName ? ` · ${action.contract.counterpartyName}` : ""}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{action.dueDate ? formatDate(action.dueDate, locale) : t("conditionBased")}</span>
                    <span>{action.assignee?.name ?? t("unassigned")}</span>
                    <span>{provenanceFor(action)}</span>
                    <span>{action.reviewStatus === "reviewed" ? t("humanReviewed") : t("reviewRequired")}</span>
                    {confidence ? <span>{confidence}</span> : null}
                  </div>
                </div>
                <Link href={`/actions/${action.id}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {nextStepFor(action)}<ArrowUpRight className="size-3 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </div></li>
            })}</ol>}
          </section> : null}
          <section aria-labelledby="workspace-signals-heading">
            <div className="mb-2 flex items-center justify-between"><h2 id="workspace-signals-heading" className="text-sm font-semibold">{t("workspaceSignals")}</h2><span className="text-xs text-muted-foreground">{t("workspaceScope")}</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <StatCard title={t("expiringSoon")} value={expiringCount} sub={t("workspaceScope")} locale={locale} />
              <StatCard title={t("pendingApprovals")} value={pendingApprovals} sub={t("needsAttention")} locale={locale} />
            </div>
          </section>

          <div className="min-h-0 flex-1">
            <section className="flex min-w-0 flex-col" aria-labelledby="recent-contracts-heading">
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div>
                  <h2 id="recent-contracts-heading" className="text-sm font-semibold">{t("recentlyUpdatedContracts")}</h2>
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

          </div>
        </div>
      )}
    </main>
  )
}
