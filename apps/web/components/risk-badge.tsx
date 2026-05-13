import { cn } from "@/lib/utils"

interface RiskBadgeProps {
  level: "LOW" | "MEDIUM" | "HIGH" | string | null | undefined
  size?: "sm" | "md"
}

export function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  if (!level) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          "bg-muted text-muted-foreground",
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        )}
      >
        <span className="size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
        Not scored
      </span>
    )
  }

  const normalized = level.toUpperCase()

  const styles = {
    LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  } as Record<string, string>

  const dotStyles = {
    LOW: "bg-emerald-500",
    MEDIUM: "bg-amber-500",
    HIGH: "bg-red-500",
  } as Record<string, string>

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        styles[normalized] ?? "bg-muted text-muted-foreground",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full shrink-0",
          dotStyles[normalized] ?? "bg-muted-foreground/50",
        )}
      />
      {normalized === "LOW" && "Low"}
      {normalized === "MEDIUM" && "Medium"}
      {normalized === "HIGH" && "High"}
      {normalized !== "LOW" && normalized !== "MEDIUM" && normalized !== "HIGH" && normalized}
    </span>
  )
}
