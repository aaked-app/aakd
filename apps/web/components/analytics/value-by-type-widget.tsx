"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ContractType } from "@/lib/types"

const KNOWN_TYPES = new Set(["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"])

export function ValueByTypeWidget({ data }: { data: Array<{ contractType: string; totalValue: number; count: number }> }) {
  const t = useTranslations("analytics")
  const typeT = useTranslations("contract.types")
  const number = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 2 })
  if (data.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyValues")}</p>
  const chartData = [...data].sort((a, b) => b.totalValue - a.totalValue).map((item) => ({ ...item, label: KNOWN_TYPES.has(item.contractType) ? typeT(item.contractType as ContractType) : item.contractType }))
  return <div><div className="h-72" role="img" aria-label={t("recordedValuesChartLabel")}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 4, left: 8 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value: number) => number.format(value)} /><YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} /><Tooltip formatter={(value, _name, item) => [number.format(Number(value)), t("recordedValueForContracts", { count: Number((item as { payload?: { count?: number } }).payload?.count ?? 0) })]} /><Bar dataKey="totalValue" fill="hsl(148, 58%, 30%)" radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><ul className="mt-3 space-y-2 text-sm">{chartData.map((item) => <li key={item.contractType} className="flex items-start justify-between gap-4"><span className="break-words">{item.label}</span><span className="text-end tabular-nums"><span>{number.format(item.totalValue)}</span><span className="ms-2 text-muted-foreground">{t("contractsCount", { count: item.count })}</span></span></li>)}</ul></div>
}
