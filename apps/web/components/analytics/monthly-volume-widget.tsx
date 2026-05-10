"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

type Datum = { month: string; count: number }

function parseMonth(key: string): { abbrev: string; full: string } {
  // key is "YYYY-MM"
  const [yearStr, monthStr] = key.split("-")
  const monthIdx = parseInt(monthStr, 10) - 1
  const abbrev = MONTH_ABBREV[monthIdx] ?? key
  const full = `${MONTH_ABBREV[monthIdx] ?? ""} ${yearStr}`.trim()
  return { abbrev, full }
}

export function MonthlyVolumeWidget({ data }: { data: Datum[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) {
    return (
      <p className="text-sm text-zinc-500 py-12 text-center">
        No contracts created in the last 12 months.
      </p>
    )
  }

  const chartData = data.map((d) => {
    const { abbrev, full } = parseMonth(d.month)
    return { month: abbrev, fullMonth: full, count: d.count }
  })

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => [`${Number(value)} contracts`, "Volume"]}
            labelFormatter={(_label, payload) => {
              const item = payload?.[0]?.payload as { fullMonth?: string } | undefined
              return item?.fullMonth ?? ""
            }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
