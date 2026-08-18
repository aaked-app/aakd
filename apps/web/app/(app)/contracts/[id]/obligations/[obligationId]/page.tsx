"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  AlertCircle, ArrowLeft, Bell, CalendarDays, CheckCircle2, Clock, History,
  Loader2, Pencil, RotateCcw, Tag, Trash2, User,
} from "lucide-react"
import { useActiveOrganization, useSession } from "@/lib/auth/client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ObligationSheet } from "@/components/obligations/obligation-sheet"
import { SubTaskList } from "@/components/obligations/subtask-list"
import type { Obligation, ObligationStatus } from "@/components/obligations/types"
import type { OrgMember } from "@/lib/types"
import { cn } from "@/lib/utils"

type LoadState = "loading" | "ready" | "notFound" | "error"
type MembersLoadState = "idle" | "loading" | "ready" | "error"
interface ObligationActivity {
  id: string
  action: string
  detail?: string | null
  metadata?: {
    obligationId?: unknown
    subtaskId?: unknown
    subtaskOperation?: unknown
    changedFields?: unknown
    isCompleted?: unknown
  } | null
  createdAt: string
  user?: { name?: string | null } | null
  actorLabel?: string
}
interface ContractSummary { title?: string; activities?: ObligationActivity[] }

const STATUS_STYLE: Record<ObligationStatus, { icon: React.ElementType; className: string }> = {
  PENDING: { icon: Clock, className: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  IN_PROGRESS: { icon: Loader2, className: "bg-blue-50 text-blue-700 ring-blue-200" },
  COMPLETED: { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  OVERDUE: { icon: AlertCircle, className: "bg-rose-50 text-rose-700 ring-rose-200" },
}
const PRIORITY_STYLE = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  HIGH: "bg-rose-50 text-rose-700 ring-rose-200",
} as const
const NEXT_STATUS: Partial<Record<ObligationStatus, ObligationStatus>> = {
  PENDING: "IN_PROGRESS", IN_PROGRESS: "COMPLETED", OVERDUE: "IN_PROGRESS",
}

function detailAfterPrefix(detail: string | null | undefined, prefix: string) {
  if (!detail?.startsWith(prefix)) return null
  const remainder = detail.slice(prefix.length)
  return remainder.length > 0 ? remainder : null
}

function isOrgMember(value: unknown): value is OrgMember {
  if (!value || typeof value !== "object") return false
  const member = value as Record<string, unknown>
  if (
    typeof member.id !== "string" ||
    typeof member.userId !== "string" ||
    typeof member.organizationId !== "string" ||
    typeof member.role !== "string" ||
    typeof member.createdAt !== "string" ||
    !member.user ||
    typeof member.user !== "object"
  ) return false
  const user = member.user as Record<string, unknown>
  return typeof user.id === "string" && typeof user.name === "string" && typeof user.email === "string"
}

function MetaRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="min-w-0 flex-1"><p className="mb-1 text-xs text-muted-foreground">{label}</p><div className="text-sm text-foreground">{children}</div></div>
  </div>
}

function PageState({ title, description, contractId, retry, retryLabel, backLabel }: {
  title: string; description: string; contractId: string; retry?: () => void; retryLabel: string; backLabel: string
}) {
  return <main className="flex min-h-[70vh] items-center justify-center px-4">
    <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {retry && <Button className="min-h-11" onClick={retry}>{retryLabel}</Button>}
        <Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href={`/contracts/${contractId}?tab=obligations`}>{backLabel}</Link>
      </div>
    </div>
  </main>
}

