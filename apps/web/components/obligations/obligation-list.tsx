"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { differenceInCalendarDays } from "date-fns"
import { Check, CheckSquare, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { ObligationSheet } from "./obligation-sheet"
import { SubTaskList } from "./subtask-list"
import type { Obligation, ObligationStatus } from "./types"
import type { OrgMember } from "@/lib/types"

interface AISuggestion {
  id?: string
  title: string
  description?: string
  clauseReference?: string
  sourceText?: string | null
  sourcePage?: number | null
  priority: "HIGH" | "MEDIUM" | "LOW"
  suggestedDueDays: number | null
  confidence: number
}

interface Props {
  contractId: string
  obligations: Obligation[]
  members: OrgMember[]
  contractArchived: boolean
  role: string | undefined
  hasContractFile: boolean
  hasExtractedText: boolean
  onChange: (next: Obligation[]) => void
}

const STATUS_BADGE: Record<ObligationStatus, string> = {
  PENDING: "bg-muted text-muted-foreground ring-1 ring-border",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800",
  OVERDUE: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
}

const PRIORITY_DOT: Record<Obligation["priority"], string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-sky-500",
}

function isDueDateUrgent(dueDate: string, status: ObligationStatus): boolean {
  if (status === "OVERDUE") return true
  if (status === "COMPLETED") return false
  const days = differenceInCalendarDays(new Date(dueDate), new Date())
  return days <= 3
}

function formatActionDate(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date)
}

