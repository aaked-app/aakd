"use client"

import { Plus } from "lucide-react"

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-16 px-5 text-center">
      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mx-auto mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-[15px] font-semibold mb-1">{title}</p>
      <p className="text-[12.5px] text-muted-foreground max-w-xs mx-auto leading-relaxed mb-4">
        {description}
      </p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {action}
        </button>
      )}
    </div>
  )
}

export default EmptyState
