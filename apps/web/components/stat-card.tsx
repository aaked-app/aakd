import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: number | string
  subtitle?: string
  delta?: number
  variant?: "default" | "warning" | "danger"
  className?: string
}

export function StatCard({ title, value, subtitle, delta, variant = "default", className }: StatCardProps) {
  const valueColor =
    variant === "warning"
      ? "text-amber-600"
      : variant === "danger"
        ? "text-red-600"
        : "text-zinc-900"

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-5",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <p className={cn("mt-1.5 text-3xl font-semibold tracking-tight tabular-nums", valueColor)}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      )}
      {delta !== undefined && (
        <div className="mt-1.5 flex items-center gap-1">
          {delta > 0 ? (
            <>
              <TrendingUp className="size-3 text-emerald-600" />
              <span className="text-xs text-emerald-600">+{delta}</span>
            </>
          ) : delta < 0 ? (
            <>
              <TrendingDown className="size-3 text-red-600" />
              <span className="text-xs text-red-600">{delta}</span>
            </>
          ) : (
            <span className="text-xs text-zinc-500">No change</span>
          )}
        </div>
      )}
    </div>
  )
}
