"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, ExternalLink, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useActiveOrganization, useSession } from "@/lib/auth/client"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"
import { useRouter } from "next/navigation"

type ActionStatus = "PROPOSED" | "PENDING_REVIEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "STALE" | "DISMISSED"
type ActionDetail = {
  id: string
  title: string
  description: string | null
  condition: string | null
  dueDate: string | null
  sourceText?: string
  sourcePage: number | null
  confidence: number | null
  reviewStatus: string
  status: ActionStatus
  version: number
  hasCitation: boolean
  evidenceRequired: string | null
  contract: { id: string; title: string; counterpartyName: string | null }
  assignee: { id: string; name: string } | null
  approvals: Array<{ id: string; status: string; required: boolean; actionVersion: number | null; step: number; comment: string | null; decidedAt: string | null; createdAt: string; requestedBy: { id: string; name: string } | null; assignedTo: { id: string; name: string } | null }>
  evidence: Array<{ id: string; kind: string; note: string | null; sourceUrl: string | null; recordedBy?: { name: string }; createdAt: string }>
  activities: Array<{ id: string; action: string; detail: string | null; actorLabel: string; user?: { name: string } | null; createdAt: string }>
}
type OrgMember = { userId: string; user: { id: string; name: string; email: string } }

function isOrgMember(value: unknown): value is OrgMember {
  if (!value || typeof value !== "object") return false
  const member = value as Partial<OrgMember>
  return typeof member.userId === "string" && Boolean(member.user) && typeof member.user?.id === "string"
}

