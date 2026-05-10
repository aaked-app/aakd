"use client"

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  variant?: "destructive" | "primary"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[9991] flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="w-[400px] p-6 rounded-xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-bold mb-2">{title}</p>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center h-8 px-3 text-sm font-medium rounded-lg border border-border bg-transparent text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              variant === "destructive"
                ? "inline-flex items-center h-8 px-3 text-sm font-medium rounded-lg bg-destructive/10 text-destructive border border-transparent transition-colors hover:bg-destructive/20"
                : "inline-flex items-center h-8 px-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground border border-transparent transition-opacity hover:opacity-90"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
