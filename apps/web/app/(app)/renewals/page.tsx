"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import {
  AlertCircle,
  CalendarDays,
  CalendarClock,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { RiskBadge } from "@/components/risk-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FocusBand, OperationsShell } from "@/components/portfolio/operations-shell"
import { cn } from "@/lib/utils"

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

type LoadState = "loading" | "ready" | "error"
type Urgency = "overdue" | "action" | "soon" | "later" | "unknown"

const DESKTOP_QUERY = "(min-width: 1280px)"

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

function classifyUrgency(days: number | null): Urgency {
  if (days == null || !Number.isFinite(days)) return "unknown"
  if (days < 0) return "overdue"
  if (days <= 7) return "action"
  if (days <= 30) return "soon"
  return "later"
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date)
}

function formatCurrency(
  value: number | null,
  currency: string | null,
  locale: string,
  fallback: string,
) {
  if (value == null || !Number.isFinite(value)) return fallback
  if (!currency) return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${currency}`
  }
}

function StatCard({
  count,
  label,
  description,
  accent,
  locale,
  icon,
}: {
  count: number
  label: string
  description: string
  accent: string
  locale: string
  icon: ReactNode
}) {
  return (
    <article className={cn("relative min-w-0 rounded-xl border border-border border-s-4 bg-card p-4 shadow-sm transition-colors motion-safe:duration-200 hover:border-primary/30", accent)}>
      <p className="pe-9 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <span className="absolute end-4 top-4 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {new Intl.NumberFormat(locale).format(count)}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </article>
  )
}

function StatePanel({
  error = false,
  title,
  description,
  action,
  actionLabel,
}: {
  error?: boolean
  title: string
  description: string
  action?: () => void
  actionLabel?: string
}) {
  const Icon = error ? AlertCircle : CalendarClock
  return (
    <section className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
      <Icon className={cn("mx-auto size-9", error ? "text-destructive" : "text-muted-foreground")} aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && actionLabel ? (
        <Button className="mt-5 min-h-11" variant="outline" onClick={action}>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}

function UrgencyBadge({
  days,
  t,
}: {
  days: number | null
  t: (key: string, values?: Record<string, number>) => string
}) {
  const urgency = classifyUrgency(days)
  if (urgency === "unknown") {
    return <span className="text-sm text-muted-foreground">{t("notAvailable")}</span>
  }
  if (urgency === "overdue") {
    return (
      <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive ring-1 ring-destructive/20">
        {t("overdue")}
      </span>
    )
  }

  const rounded = Math.ceil(days as number)
  const label = t(rounded === 1 ? "dayRemaining" : "daysRemaining", { days: rounded })
  const styles = urgency === "action"
    ? "bg-destructive/10 text-destructive ring-destructive/20"
    : urgency === "soon"
      ? "bg-warning/15 text-warning ring-warning/25"
      : "bg-success/15 text-success ring-success/25"
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", styles)}>
      {label}
    </span>
  )
}

function LocalizedRisk({
  level,
  t,
}: {
  level: string | null
  t: (key: string) => string
}) {
  const normalized = level?.toUpperCase()
  const known = normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH"
  const key = known ? `risk${normalized[0]}${normalized.slice(1).toLowerCase()}` : "riskNotScored"
  return <RiskBadge level={known ? normalized : null} label={t(key)} size="sm" />
}

export default function RenewalsPage() {
  const t = useTranslations("renewals")
  const locale = useLocale()
  const isDesktop = useSyncExternalStore(subscribeToDesktop, getDesktopSnapshot, () => true)
  const loadErrorToast = t("loadErrorToast")
  const requestRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const [renewals, setRenewals] = useState<RenewalContract[]>([])
  const [loadState, setLoadState] = useState<LoadState>("loading")

  const loadRenewals = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = ++requestRef.current
    setLoadState("loading")

    void (async () => {
      try {
        const response = await fetch("/api/renewals", { signal: controller.signal })
        if (!response.ok) throw new Error("renewals_unavailable")
        const data = await response.json()
        if (controller.signal.aborted || requestId !== requestRef.current) return
        setRenewals(Array.isArray(data.renewals) ? data.renewals : [])
        setLoadState("ready")
      } catch {
        if (controller.signal.aborted || requestId !== requestRef.current) return
        setLoadState("error")
        toast.error(loadErrorToast)
      }
    })()
  }, [loadErrorToast])

  useEffect(() => {
    loadRenewals()
    return () => controllerRef.current?.abort()
  }, [loadRenewals])

  const stats = useMemo(() => {
    const result = { action: 0, soon: 0, later: 0 }
    for (const renewal of renewals) {
      const urgency = classifyUrgency(renewal.daysUntilDeadline)
      if (urgency === "overdue" || urgency === "action") result.action += 1
      else if (urgency === "soon") result.soon += 1
      else result.later += 1
    }
    return result
  }, [renewals])

  const fallback = t("notAvailable")
  const formatNoticePeriod = (days: number | null) => {
    if (days == null || !Number.isFinite(days)) return fallback
    const rounded = Math.round(days)
    return t(rounded === 1 ? "day" : "days", { days: rounded })
  }
  const risk = (renewal: RenewalContract) => <LocalizedRisk level={renewal.riskScore} t={t} />
  const urgency = (renewal: RenewalContract) => <UrgencyBadge days={renewal.daysUntilDeadline} t={t} />
  const href = (renewal: RenewalContract) => `/contracts/${renewal.id}`
  const priorityRenewal = renewals.find((renewal) => {
    const level = classifyUrgency(renewal.daysUntilDeadline)
    return level === "overdue" || level === "action"
  })

  return (
    <OperationsShell
      eyebrow={t("attentionLabel")}
      title={t("title")}
      description={t("subtitle")}
      icon={<CalendarClock className="size-4" aria-hidden="true" />}
      action={<Button
            variant="outline"
            className="min-h-11 w-fit"
            onClick={loadRenewals}
            disabled={loadState === "loading"}
          >
            <RefreshCw className={cn("size-4", loadState === "loading" && "animate-spin")} aria-hidden="true" />
            {t("refresh")}
          </Button>}
    >
        <div className="space-y-5">
          {loadState === "loading" ? (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
              </section>
              <div role="status" aria-live="polite" className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-3 size-5 animate-spin" aria-hidden="true" />
                {t("loading")}
              </div>
            </>
          ) : loadState === "error" ? (
            <StatePanel
              error
              title={t("unavailableTitle")}
              description={t("unavailableDescription")}
              action={loadRenewals}
              actionLabel={t("retry")}
            />
          ) : (
            <>
              {priorityRenewal ? <FocusBand
                label={t("actionRequired")}
                title={priorityRenewal.title}
                detail={`${priorityRenewal.counterpartyName ?? fallback} · ${t("noticeDeadline")}: ${formatDate(priorityRenewal.noticeDeadlineDate, locale, fallback)}`}
                icon={<TriangleAlert className="size-4" aria-hidden="true" />}
                action={<Link href={href(priorityRenewal)} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{t("view")}<ExternalLink className="ms-1 size-4 rtl:-scale-x-100" aria-hidden="true" /></Link>}
              /> : null}
              <section aria-label={t("attentionLabel")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard count={stats.action} label={t("actionRequired")} description={t("actionRequiredDescription")} accent="border-s-destructive" locale={locale} icon={<TriangleAlert className="size-4" aria-hidden="true" />} />
                <StatCard count={stats.soon} label={t("comingSoon")} description={t("comingSoonDescription")} accent="border-s-warning" locale={locale} icon={<Clock3 className="size-4" aria-hidden="true" />} />
                <StatCard count={stats.later} label={t("laterOrUnknown")} description={t("laterOrUnknownDescription")} accent="border-s-success" locale={locale} icon={<CalendarDays className="size-4" aria-hidden="true" />} />
              </section>

              {renewals.length === 0 ? (
                <StatePanel title={t("emptyTitle")} description={t("emptyDescription")} />
              ) : isDesktop ? (
                <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <table aria-label={t("resultsLabel")} className="w-full table-fixed border-collapse text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.04em] text-muted-foreground">
                      <tr className="border-b border-border">
                        <th scope="col" className="w-[23%] px-3 py-3 text-start font-semibold">{t("tableContract")}</th>
                        <th scope="col" className="w-[12%] px-3 py-3 text-start font-semibold">{t("value")}</th>
                        <th scope="col" className="w-[12%] px-3 py-3 text-start font-semibold">{t("endDate")}</th>
                        <th scope="col" className="w-[13%] px-3 py-3 text-start font-semibold">{t("noticePeriod")}</th>
                        <th scope="col" className="w-[14%] px-3 py-3 text-start font-semibold">{t("noticeDeadline")}</th>
                        <th scope="col" className="w-[12%] px-3 py-3 text-start font-semibold">{t("daysLeft")}</th>
                        <th scope="col" className="w-[9%] px-3 py-3 text-start font-semibold">{t("risk")}</th>
                        <th scope="col" className="w-[5%] px-3 py-3 text-start font-semibold"><span className="sr-only">{t("actions")}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewals.map((renewal) => (
                        <tr key={renewal.id} className="border-b border-border transition-colors motion-safe:duration-150 last:border-0 hover:bg-muted/40">
                          <td className="min-w-0 px-3 py-2 align-middle">
                            <div className="flex min-h-11 min-w-0 flex-col justify-center">
                              <span className="truncate font-semibold text-foreground">{renewal.title}</span>
                              <span className="truncate text-xs text-muted-foreground">{renewal.counterpartyName ?? fallback}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">{formatCurrency(renewal.value, renewal.currency, locale, fallback)}</td>
                          <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">{formatDate(renewal.endDate, locale, fallback)}</td>
                          <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">{formatNoticePeriod(renewal.noticePeriodDays)}</td>
                          <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">{formatDate(renewal.noticeDeadlineDate, locale, fallback)}</td>
                          <td className="px-3 py-2 align-middle">{urgency(renewal)}</td>
                          <td className="px-3 py-2 align-middle">{risk(renewal)}</td>
                          <td className="px-3 py-2 text-end align-middle">
                            <Link
                              href={href(renewal)}
                              aria-label={t("viewContract", { title: renewal.title })}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ul aria-label={t("compactResultsLabel")} className="space-y-3">
                  {renewals.map((renewal) => (
                    <li key={renewal.id} className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
                      <Link
                        href={href(renewal)}
                        aria-label={t("viewContract", { title: renewal.title })}
                        className="block min-h-11 min-w-0 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{renewal.title}</h2>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{renewal.counterpartyName ?? fallback}</p>
                          </div>
                          {urgency(renewal)}
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-xs">
                          <div><dt className="text-muted-foreground">{t("value")}</dt><dd className="mt-1 tabular-nums text-foreground">{formatCurrency(renewal.value, renewal.currency, locale, fallback)}</dd></div>
                          <div><dt className="text-muted-foreground">{t("risk")}</dt><dd className="mt-1">{risk(renewal)}</dd></div>
                          <div><dt className="text-muted-foreground">{t("endDate")}</dt><dd className="mt-1 tabular-nums text-foreground">{formatDate(renewal.endDate, locale, fallback)}</dd></div>
                          <div><dt className="text-muted-foreground">{t("noticePeriod")}</dt><dd className="mt-1 tabular-nums text-foreground">{formatNoticePeriod(renewal.noticePeriodDays)}</dd></div>
                          <div className="col-span-2"><dt className="text-muted-foreground">{t("noticeDeadline")}</dt><dd className="mt-1 tabular-nums text-foreground">{formatDate(renewal.noticeDeadlineDate, locale, fallback)}</dd></div>
                        </dl>
                        <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                          {t("view")}<ExternalLink className="size-4" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
    </OperationsShell>
  )
}
