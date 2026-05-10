interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="rounded-[var(--radius)] overflow-hidden border border-border">
      {/* Header row */}
      <div className="bg-muted px-3 py-2.5 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="rounded flex-1 bg-muted-foreground/20 animate-pulse"
            style={{ height: "10px" }}
          />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-3 py-3 border-b border-border last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="rounded flex-1 bg-muted-foreground/20 animate-pulse"
              style={{ height: "14px" }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default TableSkeleton