export function ObligationList({
  contractId,
  obligations,
  members,
  contractArchived,
  role,
  hasContractFile,
  hasExtractedText,
  onChange,
}: Props) {
  const t = useTranslations("obligations")
  const locale = useLocale()
  const STATUS_FILTERS: ReadonlyArray<{ key: "ALL" | ObligationStatus; label: string }> = [
    { key: "ALL",         label: t("filterAll") },
    { key: "PENDING",     label: t("status.PENDING") },
    { key: "IN_PROGRESS", label: t("status.IN_PROGRESS") },
    { key: "OVERDUE",     label: t("status.OVERDUE") },
    { key: "COMPLETED",   label: t("status.COMPLETED") },
  ]

  const [filter, setFilter] = useState<"ALL" | ObligationStatus>("ALL")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Obligation | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  const [reviewingIdx, setReviewingIdx] = useState<number | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Obligation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const extractionRequestRef = useRef(false)
  const autoExtractionAttemptedRef = useRef(false)
  const [jobId, setJobId] = useState<string | null>(() => {
    // Hydrate from localStorage on mount — survives navigation
    if (typeof window === "undefined") return null
    return localStorage.getItem(`obligation_extract_job_${contractId}`)
  })

  const canWrite = role === "owner" || role === "admin" || role === "legal" || role === "member"
  const canDelete = role === "owner" || role === "admin" || role === "legal"
  const canCreate = canWrite && !contractArchived

  const visible = useMemo(() => {
    if (filter === "ALL") return obligations
    return obligations.filter((o) => o.status === filter)
  }, [obligations, filter])

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  useEffect(() => {
    if (!jobId) return
    setExtracting(true)

    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/contracts/${contractId}/obligations/extract?jobId=${encodeURIComponent(jobId)}`
        )
        if (!res.ok || cancelled) return

        const data = await res.json()

        if (data.state === "completed") {
          if (!cancelled) {
            const s = data.suggestions ?? []
            if (s.length === 0) {
              toast.info(t("noAiSuggestionsFound"))
            } else {
              setSuggestions(s)
            }
            setExtracting(false)
            extractionRequestRef.current = false
            localStorage.removeItem(`obligation_extract_job_${contractId}`)
            setJobId(null)
          }
        } else if (data.state === "failed" || data.state === "not_found") {
          if (!cancelled) {
            toast.error(t("extractionFailed"))
            setExtracting(false)
            extractionRequestRef.current = false
            localStorage.removeItem(`obligation_extract_job_${contractId}`)
            setJobId(null)
          }
        }
        // "active" → keep polling
      } catch {
        if (!cancelled) {
          toast.error(t("extractionStatusFailed"))
          setExtracting(false)
          extractionRequestRef.current = false
          localStorage.removeItem(`obligation_extract_job_${contractId}`)
          setJobId(null)
        }
      }
    }

    // Poll immediately, then every 3 seconds
    poll()
    const interval = setInterval(poll, 3_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId, contractId, t])

  async function extractWithAI() {
    // State updates are asynchronous. Keep a synchronous guard as well so a
    // double click cannot enqueue two extraction jobs before `extracting`
    // reaches the button.
    if (extractionRequestRef.current) return
    if (!hasContractFile) {
      toast.error(t("uploadSourceFirst"))
      return
    }
    extractionRequestRef.current = true
    setExtracting(true)
    setSuggestions([])
    setDismissedIds(new Set())
    try {
      const res = await fetch(`/api/contracts/${contractId}/obligations/extract`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (res.status === 202 || body.error === "text_processing") {
        toast.info(t("documentPreparationInProgress"))
        // The upload worker owns text extraction. Keep the user in one flow
        // instead of requiring a second click while that job is active.
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2_000))
          const contractRes = await fetch(`/api/contracts/${contractId}`)
          if (!contractRes.ok) continue
          const contractData = await contractRes.json().catch(() => ({})) as {
            contract?: { hasExtractedText?: boolean }
            hasExtractedText?: boolean
          }
          const ready = contractData.contract?.hasExtractedText === true || contractData.hasExtractedText === true
          if (ready) {
            extractionRequestRef.current = false
            await extractWithAI()
            return
          }
        }
        toast.info(t("documentPreparationDelayed"))
        setExtracting(false)
        extractionRequestRef.current = false
        return
      }
      if (res.status === 422) {
        if (body.error === "no_extracted_text") {
          toast.error(t("uploadSourceFirst"))
        } else if (body.error === "text_processing") {
          toast.info(t("documentPreparationInProgress"))
        } else if (body.error === "no_ai_provider") {
          toast.error(t("aiNotConfigured"))
        } else {
          toast.error(t("extractionFailed"))
        }
        setExtracting(false)
        extractionRequestRef.current = false
        return
      }
      if (!res.ok) throw new Error()
      const { jobId: id } = body
      if (!id) throw new Error()
      localStorage.setItem(`obligation_extract_job_${contractId}`, id)
      setJobId(id)
      // polling effect takes it from here
    } catch {
      toast.error(t("extractionFailed"))
      setExtracting(false)
      extractionRequestRef.current = false
    }
  }

  // Once the uploaded file has been converted to text, proactively prepare
  // obligation suggestions. Suggestions remain review-only: nothing is
  // written to the obligation ledger until the user reviews and saves one.
  useEffect(() => {
    if (
      autoExtractionAttemptedRef.current ||
      !hasExtractedText ||
      !hasContractFile ||
      obligations.length > 0 ||
      jobId
    ) {
      return
    }
    autoExtractionAttemptedRef.current = true
    void extractWithAI()
  }, [hasExtractedText, hasContractFile, obligations.length, jobId])

  function openEdit(ob: Obligation) {
    setEditing(ob)
    setSheetOpen(true)
  }

  function applyChange(updated: Obligation) {
    onChange(
      obligations.some((o) => o.id === updated.id)
        ? obligations.map((o) => (o.id === updated.id ? updated : o))
        : [...obligations, updated],
    )
  }

  const reviewInitialValues = useMemo(() => {
    if (reviewingIdx === null || !suggestions[reviewingIdx]) return undefined
    const suggestion = suggestions[reviewingIdx]
    const suggestedDueDays = suggestion.suggestedDueDays
    const dueDate = suggestedDueDays === null ? null : new Date()
    if (dueDate && suggestedDueDays !== null) dueDate.setDate(dueDate.getDate() + Math.max(suggestedDueDays, 1))
    return {
      title: suggestion.title,
      description: suggestion.description ?? "",
      clauseReference: suggestion.clauseReference ?? "",
      priority: suggestion.priority,
      // An inferred date is never silently invented. The reviewer must choose
      // one when the contract does not provide a usable deadline.
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : "",
      reminderDays: 7,
    }
  }, [reviewingIdx, suggestions])

  async function complete(ob: Obligation) {
    try {
      const res = await fetch(`/api/contracts/${contractId}/obligations/${ob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      })
      if (!res.ok) throw new Error()
      const next = await res.json()
      applyChange(next)
      toast.success(t("obligationCompleted"))
    } catch {
      toast.error(t("markCompleteFailed"))
    }
  }

  async function remove(ob: Obligation) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/obligations/${ob.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      onChange(obligations.filter((o) => o.id !== ob.id))
      toast.success(t("deleteSuccess"))
      setDeleteCandidate(null)
    } catch {
      toast.error(t("deleteError"))
    } finally {
      setDeleting(false)
    }
  }

  if (obligations.length === 0 && suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
          <CheckSquare className="size-10 text-muted-foreground/40" />
          <div className="text-center">
          <p className="text-sm font-medium text-foreground">{t("actionQueueEmptyTitle")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("actionQueueEmptyDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button size="sm" variant="outline" onClick={extractWithAI} disabled={extracting || !hasContractFile}>
              {extracting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {extracting ? t("extracting") : !hasContractFile ? t("uploadSourceFirst") : !hasExtractedText ? t("prepareDocument") : t("extractWithAi")}
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={openCreate} className="min-h-11">
              <Plus className="size-4" />
              {t("addObligation")}
            </Button>
          )}
        </div>

        {extracting && (
          <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-muted/40 p-4 space-y-3 animate-pulse">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[var(--radius)] border border-border bg-card p-3 flex items-start gap-3">
                  <div className="mt-1.5 size-2 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted/60" />
                  </div>
                  <div className="h-7 w-16 rounded bg-muted shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        <ObligationSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          contractId={contractId}
          members={members}
          obligation={editing}
          onSaved={applyChange}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button
              size="sm"
              variant="outline"
              onClick={extractWithAI}
              disabled={extracting || !hasContractFile}
            >
              {extracting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {extracting ? t("extracting") : !hasContractFile ? t("uploadSourceFirst") : !hasExtractedText ? t("prepareDocument") : t("extractWithAi")}
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={openCreate} className="min-h-11">
              <Plus className="size-4" />
              {t("addObligation")}
            </Button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {extracting && (
        <div className="rounded-[var(--radius)] border border-border bg-muted/40 p-4 space-y-3 animate-pulse">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[var(--radius)] border border-border bg-card p-3 flex items-start gap-3">
                <div className="mt-1.5 size-2 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted/60" />
                  <div className="h-3 w-1/2 rounded bg-muted/60" />
                </div>
                <div className="h-7 w-16 rounded bg-muted shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Suggestions Panel */}
      {suggestions.length > 0 && (
        <div className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {t("aiSuggestionsRequireReview", { count: suggestions.length })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSuggestions([])
                  localStorage.removeItem(`obligation_extract_job_${contractId}`)
                  setJobId(null)
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t("dismissAllSuggestions")}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, idx) => {
              const dismissed = dismissedIds.has(idx)
              if (dismissed) return null
              const suggestedDueDays = s.suggestedDueDays
              const dueDate = suggestedDueDays === null ? null : new Date()
              if (dueDate && suggestedDueDays !== null) dueDate.setDate(dueDate.getDate() + Math.max(suggestedDueDays, 1))
              return (
                <div key={idx} className="rounded-[var(--radius)] border border-border bg-card p-3 flex items-start gap-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[s.priority])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                    {s.sourceText && (
                      <p className="mt-1 line-clamp-2 border-s-2 border-primary/30 ps-2 text-[11px] italic text-muted-foreground">
                        “{s.sourceText}”{s.sourcePage ? ` · p. ${s.sourcePage}` : ""}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {s.clauseReference && <span>{s.clauseReference}</span>}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-medium text-[10px]",
                          s.confidence >= 0.8
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : s.confidence >= 0.5
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                      {t("confidence", { value: Math.round(s.confidence * 100) })}
                    </span>
                      <span>{dueDate ? t("suggestedDueOn", { date: formatActionDate(dueDate.toISOString(), locale) }) : t("dateNeedsReview")}</span>
                      <span>{t(`priority.${s.priority}`)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={reviewingIdx !== null}
                      onClick={() => {
                        setReviewingIdx(idx)
                        setEditing(null)
                        setSheetOpen(true)
                      }}
                    >
                      {reviewingIdx === idx ? <Loader2 className="size-3 animate-spin" /> : t("reviewSuggestion")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedIds((prev) => new Set(prev).add(idx))
                        toast("Suggestion dismissed", {
                          action: {
                            label: t("undo"),
                            onClick: () =>
                              setDismissedIds((prev) => {
                                const next = new Set(prev)
                                next.delete(idx)
                                return next
                              }),
                          },
                          duration: 5000,
                        })
                      }}
                      className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t("dismissSuggestion")}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          {t("noObligationsFilter")}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((ob) => {
            const subTotal = ob.subTasks.length
            const subDone = ob.subTasks.filter((s) => s.isCompleted).length
            const dueUrgent = isDueDateUrgent(ob.dueDate, ob.status)
            return (
              <div
                key={ob.id}
                className="rounded-[var(--radius)] border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[ob.priority])}
                    title={t(`priority.${ob.priority}`)}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/contracts/${contractId}/obligations/${ob.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        {ob.title}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_BADGE[ob.status],
                        )}
                      >
                        {t(`status.${ob.status}`)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "font-medium",
                          dueUrgent ? "text-destructive" : "text-foreground/70",
                        )}
                      >
                        {t("dueOn", { date: formatActionDate(ob.dueDate, locale) })}
                      </span>
                      {ob.assignee && (
                        <span className="inline-flex items-center gap-1">
                          <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                            {ob.assignee.name.charAt(0).toUpperCase()}
                          </span>
                          {ob.assignee.name}
                        </span>
                      )}
                      {ob.clauseReference && (
                        <span className="text-muted-foreground/60">{ob.clauseReference}</span>
                      )}
                    </div>

                    {ob.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {ob.description}
                      </p>
                    )}

                    {subTotal > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {t("subtaskProgress", { completed: subDone, total: subTotal })}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-[width]"
                            style={{
                              width: `${Math.round((subDone / subTotal) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <SubTaskList
                      contractId={contractId}
                      obligation={ob}
                      canWrite={canWrite && !contractArchived}
                      onChange={(subTasks) =>
                        applyChange({ ...ob, subTasks })
                      }
                    />
                  </div>

                  {canWrite && !contractArchived && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(ob)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        aria-label={t("editObligation")}
                      >
                        <Pencil className="size-4" />
                      </button>
                      {ob.status !== "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() => complete(ob)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition-colors"
                          aria-label={t("markComplete")}
                        >
                          <Check className="size-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(ob)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label={t("deleteObligation")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ObligationSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setReviewingIdx(null)
        }}
        contractId={contractId}
        members={members}
        obligation={editing}
        suggestionId={reviewingIdx !== null ? suggestions[reviewingIdx]?.id : undefined}
        initialValues={reviewInitialValues}
        onSaved={(saved) => {
          applyChange(saved)
          if (reviewingIdx !== null) {
            setDismissedIds((prev) => new Set(prev).add(reviewingIdx))
            setReviewingIdx(null)
          }
        }}
      />
      <AlertDialog open={deleteCandidate !== null} onOpenChange={(open) => !open && !deleting && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate ? t("deleteConfirm", { title: deleteCandidate.title }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !deleteCandidate}
              onClick={() => deleteCandidate && remove(deleteCandidate)}
            >
              {deleting ? t("deleting") : t("confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
