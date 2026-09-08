"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

type Brief = { id: string; title: string; acknowledgedAt: string | null; publishedBy: { name: string }; audienceUser: { name: string }; items: Array<{ id: string; actionId: string; actionVersion: number; title: string; description: string | null; condition: string | null; dueDate: string | null; sourceText: string | null; sourcePage: number | null; confidence: number | null }> }

export default function BriefDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)
  const router = useRouter()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!isActionLedgerUiEnabled()) { router.replace("/dashboard"); return }; void fetch(`/api/briefs/${params.id}`).then(async (response) => { if (!response.ok) throw new Error("load_failed"); setBrief(await response.json()) }).catch(() => setError("This brief is unavailable.")) }, [params.id, router])
  async function acknowledge() { await fetch(`/api/briefs/${params.id}`, { method: "PATCH" }); setBrief((current) => current ? { ...current, acknowledgedAt: new Date().toISOString() } : current) }
  if (error) return <main className="mx-auto max-w-4xl p-6"><p role="alert">{error}</p></main>
  if (!brief) return <main className="mx-auto max-w-4xl p-6"><p>Loading brief…</p></main>
  return <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6"><Link href="/briefs" className="text-sm text-primary hover:underline">← Back to briefs</Link><header><h1 className="mt-3 text-2xl font-semibold">{brief.title}</h1><p className="mt-1 text-sm text-muted-foreground">Published by {brief.publishedBy.name} for {brief.audienceUser.name}</p></header>{brief.items.map((item) => <article key={item.id} className="rounded-xl border bg-card p-5"><h2 className="font-semibold">{item.title}</h2>{item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}{item.condition ? <p className="mt-3 text-sm"><strong>Condition:</strong> {item.condition}</p> : null}{item.dueDate ? <p className="mt-2 text-sm"><strong>Due:</strong> {new Date(item.dueDate).toLocaleDateString()}</p> : null}{item.sourceText ? <blockquote className="mt-4 border-s-2 border-primary/50 ps-4 text-sm">“{item.sourceText}”{item.sourcePage ? <span className="ms-2 text-xs text-muted-foreground">page {item.sourcePage}</span> : null}</blockquote> : null}<Link className="mt-4 inline-block text-sm text-primary hover:underline" href={`/actions/${item.actionId}`}>Open action →</Link></article>)}{!brief.acknowledgedAt ? <Button className="min-h-11" onClick={() => void acknowledge()}>Acknowledge brief</Button> : <p className="text-sm text-muted-foreground">Acknowledged.</p>}</main>
}
