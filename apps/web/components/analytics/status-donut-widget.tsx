"use client"

import { useLocale, useTranslations } from "next-intl"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { ContractStatus } from "@/lib/types"

const COLORS: Record<string, string> = { ACTIVE: "hsl(148, 58%, 30%)", DRAFT: "hsl(215, 10%, 72%)", PENDING_APPROVAL: "hsl(38, 92%, 50%)", EXPIRED: "hsl(0, 84%, 60%)", INTERNAL_REVIEW: "hsl(200, 98%, 39%)", ARCHIVED: "hsl(215, 10%, 85%)" }
const DEFAULT_COLOR = "hsl(215, 10%, 80%)"
const VALID_STATUSES = new Set<ContractStatus>(["DRAFT", "INTERNAL_REVIEW", "PENDING_APPROVAL", "AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"])

export function StatusDonutWidget({ data }: { data: Array<{ status: string; count: number }> }) {
  const t = useTranslations("analytics")
  const statusT = useTranslations("contract.statuses")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale)
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })
  const filtered = data.filter((item) => item.count > 0)
  const total = filtered.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) return <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyStatus")}</p>
  const label = (status: string) => VALID_STATUSES.has(status as ContractStatus) ? statusT(status as ContractStatus) : status
  return <div className="flex flex-col items-center gap-5 sm:flex-row">
    <div className="h-40 w-40 shrink-0" role="img" aria-label={t("statusChartLabel")}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={filtered} dataKey="count" nameKey="status" innerRadius={50} outerRadius={75} isAnimationActive={false}>{filtered.map((item) => <Cell key={item.status} fill={COLORS[item.status] ?? DEFAULT_COLOR} />)}</Pie><Tooltip formatter={(value, _name, item) => [number.format(Number(value)), label(String((item as { payload?: { status?: string } }).payload?.status ?? ""))]} /></PieChart></ResponsiveContainer></div>
    <ul className="w-full min-w-0 space-y-2">{filtered.map((item) => <li key={item.status} className="flex items-center gap-2 text-sm"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[item.status] ?? DEFAULT_COLOR }} /><span className="min-w-0 flex-1 break-words">{label(item.status)}</span><span className="tabular-nums">{number.format(item.count)}</span><span className="w-12 text-end tabular-nums text-muted-foreground">{percent.format(item.count / total)}</span></li>)}</ul>
  </div>
}
