"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { AnalyticsSummary } from "@/app/api/analytics/summary/route"
import { ApprovalFunnelWidget } from "./approval-funnel-widget"
import { ExpiringSoonWidget } from "./expiring-soon-widget"
import { MonthlyVolumeWidget } from "./monthly-volume-widget"
import { ObligationSummaryWidget } from "./obligation-summary-widget"
import { StatusDonutWidget } from "./status-donut-widget"
import { ValueByTypeWidget } from "./value-by-type-widget"

export function formatApprovalDecisionRate(approved: number, rejected: number, locale: string): string {
  const decisions = approved + rejected
  if (decisions === 0) return "—"
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(approved / decisions)
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{subtitle}</p>
    </div>
  )
}

export function AnalyticsClient({ data }: { data: AnalyticsSummary }) {
  const t = useTranslations("analytics")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale)
  const decisions = data.approvalFunnel.approved + data.approvalFunnel.rejected
  const totalContracts = data.byStatus.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="shrink-0 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </header>
      <main className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title={t("activeExpiringKpi")} value={number.format(data.expiringSoon.next30)} subtitle={t("activeExpiringScope")} />
          <KpiCard title={t("overdueObligationsKpi")} value={data.obligations === null ? t("unavailable") : number.format(data.obligations.overdue)} subtitle={data.obligations === null ? t("obligationsUnavailableShort") : t("overdueObligationsScope")} />
          <KpiCard title={t("approvalDecisionRate")} value={formatApprovalDecisionRate(data.approvalFunnel.approved, data.approvalFunnel.rejected, locale)} subtitle={decisions === 0 ? t("noApprovalDecisionsShort") : t("approvalDecisionSummary", { approved: number.format(data.approvalFunnel.approved), decided: number.format(decisions) })} />
          <KpiCard title={t("portfolioContractsKpi")} value={number.format(totalContracts)} subtitle={t("portfolioContractsScope")} />
        </div>
        <Section title={t("expiringSection")} description={t("expiringScope")}><ExpiringSoonWidget data={data.expiringSoon} /></Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title={t("obligationsSection")} description={t("obligationsScope")}>
            {data.obligations === null ? <div className="rounded-[var(--radius)] border border-dashed border-border px-4 py-8 text-center"><p className="font-medium text-foreground">{t("unavailable")}</p><p className="mt-1 text-sm text-muted-foreground">{t("obligationsUnavailable")}</p></div> : <ObligationSummaryWidget data={data.obligations} />}
          </Section>
          <Section title={t("approvalSection")} description={t("approvalScope")}><ApprovalFunnelWidget data={data.approvalFunnel} /></Section>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title={t("statusSection")} description={t("statusScope")}><StatusDonutWidget data={data.byStatus} /></Section>
          <Section title={t("monthlySection")} description={t("monthlyScope")}><MonthlyVolumeWidget data={data.monthlyVolume} /></Section>
        </div>
        <Section title={t("recordedValuesSection")} description={t("recordedValuesScope")}>
          <p className="mb-4 rounded-[var(--radius)] bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">{t("recordedValuesCaveat")}</p>
          <ValueByTypeWidget data={data.valueByType} />
        </Section>
      </main>
    </div>
  )
}
