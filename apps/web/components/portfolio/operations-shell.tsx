import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface OperationsShellProps {
  eyebrow: string
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** A restrained shared frame for portfolio-level operational queues. */
export function OperationsShell({ eyebrow, title, description, icon, action, children, className }: OperationsShellProps) {
  return (
    <main className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-muted/[0.18]", className)}>
      <header className="shrink-0 border-b border-border bg-background/95 px-4 py-5 sm:px-6 lg:px-7">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
            <div className="mt-2 flex min-w-0 items-center gap-2.5">
              {icon ? <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">{icon}</span> : null}
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            </div>
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
  icon?: ReactNode
  action?: ReactNode
}

export function FocusBand({ label, title, detail, icon, action }: FocusBandProps) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-xl border border-border border-s-4 border-s-primary/50 bg-background p-4 transition-colors motion-safe:duration-200 hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span> : null}
        <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  )
}
