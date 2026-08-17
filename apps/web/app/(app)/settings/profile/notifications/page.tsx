"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { DEFAULT_EMAIL_ENABLED, NOTIFICATION_EVENTS, isNotificationEventName, type NotificationEventName } from "@/lib/notifications/events"

interface Preference { eventName: NotificationEventName; emailEnabled: boolean }
const GROUPS: Array<{ key: "contracts" | "approvals" | "obligations" | "workspace"; events: NotificationEventName[] }> = [
  { key: "contracts", events: ["contract.uploaded", "contract.extracted", "contract.sent_for_signing", "contract.signed", "contract.signing_declined", "contract.expiring_soon", "contract.expired", "contract.archived"] },
  { key: "approvals", events: ["approval.requested", "approval.approved", "approval.rejected"] },
  { key: "obligations", events: ["obligation.due_soon", "obligation.overdue"] },
  { key: "workspace", events: ["import.completed", "member.role_changed", "member.joined"] },
]
const eventKey = (event: NotificationEventName) => event.replaceAll(".", "_")

export default function ProfileNotificationsPage() {
  const t = useTranslations("profileNotifications")
  const params = useSearchParams()
  const toastShown = useRef(false)
  const requestRef = useRef(0)
  const [prefs, setPrefs] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true); setError(false)
    try {
      const res = await fetch("/api/user/notification-preferences")
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (request !== requestRef.current) return
      const incoming: Preference[] = (data.preferences ?? []).filter((p: { eventName: string }) => isNotificationEventName(p.eventName))
      const byEvent = new Map(incoming.map((p) => [p.eventName, p]))
      setPrefs(NOTIFICATION_EVENTS.map((eventName) => byEvent.get(eventName) ?? { eventName, emailEnabled: DEFAULT_EMAIL_ENABLED[eventName] }))
    } catch { if (request === requestRef.current) setError(true) }
    finally { if (request === requestRef.current) setLoading(false) }
  }, [])

  useEffect(() => { void load(); return () => { requestRef.current += 1 } }, [load])
  useEffect(() => {
    if (toastShown.current || params.get("unsubscribed") !== "1") return
    const raw = params.get("event")
    const event = raw && isNotificationEventName(raw) ? t(`events.${eventKey(raw)}`) : t("theseEmails")
    toast.success(t("unsubscribed", { event })); toastShown.current = true
  }, [params, t])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/user/notification-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: prefs }) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const next: Preference[] = (data.preferences ?? []).filter((p: { eventName: string }) => isNotificationEventName(p.eventName))
      const byEvent = new Map(next.map((pref) => [pref.eventName, pref]))
      setPrefs(NOTIFICATION_EVENTS.map((eventName) => byEvent.get(eventName) ?? { eventName, emailEnabled: DEFAULT_EMAIL_ENABLED[eventName] }))
      toast.success(t("saved"))
    } catch { toast.error(t("saveError")) }
    finally { setSaving(false) }
  }

  return <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{t("eyebrow")}</p><h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p></header>
    {loading ? <div className="space-y-3" aria-label={t("loading")}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      : error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><p className="font-medium">{t("loadError")}</p><p className="mt-1 text-sm text-muted-foreground">{t("loadErrorHelp")}</p><Button className="mt-4" variant="outline" onClick={() => void load()}>{t("retry")}</Button></div>
      : <div className="space-y-5">{GROUPS.map((group) => <section key={group.key} aria-labelledby={`group-${group.key}`} className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border bg-muted/35 px-4 py-3 sm:px-5"><h2 id={`group-${group.key}`} className="text-sm font-semibold">{t(`groups.${group.key}`)}</h2></div><div className="divide-y divide-border">{group.events.map((eventName) => { const pref = prefs.find((item) => item.eventName === eventName)!; const label = t(`events.${eventKey(eventName)}`); return <label key={eventName} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 sm:px-5"><span className="min-w-0"><span className="block text-sm font-medium">{label}</span><span className="block truncate font-mono text-xs text-muted-foreground">{eventName}</span></span><Checkbox aria-label={label} checked={pref.emailEnabled} onCheckedChange={(value) => setPrefs((current) => current.map((item) => item.eventName === eventName ? { ...item, emailEnabled: value === true } : item))} /></label>})}</div></section>)}<div className="flex justify-end border-t border-border pt-5"><Button onClick={save} disabled={saving}>{saving ? t("saving") : t("save")}</Button></div></div>}
  </div>
}
