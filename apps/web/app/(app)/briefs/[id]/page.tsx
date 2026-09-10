"use client"

import { useCallback, useEffect, useRef, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

type Brief = {
  id: string; title: string; acknowledgedAt: string | null; canRespond: boolean;
  publishedBy: { id: string; name: string }; audienceUser: { id: string; name: string };
  items: Array<{ id: string; actionId: string; actionVersion: number; title: string; condition: string | null; dueDate: string | null;
    sourceText: string | null; sourcePage: number | null; confidence: number | null;
    freshness: "CURRENT" | "STALE"; assignee: { id: string; name: string } | null }>;
}

export default function BriefDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)
  const router = useRouter()
  const t = useTranslations("briefs")
  const locale = useLocale()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [workingItem, setWorkingItem] = useState<string | null>(null)
  const [itemMessage, setItemMessage] = useState<Record<string, "evidenceSaved" | "blockerSaved" | "itemCommandFailed" | undefined>>({})
  const inFlight = useRef(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/briefs/${params.id}`, { signal })
      if (!response.ok) throw new Error("unavailable")
      setBrief(await response.json()); setError(null)
    } catch {
      if (!signal?.aborted) { setError("unavailable"); setBrief(null) }
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [params.id])

  useEffect(() => {
    if (!isActionLedgerUiEnabled()) { router.replace("/dashboard"); return }
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, router])

  async function acknowledge() {
    if (inFlight.current) return
    inFlight.current = true
    setWorking(true); setError(null)
    try {
      const response = await fetch(`/api/briefs/${params.id}`, { method: "PATCH" })
      if (!response.ok) throw new Error("acknowledgeFailed")
      const result = await response.json()
      setBrief(current => current ? { ...current, acknowledgedAt: result.acknowledgedAt } : current)
    } catch { setError("acknowledgeFailed") }
    finally { inFlight.current = false; setWorking(false) }
  }

  async function submitItemCommand(item: Brief["items"][number], command: "evidence" | "blocker", form: HTMLFormElement) {
    if (workingItem) return
    const data = new FormData(form)
    const body = command === "evidence"
      ? { expectedVersion: item.actionVersion, kind: data.get("kind"), note: data.get("note") || undefined, sourceUrl: data.get("sourceUrl") || undefined }
      : { expectedVersion: item.actionVersion, reason: data.get("reason") }
    setWorkingItem(item.id); setItemMessage(current => ({ ...current, [item.id]: undefined }))
    try {
      const response = await fetch(`/api/briefs/${params.id}/items/${item.id}/${command}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error("itemCommandFailed")
      setItemMessage(current => ({ ...current, [item.id]: command === "evidence" ? "evidenceSaved" : "blockerSaved" }))
      if (command === "blocker") setBrief(current => current ? { ...current, items: current.items.map(value => value.id === item.id ? { ...value, freshness: "STALE" } : value) } : current)
      form.reset()
    } catch { setItemMessage(current => ({ ...current, [item.id]: "itemCommandFailed" })) }
    finally { setWorkingItem(null) }
  }

  if (!isActionLedgerUiEnabled()) return null
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
    <Link href="/briefs" className="text-sm text-primary underline-offset-4 hover:underline focus-visible:underline">{t("back")}</Link>
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t(error)}</p><Button variant="outline" disabled={working || loading} onClick={() => void load()}>{t("retry")}</Button></div>}
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
    {brief && <>
      <header><h1 className="break-words text-2xl font-semibold">{brief.title}</h1><p className="mt-2 break-words text-sm text-muted-foreground">{t("publishedFor", { publisher: brief.publishedBy.name, recipient: brief.audienceUser.name })}</p></header>
      {brief.items.map(item => {
        const message = itemMessage[item.id]
        return <article key={item.id} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="break-words font-semibold">{item.title}</h2>
        {item.freshness === "STALE" && <p role="status" className="text-sm font-medium text-destructive">{t("stale")}</p>}
        <dl className="space-y-2 text-sm">
          <div><dt className="inline font-medium">{t("owner")}: </dt><dd className="inline break-words">{item.assignee?.name ?? t("ownerUnavailable")}</dd></div>
          {item.condition && <div><dt className="inline font-medium">{t("condition")}: </dt><dd className="inline break-words">{item.condition}</dd></div>}
          {item.dueDate && <div><dt className="inline font-medium">{t("due")}: </dt><dd className="inline">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.dueDate))}</dd></div>}
        </dl>
        {item.sourceText && <blockquote className="break-words border-s border-primary/50 ps-4 text-sm">{item.sourceText}{item.sourcePage != null && <footer className="mt-1 text-xs text-muted-foreground">{t("page", { page: item.sourcePage })}</footer>}</blockquote>}
        <p className="text-xs text-muted-foreground">{t("reviewedAtPublication")}{item.confidence != null ? ` · ${t("confidence", { value: Math.round(item.confidence * 100) })}` : ""}</p>
        {brief.canRespond && item.freshness === "CURRENT" && <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">{t("addEvidence")}</summary>
            <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void submitItemCommand(item, "evidence", event.currentTarget) }}>
              <label className="block text-sm"><span>{t("evidenceKind")}</span><input name="kind" required maxLength={80} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" /></label>
              <label className="block text-sm"><span>{t("evidenceNote")}</span><textarea name="note" maxLength={4000} className="mt-1 min-h-20 w-full rounded-md border bg-background p-3" /></label>
              <label className="block text-sm"><span>{t("evidenceUrl")}</span><input name="sourceUrl" type="url" maxLength={2000} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" /></label>
              <Button type="submit" className="min-h-11" disabled={workingItem === item.id}>{workingItem === item.id ? t("saving") : t("submitEvidence")}</Button>
            </form>
          </details>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">{t("reportBlocker")}</summary>
            <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void submitItemCommand(item, "blocker", event.currentTarget) }}>
              <label className="block text-sm"><span>{t("blockerReason")}</span><textarea name="reason" required maxLength={1000} className="mt-1 min-h-20 w-full rounded-md border bg-background p-3" /></label>
              <Button type="submit" variant="outline" className="min-h-11" disabled={workingItem === item.id}>{workingItem === item.id ? t("saving") : t("submitBlocker")}</Button>
            </form>
          </details>
        </div>}
        {message && <p role={message === "itemCommandFailed" ? "alert" : "status"} className={message === "itemCommandFailed" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{t(message)}</p>}
      </article>})}
      {brief.acknowledgedAt ? <p role="status" className="text-sm text-muted-foreground">{t("acknowledged")}</p> : brief.canRespond && <Button className="min-h-11" disabled={working} onClick={() => void acknowledge()}>{working ? t("saving") : t("acknowledge")}</Button>}
    </>}
  </main>
}
