import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface OperationsShellProps {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** A restrained shared frame for portfolio-level operational queues. */
export function OperationsShell({ eyebrow, title, description, action, children, className }: OperationsShellProps) {
  return (
    <main className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-muted/[0.18]", className)}>
      <header className="shrink-0 border-b border-border bg-background/95 px-4 py-5 sm:px-6 lg:px-7">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </header>
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-7">
        <div className="mx-auto w-full max-w-[96rem]">{children}</div>
      </div>
    </main>
  )
}

interface FocusBandProps {
  label: string
  title: string
  detail: string
  action?: ReactNode
}

export function FocusBand({ label, title, detail, action }: FocusBandProps) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  )
}
