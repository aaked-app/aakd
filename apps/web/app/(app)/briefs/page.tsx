"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"
import { useActiveOrganization, useSession } from "@/lib/auth/client"
import { hasRole } from "@/lib/auth/roles"

type Brief = { id: string; title: string; acknowledgedAt: string | null; audienceUser: { id: string; name: string }; itemCount: number }
type Action = { id: string; title: string; version: number; reviewStatus: string; status: string; sourcePage: number | null; hasSourceText: boolean; assigneeId: string | null; dueDate: string | null; condition: string | null }
type Member = { userId: string; user: { id: string; name: string; email: string } }

export default function BriefsPage() {
  const router = useRouter()
  const t = useTranslations("briefs")
  const locale = useLocale()
  const { data: session } = useSession()
  const { data: organization } = useActiveOrganization()
  const userId = session?.user?.id
  const role = organization?.members?.find(member => member.userId === userId)?.role ?? ""
  const canPublish = hasRole(role, "legal")
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [title, setTitle] = useState("")
  const [audienceUserId, setAudienceUserId] = useState("")
  const [actionIds, setActionIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const inFlight = useRef(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const response = await fetch("/api/briefs", { signal })
      if (!response.ok) throw new Error("loadFailed")
      setBriefs((await response.json()).briefs ?? [])
      if (canPublish) {
        const [actionResponse, memberResponse] = await Promise.all([
          fetch("/api/actions?view=open&limit=100", { signal }), fetch("/api/org/members", { signal }),
        ])
        if (!actionResponse.ok || !memberResponse.ok) throw new Error("loadFailed")
        setActions(((await actionResponse.json()).actions ?? []).filter((action: Action) =>
          action.reviewStatus === "reviewed" && !["STALE", "DISMISSED", "PENDING_REVIEW"].includes(action.status)
          && action.hasSourceText && action.assigneeId && (action.dueDate || action.condition?.trim())))
        setMembers(await memberResponse.json())
      }
      setError(null)
    } catch {
      if (!signal?.aborted) setError("loadFailed")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canPublish])

  useEffect(() => {
    if (!isActionLedgerUiEnabled()) { router.replace("/dashboard"); return }
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, router])

  async function publish() {
    if (inFlight.current) return
    inFlight.current = true
    setWorking(true); setError(null); setSuccess(null)
    try {
      const response = await fetch("/api/briefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, audienceUserId, actionIds,
          expectedVersions: Object.fromEntries(actionIds.map(id => [id, actions.find(action => action.id === id)?.version])),
        }),
      })
      if (!response.ok) throw new Error(response.status === 409 ? "sourceChanged" : "publishFailed")
      setTitle(""); setActionIds([]); setSuccess("published")
      await load()
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "sourceChanged" ? "sourceChanged" : "publishFailed")
    } finally { inFlight.current = false; setWorking(false) }
  }

  async function acknowledge(id: string) {
    if (inFlight.current) return
    inFlight.current = true
    setWorking(true); setError(null); setSuccess(null)
    try {
      const response = await fetch(`/api/briefs/${id}`, { method: "PATCH" })
      if (!response.ok) throw new Error("acknowledgeFailed")
      const result = await response.json()
      setBriefs(current => current.map(brief => brief.id === id ? { ...brief, acknowledgedAt: result.acknowledgedAt } : brief))
      setSuccess("acknowledged")
    } catch { setError("acknowledgeFailed") }
    finally { inFlight.current = false; setWorking(false) }
  }

  if (!isActionLedgerUiEnabled()) return null
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("description")}</p></header>
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t(error)}</p><Button variant="outline" disabled={working || loading} onClick={() => void load()}>{t("retry")}</Button></div>}
    {success && <p role="status" className="text-sm">{t(success)}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
    {canPublish && <form onSubmit={event => { event.preventDefault(); void publish() }} aria-busy={working} className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="font-semibold">{t("publishHeading")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm">{t("titleField")}<input required maxLength={200} disabled={working} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-base" value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label className="min-w-0 text-sm">{t("recipient")}<select required disabled={working || loading} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-base" value={audienceUserId} onChange={event => setAudienceUserId(event.target.value)}><option value="">{t("chooseMember")}</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.user.name || member.user.email}</option>)}</select></label>
      </div>
      <fieldset disabled={working || loading} className="mt-4 space-y-2">
        <legend className="text-sm font-medium">{t("reviewedActions")}</legend>
        <p className="mb-2 text-sm text-muted-foreground">{t("selectionHelp")}</p>
        {actions.length === 0 && !loading ? <p className="text-sm text-muted-foreground">{t("noActions")}</p> : actions.map(action => <label key={action.id} className="flex min-h-11 items-start gap-3 rounded-md border p-3 text-sm">
          <input type="checkbox" className="mt-1 shrink-0" checked={actionIds.includes(action.id)} disabled={!actionIds.includes(action.id) && actionIds.length >= 50} onChange={event => setActionIds(current => event.target.checked ? [...current, action.id] : current.filter(id => id !== action.id))} />
          <span className="min-w-0 break-words">{action.title}{action.sourcePage != null && <span className="ms-2 text-xs text-muted-foreground">{t("page", { page: action.sourcePage })}</span>}</span>
        </label>)}
      </fieldset>
      <Button type="submit" className="mt-4 min-h-11" disabled={working || loading || !title.trim() || !audienceUserId || actionIds.length === 0}>{working ? t("saving") : t("publish")}</Button>
    </form>}
    <section className="space-y-3"><h2 className="font-semibold">{t("yourBriefs")}</h2>
      {!loading && briefs.length === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{t("empty")}</p>}
      {briefs.map(brief => <article key={brief.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><Link className="break-words font-medium underline-offset-4 hover:underline focus-visible:underline" href={`/briefs/${brief.id}`}>{brief.title}</Link><p className="mt-1 break-words text-sm text-muted-foreground">{t("itemCount", { count: brief.itemCount })} · {t("recipientName", { name: brief.audienceUser.name })}</p></div>
        {brief.acknowledgedAt ? <span className="text-sm text-muted-foreground">{t("acknowledged")}</span> : brief.audienceUser.id === userId && <Button variant="outline" disabled={working} onClick={() => void acknowledge(brief.id)}>{t("acknowledge")}</Button>}
      </article>)}
    </section>
  </main>
}
