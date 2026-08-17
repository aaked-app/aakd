"use client"

import { useLocale, useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export function ObligationSummaryWidget({ data }: { data: { overdue: number; dueSoon: number } }) {
  const t = useTranslations("analytics")
  const number = new Intl.NumberFormat(useLocale())
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div className="rounded-[var(--radius)] border border-border bg-background p-4"><p className="text-xs font-medium text-muted-foreground">{t("overdue")}</p><p className={cn("mt-2 text-3xl font-semibold tabular-nums", data.overdue > 0 && "text-destructive")}>{number.format(data.overdue)}</p><p className="mt-1 text-xs text-muted-foreground">{t("overdueScope")}</p></div>
    <div className="rounded-[var(--radius)] border border-border bg-background p-4"><p className="text-xs font-medium text-muted-foreground">{t("dueSoon")}</p><p className={cn("mt-2 text-3xl font-semibold tabular-nums", data.dueSoon > 0 && "text-warning")}>{number.format(data.dueSoon)}</p><p className="mt-1 text-xs text-muted-foreground">{t("dueSoonScope")}</p></div>
  </div>
}
