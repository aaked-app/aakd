"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function MonthlyVolumeWidget({ data }: { data: Array<{ month: string; count: number }> }) {
  const t = useTranslations("analytics")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale)
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" })
  const chartData = data.map((item) => ({ ...item, label: monthFormat.format(new Date(`${item.month}-01T00:00:00.000Z`)) }))
  if (chartData.reduce((sum, item) => sum + item.count, 0) === 0) return <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyMonthly")}</p>
  return <div><div className="h-64" role="img" aria-label={t("monthlyChartLabel")}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} width={36} /><Tooltip formatter={(value) => [number.format(Number(value)), t("contractsCreated")]} /><Bar dataKey="count" fill="hsl(148, 58%, 30%)" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><ul className="sr-only">{chartData.map((item) => <li key={item.month}>{t("monthlyEquivalent", { month: item.label, count: item.count })}</li>)}</ul></div>
}
