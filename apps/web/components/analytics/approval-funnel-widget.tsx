"use client"

import { useLocale, useTranslations } from "next-intl"

type Datum = { totalRequested: number; approved: number; rejected: number; pending: number }

export function ApprovalFunnelWidget({ data }: { data: Datum }) {
  const t = useTranslations("analytics")
  const number = new Intl.NumberFormat(useLocale())
  const decisions = data.approved + data.rejected
  return <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {([["approved", data.approved], ["rejected", data.rejected], ["pending", data.pending]] as const).map(([label, value]) => <div key={label} className="rounded-[var(--radius)] border border-border bg-background p-4"><p className="text-xs font-medium text-muted-foreground">{t(label)}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{number.format(value)}</p></div>)}
    </div>
    {decisions === 0 ? <p className="text-sm text-muted-foreground">{t("emptyApprovals")}</p> : <p className="text-xs text-muted-foreground">{t("approvalDecisionDenominator", { count: number.format(decisions) })}</p>}
    <p className="text-xs text-muted-foreground">{t("approvalRequestsContext", { count: number.format(data.totalRequested) })}</p>
  </div>
}
