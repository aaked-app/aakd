"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { ContractTypeBadge } from "@/components/contract-type-badge"
import type { ContractType } from "@/lib/types"
import { cn } from "@/lib/utils"

type Contract = { id: string; title: string; endDate: string; counterpartyName: string | null; contractType: string | null; daysUntilExpiry: number }
type ExpiringSoonData = { next30: number; next60: number; next90: number; contracts: Contract[] }

function formatDate(value: string, formatter: Intl.DateTimeFormat): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "—" : formatter.format(parsed)
}

export function ExpiringSoonWidget({ data }: { data: ExpiringSoonData }) {
  const t = useTranslations("analytics")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale)
  const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
  const stats = [[30, data.next30], [60, data.next60], [90, data.next90]] as const

  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {stats.map(([days, value]) => <div key={days} className="rounded-[var(--radius)] bg-muted/50 p-3"><p className="text-2xl font-semibold tabular-nums">{number.format(value)}</p><p className="mt-1 text-xs text-muted-foreground">{t("withinDays", { days: number.format(days) })}</p></div>)}
    </div>
    {data.contracts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyExpiring")}</p> : <>
      {data.next90 > data.contracts.length && <p className="text-xs leading-5 text-muted-foreground">{t("expiringListDisclosure", { shown: data.contracts.length, total: data.next90 })}</p>}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {data.contracts.map((contract) => <article key={contract.id} className="min-w-0 rounded-[var(--radius)] border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/contracts/${contract.id}`} className="min-h-11 min-w-0 break-words font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{contract.title}</Link>
            <span className={cn("shrink-0 text-sm tabular-nums", contract.daysUntilExpiry <= 30 && "font-medium text-destructive")}>{t("daysRemaining", { count: contract.daysUntilExpiry })}</span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{t("counterparty")}</dt><dd className="mt-1 break-words">{contract.counterpartyName ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">{t("type")}</dt><dd className="mt-1"><ContractTypeBadge type={contract.contractType as ContractType | null} /></dd></div>
            <div><dt className="text-muted-foreground">{t("expires")}</dt><dd className="mt-1">{formatDate(contract.endDate, date)}</dd></div>
          </dl>
        </article>)}
      </div>
    </>}
  </div>
}
