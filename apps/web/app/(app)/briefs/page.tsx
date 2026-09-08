"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"
import { useRouter } from "next/navigation"

type Brief = { id: string; title: string; createdAt: string; acknowledgedAt: string | null; audienceUser: { id: string; name: string }; publishedBy: { id: string; name: string }; itemCount: number }
type Action = { id: string; title: string; reviewStatus: string; status: string; sourcePage: number | null; hasCitation: boolean }
type Member = { userId: string; user: { id: string; name: string; email: string } }

export default function BriefsPage() {
  const router = useRouter()
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [title, setTitle] = useState("")
  const [audienceUserId, setAudienceUserId] = useState("")
  const [actionIds, setActionIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    const [briefResponse, actionResponse, memberResponse] = await Promise.all([fetch("/api/briefs"), fetch("/api/actions?view=open&limit=100"), fetch("/api/org/members")])
    if (briefResponse.ok) setBriefs((await briefResponse.json()).briefs ?? [])
    if (actionResponse.ok) setActions(((await actionResponse.json()).actions ?? []).filter((action: Action) => action.reviewStatus === "reviewed" && action.status !== "STALE"))
    if (memberResponse.ok) setMembers(await memberResponse.json())
  }, [])

  useEffect(() => {
    if (!isActionLedgerUiEnabled()) { router.replace("/dashboard"); return }
    void load()
  }, [load, router])

  async function publish() {
    setWorking(true); setError(null)
    try {
      const response = await fetch("/api/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, audienceUserId, actionIds }) })
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "publish_failed") }
      setTitle(""); setActionIds([]); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "publish_failed") } finally { setWorking(false) }
  }

  async function acknowledge(id: string) {
    setWorking(true)
    try { await fetch(`/api/briefs/${id}`, { method: "PATCH" }); await load() } finally { setWorking(false) }
  }

  if (!isActionLedgerUiEnabled()) return null
  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Agreement operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Team briefs</h1><p className="mt-1 text-sm text-muted-foreground">Publish reviewed, cited actions to one named teammate. A brief is a handoff, not a new contract record.</p></header>
    <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Publish a brief</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Title<input className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-sm">Named recipient<select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" value={audienceUserId} onChange={(event) => setAudienceUserId(event.target.value)}><option value="">Choose a member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.name || member.user.email}</option>)}</select></label></div><fieldset className="mt-4 space-y-2"><legend className="text-sm font-medium">Reviewed actions</legend>{actions.length === 0 ? <p className="text-sm text-muted-foreground">No reviewed actions are available.</p> : actions.map((action) => <label key={action.id} className="flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm"><input type="checkbox" checked={actionIds.includes(action.id)} onChange={(event) => setActionIds((current) => event.target.checked ? [...current, action.id] : current.filter((id) => id !== action.id))} />{action.title}{action.sourcePage ? <span className="text-xs text-muted-foreground">page {action.sourcePage}</span> : null}</label>)}</fieldset>{error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}<Button className="mt-4 min-h-11" disabled={working || !title.trim() || !audienceUserId || actionIds.length === 0} onClick={() => void publish()}>Publish brief</Button></section>
    <section className="space-y-3"><h2 className="font-semibold">Your briefs</h2>{briefs.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No briefs yet.</p> : briefs.map((brief) => <article key={brief.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><Link className="font-medium hover:underline" href={`/briefs/${brief.id}`}>{brief.title}</Link><p className="text-sm text-muted-foreground">{brief.itemCount} reviewed action{brief.itemCount === 1 ? "" : "s"} · recipient: {brief.audienceUser.name}</p></div>{brief.acknowledgedAt ? <span className="text-xs text-muted-foreground">Acknowledged</span> : <Button variant="outline" disabled={working} onClick={() => void acknowledge(brief.id)}>Acknowledge</Button>}</article>)}</section>
  </main>
}
