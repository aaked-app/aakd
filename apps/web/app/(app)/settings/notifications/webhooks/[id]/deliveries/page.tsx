"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Delivery { id: string; eventName: string; attempt: number; httpStatus: number | null; status: "pending" | "success" | "failed"; durationMs: number | null; deliveredAt: string | null; createdAt: string }
interface Webhook { id: string; label: string; urlPreview: string; enabled: boolean; createdAt: string }
const PAGE_SIZE = 50

export default function WebhookDeliveriesPage() {
  const t = useTranslations("webhookDeliveries"); const locale = useLocale(); const { id } = useParams<{ id: string }>(); const requestRef = useRef(0)
  const [deliveries, setDeliveries] = useState<Delivery[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [webhook, setWebhook] = useState<Webhook | null>(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))
  const load = useCallback(async () => {
    const request = ++requestRef.current; setLoading(true); setError(false)
    try {
      const [list, all] = await Promise.all([fetch(`/api/org/webhooks/${id}/deliveries?page=${page}&limit=${PAGE_SIZE}`), fetch("/api/org/webhooks")])
      if (!list.ok || !all.ok) throw new Error()
      const [deliveryData, webhookData] = await Promise.all([list.json(), all.json()])
      if (request !== requestRef.current) return
      setDeliveries(deliveryData.deliveries ?? []); setTotal(deliveryData.total ?? 0); setWebhook((webhookData.webhooks ?? []).find((item: Webhook) => item.id === id) ?? null)
    } catch { if (request === requestRef.current) setError(true) }
    finally { if (request === requestRef.current) setLoading(false) }
  }, [id, page])
  useEffect(() => { void load(); return () => { requestRef.current += 1 } }, [load])
  const status = (value: Delivery["status"]) => <Badge variant={value === "failed" ? "destructive" : value === "pending" ? "secondary" : "default"}>{t(`statuses.${value}`)}</Badge>

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <nav aria-label={t("breadcrumbs")} className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Link href="/settings/notifications" className="hover:text-foreground">{t("notifications")}</Link><ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" /><span className="truncate text-foreground">{webhook?.label ?? t("webhook")}</span></nav>
    <header className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{t("eyebrow")}</p><h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("summary", { count: total })}</p></header>
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><p className="font-medium">{t("loadError")}</p><p className="mt-1 text-sm text-muted-foreground">{t("loadErrorHelp")}</p><Button className="mt-4" variant="outline" onClick={() => void load()}>{t("retry")}</Button></div> : <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block"><Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead>{t("fields.event")}</TableHead><TableHead>{t("fields.attempt")}</TableHead><TableHead>{t("fields.http")}</TableHead><TableHead>{t("fields.duration")}</TableHead><TableHead>{t("fields.date")}</TableHead><TableHead>{t("fields.status")}</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 4 }).map((_, row) => <TableRow key={row}>{Array.from({ length: 6 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>) : deliveries.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">{t("empty")}</TableCell></TableRow> : deliveries.map((d) => <TableRow key={d.id}><TableCell className="font-mono text-xs">{d.eventName}</TableCell><TableCell>{d.attempt}</TableCell><TableCell>{d.httpStatus ?? "—"}</TableCell><TableCell>{d.durationMs == null ? "—" : t("milliseconds", { count: d.durationMs })}</TableCell><TableCell>{formatDate(d.deliveredAt ?? d.createdAt)}</TableCell><TableCell>{status(d.status)}</TableCell></TableRow>)}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />) : deliveries.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("empty")}</div> : deliveries.map((d) => <article key={d.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><p className="break-all font-mono text-xs font-medium">{d.eventName}</p>{status(d.status)}</div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">{t("fields.attempt")}</dt><dd>{d.attempt}</dd></div><div><dt className="text-xs text-muted-foreground">{t("fields.http")}</dt><dd>{d.httpStatus ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">{t("fields.duration")}</dt><dd>{d.durationMs == null ? "—" : t("milliseconds", { count: d.durationMs })}</dd></div><div><dt className="text-xs text-muted-foreground">{t("fields.date")}</dt><dd>{formatDate(d.deliveredAt ?? d.createdAt)}</dd></div></dl></article>)}</div>
    </>}
    {!error && !loading && totalPages > 1 && <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{t("page", { page, totalPages })}</span><div className="flex gap-2"><Button aria-label={t("previous")} variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4 rtl:rotate-180" />{t("previous")}</Button><Button aria-label={t("next")} variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t("next")}<ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button></div></div>}
  </div>
}
