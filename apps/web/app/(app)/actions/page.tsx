"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, CircleAlert, Clock3, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

type ActionStatus = "PROPOSED" | "PENDING_REVIEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "STALE" | "DISMISSED"
type Action = {
  id: string
  kind: string
  title: string
  description: string | null
  condition: string | null
  dueDate: string | null
  sourcePage: number | null
  confidence: number | null
  reviewStatus: string
  status: ActionStatus
  version: number
  hasCitation: boolean
  evidenceCount: number
  contract: { id: string; title: string; counterpartyName: string | null }
  assignee: { id: string; name: string } | null
}
type ActionView = "my_work" | "needs_review" | "due_soon" | "blocked" | "completed"
type Member = { userId: string; user: { id: string; name: string; email: string } }

const ACTION_VIEWS: ActionView[] = ["my_work", "needs_review", "due_soon", "blocked", "completed"]
const ACTION_KINDS = ["OBLIGATION", "RENEWAL_NOTICE", "EXPIRY", "CUSTOM"] as const

function dateLabel(value: string | null, locale: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date)
}

function statusTone(status: ActionStatus): "destructive" | "secondary" | "outline" {
  if (status === "BLOCKED" || status === "STALE") return "destructive"
  if (status === "COMPLETED") return "secondary"
  return "outline"
}

export default function ActionsPage() {
  const t = useTranslations("actionQueue")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedView = searchParams.get("view")
  const view: ActionView = ACTION_VIEWS.includes(requestedView as ActionView) ? requestedView as ActionView : "my_work"
  const kind = searchParams.get("kind") ?? ""
  const ownerId = searchParams.get("ownerId") ?? ""
  const [actions, setActions] = useState<Action[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!isActionLedgerUiEnabled()) return
    setLoading(true)
    setError(false)
    try {
      const query = new URLSearchParams({ view, limit: "100" })
      if (kind) query.set("kind", kind)
      if (ownerId) query.set("ownerId", ownerId)
      const response = await fetch(`/api/actions?${query}`)
      if (!response.ok) throw new Error("load failed")
      const payload = await response.json() as { actions?: Action[] }
      setActions(Array.isArray(payload.actions) ? payload.actions : [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [kind, ownerId, view])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!isActionLedgerUiEnabled()) {
      router.replace("/dashboard")
      return
    }
    void fetch("/api/org/members").then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as unknown
      if (Array.isArray(body)) setMembers(body as Member[])
    }).catch(() => undefined)
  }, [router])

  function updateFilter(key: "view" | "kind" | "ownerId", value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value); else next.delete(key)
    router.replace(`/actions?${next.toString()}`)
  }

  if (!isActionLedgerUiEnabled()) return null

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11 gap-2 self-start sm:self-auto">
          <RefreshCw className="size-4" />{t("refresh")}
        </Button>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("filtersLabel")}>
        {ACTION_VIEWS.map((value) => (
          <Button key={value} variant={view === value ? "default" : "outline"} size="sm" onClick={() => updateFilter("view", value)}>
            {t(`views.${value}`)}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">{t("kindFilter")}</span><select className="min-h-11 w-full rounded-md border bg-background px-3" value={kind} onChange={(event) => updateFilter("kind", event.target.value)}><option value="">{t("allKinds")}</option>{ACTION_KINDS.map((value) => <option key={value} value={value}>{t(`kinds.${value}`)}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">{t("ownerFilter")}</span><select className="min-h-11 w-full rounded-md border bg-background px-3" value={ownerId} onChange={(event) => updateFilter("ownerId", event.target.value)}><option value="">{t("allOwners")}</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.name || member.user.email}</option>)}</select></label>
      </div>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><span>{t("loadError")}</span><Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button></div>}
      {loading && <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-36 w-full" />)}</div>}
      {!loading && !error && actions.length === 0 && <div className="rounded-xl border border-dashed p-12 text-center"><CheckCircle2 className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">{t("emptyTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p></div>}

      {!loading && actions.length > 0 && <div className="space-y-3">
        {actions.map((action) => {
          return <article key={action.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusTone(action.status)}>{t(`statuses.${action.status}`)}</Badge>
                  <span className="text-xs text-muted-foreground">{t(`kinds.${action.kind}`, { fallback: action.kind })}</span>
                </div>
                <h2 className="font-semibold">{action.title}</h2>
                <Link className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={`/contracts/${action.contract.id}`}>
                  {action.contract.title}<ExternalLink className="size-3.5" />
                </Link>
                {action.description && <p className="text-sm text-muted-foreground">{action.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {action.hasCitation && <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><ShieldCheck className="size-3.5" />{t("sourceCited")}</span>}
                  {action.reviewStatus === "reviewed" && <span className="rounded-full border px-2 py-1">{t("humanReviewed")}</span>}
                  {action.evidenceCount > 0 && <span className="rounded-full border px-2 py-1">{t("evidenceRecorded")}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 text-sm sm:items-end">
                {action.dueDate && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock3 className="size-4" />{dateLabel(action.dueDate, locale)}</span>}
                <span className="text-muted-foreground">{action.assignee ? t("owner", { name: action.assignee.name }) : t("unassigned")}</span>
                {action.confidence != null && <span className="text-xs text-muted-foreground">{t("confidence", { value: Math.round(action.confidence * 100) })}</span>}
              </div>
            </div>
            {action.status === "STALE" && <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{t("staleNotice")}</div>}
            <div className="mt-4 flex justify-end border-t pt-3">
              <Link className={buttonVariants({ size: "sm" })} href={`/actions/${action.id}`}>{t("openAction")}<ExternalLink className="size-3.5" /></Link>
            </div>
          </article>
        })}
      </div>}
    </main>
  )
}