export default function ObligationDetailPage() {
  const { id: contractId, obligationId } = useParams<{ id: string; obligationId: string }>()
  const t = useTranslations("obligationDetail")
  const locale = useLocale()
  const { data: session } = useSession()
  const { data: activeOrganization } = useActiveOrganization()
  const requestRef = useRef(0)
  const historyRequestRef = useRef(0)
  const membersRequestRef = useRef(0)
  const subTaskRevisionRef = useRef(0)
  const editSubTaskRevisionRef = useRef(0)
  const [obligation, setObligation] = useState<Obligation | null>(null)
  const [contractTitle, setContractTitle] = useState("")
  const [activities, setActivities] = useState<ObligationActivity[]>([])
  const [historyRefreshUnavailable, setHistoryRefreshUnavailable] = useState(false)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [membersLoadState, setMembersLoadState] = useState<MembersLoadState>("idle")
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [editOpen, setEditOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const role = useMemo(() => {
    const userId = session?.user?.id
    if (!userId) return "viewer"
    return activeOrganization?.members?.find((member) => member.userId === userId)?.role ?? "viewer"
  }, [activeOrganization?.members, session?.user?.id])
  const canWrite = ["owner", "admin", "legal", "member"].includes(role)
  const canDelete = ["owner", "admin", "legal"].includes(role)

  const fetchData = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoadState("loading")
    try {
      const [obligationRes, contractRes] = await Promise.all([
        fetch(`/api/contracts/${contractId}/obligations/${obligationId}`),
        fetch(`/api/contracts/${contractId}`),
      ])
      if (requestId !== requestRef.current) return
      if (obligationRes.status === 404 || contractRes.status === 404) {
        setObligation(null); setLoadState("notFound"); return
      }
      if (!obligationRes.ok || !contractRes.ok) throw new Error("request_failed")
      const [nextObligation, contract] = await Promise.all([
        obligationRes.json() as Promise<Obligation>, contractRes.json() as Promise<ContractSummary>,
      ])
      if (requestId !== requestRef.current) return
      setObligation(nextObligation)
      setContractTitle(contract.title ?? "")
      historyRequestRef.current += 1
      setActivities((contract.activities ?? []).filter((entry) => entry.metadata?.obligationId === obligationId))
      setHistoryRefreshUnavailable(false)
      setLoadState("ready")
    } catch {
      if (requestId !== requestRef.current) return
      setObligation(null); setLoadState("error")
    }
  }, [contractId, obligationId])

  const refreshHistory = useCallback(async () => {
    const requestId = ++historyRequestRef.current
    try {
      const response = await fetch(`/api/contracts/${contractId}`)
      if (!response.ok) {
        if (requestId === historyRequestRef.current) setHistoryRefreshUnavailable(true)
        return
      }
      const contract = await response.json() as ContractSummary
      if (requestId !== historyRequestRef.current) return
      setActivities((contract.activities ?? []).filter(
        (entry) => entry.metadata?.obligationId === obligationId,
      ))
      setHistoryRefreshUnavailable(false)
    } catch {
      // Keep the last truthful bounded snapshot when refresh is unavailable.
      if (requestId === historyRequestRef.current) setHistoryRefreshUnavailable(true)
    }
  }, [contractId, obligationId])

  const fetchMembers = useCallback(async () => {
    if (!canWrite) return
    const requestId = ++membersRequestRef.current
    setMembers([])
    setMembersLoadState("loading")
    try {
      const response = await fetch("/api/org/members")
      if (!response.ok) throw new Error("request_failed")
      const data = await response.json() as { members?: unknown } | unknown[]
      const nextMembers = Array.isArray(data)
        ? data
        : data && Array.isArray(data.members)
          ? data.members
          : null
      if (!nextMembers || !nextMembers.every(isOrgMember)) throw new Error("invalid_response")
      if (requestId !== membersRequestRef.current) return
      setMembers(nextMembers)
      setMembersLoadState("ready")
    } catch {
      if (requestId !== membersRequestRef.current) return
      setMembers([])
      setMembersLoadState("error")
    }
  }, [canWrite])

  useEffect(() => { void fetchData(); return () => { requestRef.current += 1; historyRequestRef.current += 1 } }, [fetchData])
  useEffect(() => {
    if (!canWrite) {
      membersRequestRef.current += 1
      setMembers([])
      setMembersLoadState("idle")
      return
    }
    void fetchMembers()
    return () => { membersRequestRef.current += 1 }
  }, [canWrite, fetchMembers])

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "short", year: "numeric",
  }), [locale])
  const dueDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }), [locale])

  const formatActivityDetail = useCallback((activity: ObligationActivity) => {
    const metadata = activity.metadata
    if (activity.action === "OBLIGATION_UPDATED" && typeof metadata?.subtaskId === "string") {
      const operation = metadata.subtaskOperation
      if (operation === "created") {
        const detail = detailAfterPrefix(activity.detail, "Sub-task created: ")
        if (detail) return t("historySubtaskCreated", { detail })
      }
      if (operation === "deleted") {
        const detail = detailAfterPrefix(activity.detail, "Sub-task deleted: ")
        if (detail) return t("historySubtaskDeleted", { detail })
      }
      if (operation === "updated" && Array.isArray(metadata.changedFields)) {
        const changedFields = metadata.changedFields.filter(
          (field): field is string => typeof field === "string",
        )
        if (changedFields.length === metadata.changedFields.length && changedFields.length > 0) {
          const detail = detailAfterPrefix(activity.detail, "Sub-task updated: ")
          const suffix = ` (${changedFields.join(", ")})`
          if (detail?.endsWith(suffix)) {
            const title = detail.slice(0, -suffix.length)
            if (title) {
              if (changedFields.length === 1 && changedFields[0] === "isCompleted" && typeof metadata.isCompleted === "boolean") {
                return t(metadata.isCompleted ? "historySubtaskCompleted" : "historySubtaskReopened", { detail: title })
              }
              return t("historySubtaskUpdated", { detail })
            }
          }
        }
      }
      return activity.detail || activity.action
    }

    const obligationKeys = {
      OBLIGATION_CREATED: ["Obligation created: ", "historyObligationCreated"],
      OBLIGATION_UPDATED: ["Obligation updated: ", "historyObligationUpdated"],
      OBLIGATION_COMPLETED: ["Obligation completed: ", "historyObligationCompleted"],
      OBLIGATION_DELETED: ["Obligation deleted: ", "historyObligationDeleted"],
    } as const
    const known = obligationKeys[activity.action as keyof typeof obligationKeys]
    if (known && typeof metadata?.obligationId === "string") {
      const detail = detailAfterPrefix(activity.detail, known[0])
      if (detail) return t(known[1], { detail })
    }
    return activity.detail || activity.action
  }, [t])

  function applyAggregateUpdate(updated: Obligation, subTaskRevisionAtRequest: number) {
    setObligation((current) => {
      if (!current || subTaskRevisionRef.current === subTaskRevisionAtRequest) return updated
      return { ...updated, subTasks: current.subTasks }
    })
  }

  async function updateStatus(status: ObligationStatus) {
    if (!obligation || updatingStatus) return
    const subTaskRevisionAtRequest = subTaskRevisionRef.current
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/obligations/${obligationId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      applyAggregateUpdate(await res.json(), subTaskRevisionAtRequest); toast.success(t("statusUpdated")); void refreshHistory()
    } catch { toast.error(t("statusUpdateError")) } finally { setUpdatingStatus(false) }
  }
  async function deleteObligation() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/obligations/${obligationId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(t("deleteSuccess")); window.location.assign(`/contracts/${contractId}?tab=obligations`)
    } catch { toast.error(t("deleteError")); setDeleting(false); setConfirmingDelete(false) }
  }

  if (loadState === "loading") return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8" aria-busy="true">
    <div className="flex items-center gap-4 border-b border-border pb-6"><Skeleton className="h-11 w-11 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-64 max-w-full" /><Skeleton className="h-4 w-40" /></div></div>
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-5"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div><Skeleton className="h-80 rounded-xl" /></div>
  </main>
  if (loadState === "notFound") return <PageState title={t("notFoundTitle")} description={t("notFoundDescription")} contractId={contractId} retryLabel={t("retry")} backLabel={t("backToContract")} />
  if (loadState === "error" || !obligation) return <PageState title={t("unavailableTitle")} description={t("unavailableDescription")} contractId={contractId} retry={fetchData} retryLabel={t("retry")} backLabel={t("backToContract")} />

  const statusStyle = STATUS_STYLE[obligation.status]
  const StatusIcon = statusStyle.icon
  const nextStatus = NEXT_STATUS[obligation.status]
  const isCompleted = obligation.status === "COMPLETED"
  const completedTasks = obligation.subTasks.filter((task) => task.isCompleted).length
  const taskCount = obligation.subTasks.length
  const progress = taskCount === 0 ? 0 : Math.round((completedTasks / taskCount) * 100)

  return <main className="min-h-full bg-background">
    <header className="border-b border-border bg-background/95"><div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <Link href={`/contracts/${contractId}?tab=obligations`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />{t("backToContract")}</Link>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0"><p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{contractTitle}</p><h1 className="mt-1 break-words text-balance text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">{obligation.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t("statusLabel")}>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1", statusStyle.className)}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />{t(`status.${obligation.status}`)}</span>
            <span className={cn("inline-flex rounded-full px-3 py-1.5 text-xs font-medium ring-1", PRIORITY_STYLE[obligation.priority])}>{t(`priority.${obligation.priority}`)}</span>
          </div>
        </div>
        {canWrite && <div className="min-w-0">
          <div className="flex flex-wrap gap-2" aria-label={t("actionsLabel")}>
          {nextStatus && <Button className="min-h-11 gap-2" disabled={updatingStatus} onClick={() => updateStatus(nextStatus)}>{updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{nextStatus === "COMPLETED" ? t("complete") : t("start")}</Button>}
          {isCompleted && <Button variant="outline" className="min-h-11 gap-2" disabled={updatingStatus} onClick={() => updateStatus("PENDING")}><RotateCcw className="h-4 w-4" />{t("reopen")}</Button>}
          <Button variant="outline" className="min-h-11 gap-2" disabled={membersLoadState !== "ready"} aria-describedby={membersLoadState !== "ready" ? "obligation-members-status" : undefined} onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />{t("edit")}</Button>
          {canDelete && <AlertDialog open={confirmingDelete} onOpenChange={(open) => { if (!deleting) setConfirmingDelete(open) }}>
            <AlertDialogTrigger render={<Button variant="ghost" className="min-h-11 gap-2 text-destructive hover:text-destructive" />}>
              <Trash2 className="h-4 w-4" />{t("delete")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel autoFocus disabled={deleting} className="min-h-11">{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction disabled={deleting} className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { void deleteObligation() }}>
                  {deleting ? t("deleting") : t("confirmDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
          </div>
          {membersLoadState === "loading" && <p id="obligation-members-status" className="mt-2 text-xs text-muted-foreground" role="status">{t("membersLoading")}</p>}
          {membersLoadState === "error" && <div id="obligation-members-status" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-700" role="alert"><span>{t("membersUnavailable")}</span><Button type="button" variant="link" className="h-auto min-h-11 px-0 text-xs" onClick={() => { void fetchMembers() }}>{t("retryMembers")}</Button></div>}
        </div>}
      </div>
    </div></header>

    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {!canWrite && <div className="mb-6 rounded-xl border border-border bg-muted/40 px-4 py-3" role="status"><p className="text-sm font-medium text-foreground">{t("readOnly")}</p><p className="mt-0.5 text-sm text-muted-foreground">{t("readOnlyDescription")}</p></div>}
      <div data-testid="obligation-detail-layout" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <section className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="obligation-description-heading"><h2 id="obligation-description-heading" className="text-sm font-semibold text-foreground">{t("description")}</h2><p className={cn("mt-3 break-words whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]", obligation.description ? "text-foreground" : "text-muted-foreground")}>{obligation.description || t("noDescription")}</p></section>
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="obligation-tasks-heading">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="obligation-tasks-heading" className="text-sm font-semibold text-foreground">{t("tasks")}</h2><span className="text-xs text-muted-foreground">{t("taskProgress", { done: completedTasks, total: taskCount })}</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={t("taskProgress", { done: completedTasks, total: taskCount })} aria-label={t("taskProgress", { done: completedTasks, total: taskCount })}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
            <SubTaskList contractId={contractId} obligation={obligation} canWrite={canWrite} onChange={(subTasks) => { subTaskRevisionRef.current += 1; setObligation((current) => current ? { ...current, subTasks } : current) }} onMutationComplete={() => { void refreshHistory() }} />
          </section>
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="obligation-history-heading">
            <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><h2 id="obligation-history-heading" className="text-sm font-semibold text-foreground">{t("history")}</h2></div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("historyScope")}</p>
            {historyRefreshUnavailable && <p className="mt-2 text-xs leading-5 text-amber-700" role="status">{t("historyRefreshUnavailable")}</p>}
            {activities.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t("historyNone")}</p> : <ol className="mt-4 divide-y divide-border">{activities.map((activity) => <li key={activity.id} className="min-w-0 py-3 first:pt-0 last:pb-0"><p className="break-words text-sm text-foreground [overflow-wrap:anywhere]">{formatActivityDetail(activity)}</p><p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{activity.user?.name ?? activity.actorLabel ?? t("systemActor")} · {dateFormatter.format(new Date(activity.createdAt))}</p></li>)}</ol>}
          </section>
        </div>
        <aside className="self-start rounded-xl border border-border bg-card p-5 xl:sticky xl:top-6" aria-labelledby="obligation-details-heading"><h2 id="obligation-details-heading" className="text-sm font-semibold text-foreground">{t("details")}</h2><div className="mt-2">
          <MetaRow icon={CalendarDays} label={t("dueDate")}><span className={cn(obligation.status === "OVERDUE" && "font-medium text-rose-700")}>{dueDateFormatter.format(new Date(obligation.dueDate))}</span></MetaRow>
          <MetaRow icon={StatusIcon} label={t("statusLabel")}><span>{t(`status.${obligation.status}`)}</span></MetaRow>
          <MetaRow icon={Tag} label={t("priorityLabel")}><span>{t(`priority.${obligation.priority}`)}</span></MetaRow>
          <MetaRow icon={User} label={t("assignee")}><span>{obligation.assignee?.name ?? t("unassigned")}</span></MetaRow>
          <MetaRow icon={Tag} label={t("clauseReference")}><span className={cn("break-words [overflow-wrap:anywhere]", !obligation.clauseReference && "text-muted-foreground")}>{obligation.clauseReference || t("sourceUnavailable")}</span></MetaRow>
          <MetaRow icon={Bell} label={t("reminder")}><span>{t(obligation.reminderDays === 1 ? "reminderDaysBeforeOne" : "reminderDaysBeforeMany", { count: obligation.reminderDays })}</span></MetaRow>
          <MetaRow icon={User} label={t("createdBy")}><span>{obligation.createdBy.name}</span><p className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(obligation.createdAt))}</p></MetaRow>
          {isCompleted && obligation.completedBy && <MetaRow icon={CheckCircle2} label={t("completedBy")}><span>{obligation.completedBy.name}</span>{obligation.completedAt && <p className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(obligation.completedAt))}</p>}</MetaRow>}
        </div></aside>
      </div>
    </div>
    <ObligationSheet open={editOpen} onOpenChange={setEditOpen} contractId={contractId} obligation={obligation} members={members} onSaveStart={() => { editSubTaskRevisionRef.current = subTaskRevisionRef.current }} onSaved={(updated) => { applyAggregateUpdate(updated, editSubTaskRevisionRef.current); setEditOpen(false); void refreshHistory() }} />
  </main>
}
