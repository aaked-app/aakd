"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#a1a1aa",
  INTERNAL_REVIEW: "#60a5fa",
  PENDING_APPROVAL: "#fbbf24",
  AWAITING_SIGNATURE: "#f59e0b",
  ACTIVE: "#22c55e",
  EXPIRED: "#ef4444",
  TERMINATED: "#f97316",
  ARCHIVED: "#d4d4d8",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal Review",
  PENDING_APPROVAL: "Pending Approval",
  AWAITING_SIGNATURE: "Awaiting Signature",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  ARCHIVED: "Archived",
}

type Datum = { status: string; count: number }

export function PortfolioHealthWidget({ data }: { data: Datum[] }) {
  const filtered = data.filter((d) => d.count > 0)
  const total = filtered.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-zinc-500 py-12 text-center">
        No contracts in the portfolio yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={75}
              paddingAngle={1}
              isAnimationActive={false}
            >
              {filtered.map((d) => (
                <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#a1a1aa"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const payload = (item as { payload?: { status?: string } } | undefined)?.payload
                const status = payload?.status ?? ""
                return [Number(value), STATUS_LABELS[status] ?? status]
              }}
              contentStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-3xl font-bold tabular-nums">{total}</p>
          <p className="text-xs text-zinc-500">contracts</p>
        </div>
      </div>

      <ul className="space-y-1 text-xs">
        {filtered.map((d) => (
          <li key={d.status} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[d.status] ?? "#a1a1aa" }}
              />
              <span className="text-foreground">{STATUS_LABELS[d.status] ?? d.status}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
