"use client"

import { useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Obligation, ObligationPriority } from "./types"
import type { OrgMember } from "@/lib/types"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

// ─── Constants ────────────────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  1,
  3,
  7,
  14,
  30,
] as const

const UNASSIGNED = "__none__"

const PRIORITY_STYLE: Record<ObligationPriority, { dot: string; pill: string }> = {
  LOW: {
    dot:  "bg-emerald-500",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 data-[active=true]:bg-emerald-100 data-[active=true]:border-emerald-400 data-[active=true]:shadow-sm",
  },
  MEDIUM: {
    dot:  "bg-amber-500",
    pill: "border-amber-200 bg-amber-50 text-amber-700 data-[active=true]:bg-amber-100 data-[active=true]:border-amber-400 data-[active=true]:shadow-sm",
  },
  HIGH: {
    dot:  "bg-rose-500",
    pill: "border-rose-200 bg-rose-50 text-rose-700 data-[active=true]:bg-rose-100 data-[active=true]:border-rose-400 data-[active=true]:shadow-sm",
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  dueDate: string
  priority: ObligationPriority
  assigneeId: string
  clauseReference: string
  reminderDays: number
  evidenceRequired: "completion_note" | "external_link"
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  assigneeId: UNASSIGNED,
  clauseReference: "",
  reminderDays: 7,
  evidenceRequired: "completion_note",
}

function obligationToForm(o: Obligation): FormState {
  return {
    title: o.title,
    description: o.description ?? "",
    dueDate: o.dueDate.slice(0, 10),
    priority: o.priority,
    assigneeId: o.assignee?.id ?? UNASSIGNED,
    clauseReference: o.clauseReference ?? "",
    reminderDays: o.reminderDays,
    evidenceRequired: "completion_note",
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  htmlFor,
}: {
  label: string
  required?: boolean
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {label}
      {required && <span className="ms-0.5 text-rose-400" aria-hidden="true">*</span>}
    </label>
  )
}

// ─── Assignee Picker ──────────────────────────────────────────────────────────

function AssigneePicker({
  value,
  members,
  onChange,
}: {
  value: string
  members: OrgMember[]
  onChange: (id: string) => void
}) {
  const t = useTranslations("obligationDetail")
  return <select
    id="obligation-assignee"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
  >
    <option value={UNASSIGNED}>{t("unassigned")}</option>
    {members.map((member) => <option key={member.userId} value={member.userId}>
      {member.user.name ?? member.user.email}{member.user.name ? ` — ${member.user.email}` : ""}
    </option>)}
  </select>
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  obligation: Obligation | null
  suggestionId?: string
  members: OrgMember[]
  onSaveStart?: () => void
  onSaved: (obligation: Obligation) => void
  initialValues?: Partial<FormState>
}

export function ObligationSheet({
  open,
  onOpenChange,
  contractId,
  obligation,
  suggestionId,
  members,
  onSaveStart,
  onSaved,
  initialValues,
}: Props) {
  const t = useTranslations("obligationDetail")
  const locale = useLocale()
  const PRIORITY_OPTIONS: { value: ObligationPriority; label: string; dot: string; pill: string }[] = [
    { value: "LOW",    label: t("priority.LOW"),    ...PRIORITY_STYLE.LOW },
    { value: "MEDIUM", label: t("priority.MEDIUM"), ...PRIORITY_STYLE.MEDIUM },
    { value: "HIGH",   label: t("priority.HIGH"),   ...PRIORITY_STYLE.HIGH },
  ]

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const saveRequestRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setForm(obligation ? obligationToForm(obligation) : { ...EMPTY_FORM, ...initialValues })
  }, [open, obligation, initialValues])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function save() {
    // Guard the request synchronously as well as through the button state.
    // React state updates are asynchronous, so two rapid clicks must not
    // create duplicate obligations.
    if (saveRequestRef.current) return
    if (!form.title.trim()) {
      toast.error(t("titleRequired"))
      return
    }
    if (!form.dueDate) {
      toast.error(t("dueDateRequired"))
      return
    }

    saveRequestRef.current = true
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        clauseReference: form.clauseReference.trim() || undefined,
        priority: form.priority,
        dueDate: new Date(`${form.dueDate}T00:00:00.000Z`).toISOString(),
        reminderDays: form.reminderDays,
        assigneeId: form.assigneeId === UNASSIGNED ? undefined : form.assigneeId,
        suggestionId,
        evidenceRequired: form.evidenceRequired,
      }

      const url = obligation
        ? `/api/contracts/${contractId}/obligations/${obligation.id}`
        : `/api/contracts/${contractId}/obligations`
      const method = obligation ? "PATCH" : "POST"

      if (obligation && form.assigneeId === UNASSIGNED) body.assigneeId = null

      onSaveStart?.()
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err?.error === "obligation_limit_reached") {
          toast.error(t("obligationLimitError"))
        } else if (err?.error === "contract_archived") {
          toast.error(t("archivedContractError"))
        } else if (err?.error === "invalid_assignee") {
          toast.error(t("invalidAssigneeError"))
        } else {
          toast.error(t(obligation ? "updateError" : "createError"))
        }
        return
      }

      const saved = await res.json()
      onSaved(saved)
      toast.success(t(obligation ? "updateSuccess" : "createSuccess"))
      onOpenChange(false)
    } catch {
      toast.error(t(obligation ? "updateError" : "createError"))
    } finally {
      saveRequestRef.current = false
      setSaving(false)
    }
  }

  const isEditing = obligation !== null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false} className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("recordEyebrow")}
            </p>
            <SheetTitle className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {t(isEditing ? "editTitle" : "newTitle")}
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm leading-6 text-muted-foreground">
              {isEditing
                ? t("editSubtitle")
                : t("newSubtitle")}
            </SheetDescription>
          </div>
          <button
            type="button"
            className="ms-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onOpenChange(false)}
            aria-label={t("closeEditor")}
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form aria-label={t(isEditing ? "editTitle" : "newTitle")} aria-busy={saving} className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void save() }}>
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-7">
            <section aria-labelledby="obligation-core-details" className="space-y-5">
              <h3 id="obligation-core-details" className="text-sm font-semibold text-foreground">{t("coreDetails")}</h3>
              <div className="space-y-2"><FieldLabel label={t("titleField")} htmlFor="obligation-title" required /><Input id="obligation-title" aria-label={t("titleField")} required value={form.title} maxLength={300} onChange={(event) => update("title", event.target.value)} placeholder={t("titlePlaceholder")} className="min-h-11 text-sm" /></div>
              <div className="space-y-2"><FieldLabel label={t("description")} htmlFor="obligation-description" /><Textarea id="obligation-description" rows={4} value={form.description} maxLength={2000} onChange={(event) => update("description", event.target.value)} placeholder={t("descriptionPlaceholder")} className="min-h-28 resize-y text-sm" /></div>
              <div className="space-y-2"><FieldLabel label={t("priorityLabel")} /><div className="flex gap-2" role="radiogroup" aria-label={t("priorityLabel")}>{PRIORITY_OPTIONS.map((opt) => <label key={opt.value} data-active={form.priority === opt.value} className={cn("flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-semibold transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30 has-[:focus-visible]:ring-offset-1", opt.pill)}><input type="radio" name="obligation-priority" value={opt.value} checked={form.priority === opt.value} onChange={() => update("priority", opt.value)} className="sr-only" /><span className={cn("h-1.5 w-1.5 rounded-full", opt.dot)} />{opt.label}</label>)}</div></div>
            </section>
            <section aria-labelledby="obligation-planning" className="space-y-5 border-t border-border pt-6">
              <h3 id="obligation-planning" className="text-sm font-semibold text-foreground">{t("planningAndOwnership")}</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><div className="space-y-2"><FieldLabel label={t("dueDate")} htmlFor="obligation-due-date" required /><Input id="obligation-due-date" aria-label={t("dueDate")} type="date" required value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} className="min-h-11 text-sm" /></div><div className="space-y-2"><FieldLabel label={t("reminder")} /><div className="flex gap-1.5" role="radiogroup" aria-label={t("reminder")}>{REMINDER_OPTIONS.map((days) => <label key={days} className={cn("flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border py-2 text-xs font-medium transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30 has-[:focus-visible]:ring-offset-1", form.reminderDays === days ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-input bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground")}><input type="radio" name="obligation-reminder" value={days} checked={form.reminderDays === days} onChange={() => update("reminderDays", days)} className="sr-only" />{t(days === 1 ? "reminderOptionOne" : "reminderOptionMany", { count: days })}</label>)}</div>{obligation?.reminderSentAt && <p className="mt-1.5 text-xs text-muted-foreground">{t("reminderSent")} {new Date(obligation.reminderSentAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}</p>}</div></div>
              <div className="space-y-2"><FieldLabel label={t("assignee")} htmlFor="obligation-assignee" /><AssigneePicker value={form.assigneeId} members={members} onChange={(id) => update("assigneeId", id)} /></div>
            </section>
            <section aria-labelledby="obligation-source" className="space-y-5 border-t border-border pt-6">
              <h3 id="obligation-source" className="text-sm font-semibold text-foreground">{t("sourceContext")}</h3>
              <div className="space-y-2"><FieldLabel label={t("clauseReference")} htmlFor="obligation-clause-reference" /><Input id="obligation-clause-reference" value={form.clauseReference} maxLength={200} onChange={(event) => update("clauseReference", event.target.value)} placeholder={t("clauseReferencePlaceholder")} className="min-h-11 text-sm" /></div>
              {!isEditing && isActionLedgerUiEnabled() && <div className="space-y-2"><FieldLabel label={t("evidenceRequirement")} htmlFor="obligation-evidence-requirement" required /><select id="obligation-evidence-requirement" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.evidenceRequired} onChange={(event) => update("evidenceRequired", event.target.value as FormState["evidenceRequired"])}><option value="completion_note">{t("completionNoteEvidence")}</option><option value="external_link">{t("externalLinkEvidence")}</option></select><p className="text-xs text-muted-foreground">{t("evidenceRequirementHelp")}</p></div>}
            </section>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
            {saving ? <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground sm:me-auto"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{t("saving")}</p> : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 sm:min-w-[96px]">{t("cancel")}</Button>
            <Button type="submit" disabled={saving} className="min-h-11 sm:min-w-[144px]">{saving ? t("saving") : isEditing ? t("saveChanges") : t("createObligation")}</Button>
          </footer>
        </form>

      </SheetContent>
    </Sheet>
  )
}