export default function ActionDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("actionQueue")
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const { data: activeOrganization } = useActiveOrganization()
  const [action, setAction] = useState<ActionDetail | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [assigneeId, setAssigneeId] = useState("")
  const [evidenceNote, setEvidenceNote] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }), [locale])
  const canWrite = useMemo(() => {
    const userId = session?.user?.id
    if (!userId) return false
    const role = activeOrganization?.members?.find((member) => member.userId === userId)?.role
    return ["owner", "admin", "legal", "member"].includes(role ?? "")
  }, [activeOrganization?.members, session?.user?.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [actionResponse, membersResponse] = await Promise.all([
        fetch(`/api/actions/${params.id}`),
        fetch("/api/org/members"),
      ])
      if (!actionResponse.ok) throw new Error("load")
      const nextAction = await actionResponse.json() as ActionDetail
      setAction(nextAction)
      setAssigneeId(nextAction.assignee?.id ?? "")
      if (membersResponse.ok) {
        const payload = await membersResponse.json() as unknown
        if (Array.isArray(payload)) setMembers(payload.filter(isOrgMember))
      }
    } catch {
      setError(t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [params.id, t])

  useEffect(() => {
    if (!isActionLedgerUiEnabled()) {
      router.replace("/dashboard")
      return
    }
    void load()
  }, [load, router])

  async function runCommand(command: Record<string, unknown>, successKey: string) {
    if (!action) return
    setWorking(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...command, expectedVersion: action.version }),
      })
      const payload = await response.json() as ActionDetail & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? "command")
      setAction(payload)
      setAssigneeId(payload.assignee?.id ?? "")
      setSuccess(t(successKey))
    } catch (caught) {
      setError(t("commandError", { code: caught instanceof Error ? caught.message : "unknown" }))
    } finally {
      setWorking(false)
    }
  }

  async function addEvidence() {
    if (!action || !evidenceNote.trim()) return
    setWorking(true)
    setError(null)
    try {
      const response = await fetch(`/api/actions/${action.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: action.evidenceRequired ?? "completion_note", note: evidenceNote.trim() }),
      })
      if (!response.ok) throw new Error("evidence")
      setEvidenceNote("")
      setSuccess(t("evidenceAdded"))
      await load()
    } catch {
      setError(t("evidenceError"))
    } finally {
      setWorking(false)
    }
  }

  async function sendEmail() {
    if (!action) return
    setWorking(true)
    setError(null)
    try {
      const response = await fetch(`/api/actions/${action.id}/deliver`, { method: "POST" })
      if (!response.ok) throw new Error("delivery")
      setSuccess(t("emailQueued"))
    } catch {
      setError(t("emailError"))
    } finally {
      setWorking(false)
    }
  }

  if (!isActionLedgerUiEnabled()) return null
  if (loading) return <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></main>
  if (!action) return <main className="mx-auto max-w-5xl p-4 sm:p-6"><div role="alert" className="rounded-xl border p-6"><p>{error ?? t("loadError")}</p><Button className="mt-4" onClick={() => void load()}>{t("retry")}</Button></div></main>

  const requiredEvidencePresent = !action.evidenceRequired || action.evidence.some((item) => item.kind === action.evidenceRequired)
  const reviewed = action.reviewStatus === "reviewed" && action.status !== "STALE"
  const requiredApprovals = action.approvals.filter((approval) => approval.required)
  const approvalBlocked = requiredApprovals.some((approval) => approval.status.toLowerCase() !== "approved" || approval.actionVersion !== action.version)

  return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
    <Link href="/actions" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{t("backToQueue")}</Link>

    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><Badge variant={action.status === "STALE" || action.status === "BLOCKED" ? "destructive" : "outline"}>{t(`statuses.${action.status}`)}</Badge><span className="text-xs text-muted-foreground">v{action.version}</span></div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{action.title}</h1>
      <Link href={`/contracts/${action.contract.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{action.contract.title}<ExternalLink className="size-3.5" /></Link>
    </header>

    {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">{error}</div>}
    {success && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">{success}</div>}

    <section aria-label={t("trustRail")} className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-4">
      <div className="flex min-h-11 items-center gap-2 text-sm"><ShieldCheck className="size-4 text-primary" />{action.hasCitation ? t("sourceCited") : t("sourceUnavailable")}</div>
      <div className="flex min-h-11 items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-primary" />{reviewed ? t("humanReviewed") : t("reviewRequired")}</div>
      <div className="flex min-h-11 items-center gap-2 text-sm"><UserRound className="size-4 text-primary" />{action.assignee ? t("owner", { name: action.assignee.name }) : t("unassigned")}</div>
      <div className="flex min-h-11 items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-primary" />{requiredEvidencePresent ? t("evidenceRecorded") : t("evidenceNeeded")}</div>
    </section>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("sourceAndRequirement")}</h2>
          {action.sourceText ? <blockquote className="mt-4 border-s-2 border-primary/50 ps-4 text-sm leading-6">“{action.sourceText}”{action.sourcePage ? <span className="ms-2 text-xs text-muted-foreground">{t("page", { page: action.sourcePage })}</span> : null}</blockquote> : <p className="mt-3 text-sm text-muted-foreground">{t("sourceUnavailable")}</p>}
          {action.description && <p className="mt-4 text-sm text-muted-foreground">{action.description}</p>}
          {action.condition && <p className="mt-3 text-sm"><span className="font-medium">{t("condition")}:</span> {action.condition}</p>}
          {action.dueDate && <p className="mt-3 inline-flex items-center gap-2 text-sm"><Clock3 className="size-4" />{dateFormatter.format(new Date(action.dueDate))}</p>}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("approvalContext")}</h2>
          {action.approvals.length ? <ol className="mt-4 space-y-3">{action.approvals.map((approval) => { const status = approval.status.toLowerCase(); return <li key={approval.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{approval.assignedTo?.name ?? t("approvalUnassigned")}</span><Badge variant={status === "rejected" ? "destructive" : "outline"}>{t(`approvalStatuses.${status}`)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{approval.required ? t("approvalRequired") : t("approvalOptional")} · {t("approvalStep", { step: approval.step })}</p>{approval.comment ? <p className="mt-2 text-sm">{approval.comment}</p> : null}</li> })}</ol> : <p className="mt-3 text-sm text-muted-foreground">{t("approvalNotRequired")}</p>}
          {approvalBlocked ? <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><CircleAlert className="size-4 shrink-0" />{t("approvalBlocksAction")}</p> : null}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("evidenceTitle")}</h2>
          {canWrite ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="min-h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder={t("evidencePlaceholder")} aria-label={t("evidenceInput")} /><Button variant="outline" disabled={working || !evidenceNote.trim()} onClick={() => void addEvidence()}>{t("addEvidence")}</Button></div> : <p className="mt-3 text-sm text-muted-foreground">{t("readOnlyDescription")}</p>}
          {action.evidence.length ? <ul className="mt-4 space-y-2">{action.evidence.map((item) => <li key={item.id} className="rounded-md bg-muted/40 p-3 text-sm"><p>{item.note || item.kind}</p><p className="mt-1 text-xs text-muted-foreground">{item.recordedBy?.name ?? t("recordedByMember")} · {dateFormatter.format(new Date(item.createdAt))}</p></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{t("noEvidence")}</p>}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("history")}</h2>
          {action.activities.length ? <ol className="mt-4 space-y-3">{action.activities.map((item) => <li key={item.id} className="border-s ps-4 text-sm"><p>{item.detail ?? item.action}</p><p className="text-xs text-muted-foreground">{item.user?.name ?? item.actorLabel} · {dateFormatter.format(new Date(item.createdAt))}</p></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">{t("noHistory")}</p>}
        </section>
      </div>

      <aside className="space-y-4">
        {!canWrite ? <section className="rounded-xl border bg-muted/20 p-5"><h2 className="font-semibold">{t("readOnly")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("readOnlyDescription")}</p></section> : null}
        {canWrite ? <>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("nextStep")}</h2>
          <div className="mt-4 space-y-3">
            {(action.status === "PENDING_REVIEW" || action.status === "STALE") && <Button className="min-h-11 w-full" disabled={working} onClick={() => void runCommand({ command: "validate", evidenceRequired: action.evidenceRequired ?? "completion_note" }, "reviewSaved")}>{t("reviewAndValidate")}</Button>}
            {action.status === "PROPOSED" && <Button className="min-h-11 w-full" disabled={working || !action.assignee} onClick={() => void runCommand({ command: "acknowledge" }, "acknowledgedSuccess")}>{t("acknowledge")}</Button>}
            {(action.status === "ACKNOWLEDGED" || action.status === "BLOCKED") && <Button className="min-h-11 w-full" disabled={working || approvalBlocked} onClick={() => void runCommand({ command: "start" }, "startedSuccess")}>{t("startWork")}</Button>}
            {(action.status === "ACKNOWLEDGED" || action.status === "IN_PROGRESS") && <Button className="min-h-11 w-full" disabled={working || !requiredEvidencePresent || approvalBlocked} onClick={() => void runCommand({ command: "complete" }, "completedSuccess")}>{t("complete")}</Button>}
            {action.status === "COMPLETED" && <Button className="min-h-11 w-full" variant="outline" disabled={working} onClick={() => void runCommand({ command: "reopen" }, "reopenedSuccess")}>{t("reopen")}</Button>}
            {reviewed && action.assignee && action.status !== "COMPLETED" && action.status !== "DISMISSED" && <Button className="min-h-11 w-full" variant="outline" disabled={working || approvalBlocked} onClick={() => void sendEmail()}><Mail className="size-4" />{t("sendReminder")}</Button>}
          </div>
          {!requiredEvidencePresent && <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><CircleAlert className="size-4 shrink-0" />{t("completeNeedsEvidence")}</p>}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("assignment")}</h2>
          <select className="mt-3 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} aria-label={t("assignment")}>
            <option value="">{t("unassigned")}</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
          </select>
          <Button className="mt-2 min-h-11 w-full" variant="outline" disabled={working || !assigneeId || assigneeId === action.assignee?.id} onClick={() => void runCommand({ command: "assign", assigneeId }, "assignedSuccess")}>{t("saveOwner")}</Button>
        </section>

        {(action.status === "ACKNOWLEDGED" || action.status === "IN_PROGRESS") && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">{t("blockedWork")}</h2><textarea className="mt-3 min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder={t("blockReason")} /><Button className="mt-2 min-h-11 w-full" variant="outline" disabled={working || !blockReason.trim()} onClick={() => void runCommand({ command: "block", reason: blockReason.trim() }, "blockedSuccess")}>{t("markBlocked")}</Button></section>}
        </> : null}
      </aside>
    </div>
    {working && <div className="fixed bottom-4 end-4 rounded-full border bg-background p-3 shadow-lg" aria-live="polite"><Loader2 className="size-5 animate-spin" /></div>}
  </main>
}
