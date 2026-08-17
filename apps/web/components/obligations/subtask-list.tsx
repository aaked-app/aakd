"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Obligation, ObligationSubTask } from "./types"

interface Props {
  contractId: string
  obligation: Obligation
  canWrite: boolean
  onChange: (next: ObligationSubTask[]) => void
  onMutationComplete?: () => void
}

export function SubTaskList({
  contractId,
  obligation,
  canWrite,
  onChange,
  onMutationComplete,
}: Props) {
  const t = useTranslations("obligationDetail")
  const [newTitle, setNewTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState("")
  const tasksRef = useRef(obligation.subTasks)
  const pendingRef = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    tasksRef.current = obligation.subTasks
  }, [obligation.subTasks])

  function setPending(id: string, pending: boolean) {
    if (pending) pendingRef.current.add(id)
    else pendingRef.current.delete(id)
    setPendingIds(new Set(pendingRef.current))
  }

  async function toggle(sub: ObligationSubTask) {
    if (pendingRef.current.has(sub.id)) return
    setPending(sub.id, true)
    const previous = tasksRef.current
    const optimistic = previous.map((s) =>
      s.id === sub.id ? { ...s, isCompleted: !s.isCompleted } : s,
    )
    tasksRef.current = optimistic
    onChange(optimistic)
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/obligations/${obligation.id}/subtasks/${sub.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: !sub.isCompleted }),
        },
      )
      if (!res.ok) throw new Error()
      const updated = await res.json()
      const next = tasksRef.current.map((s) => (s.id === sub.id ? updated : s))
      tasksRef.current = next
      onChange(next)
      onMutationComplete?.()
    } catch {
      toast.error(t("taskUpdateError"))
      const original = previous.find((task) => task.id === sub.id)
      const rollback = original
        ? tasksRef.current.map((task) => task.id === sub.id ? original : task)
        : tasksRef.current
      tasksRef.current = rollback
      onChange(rollback)
    } finally {
      setPending(sub.id, false)
    }
  }

  async function remove(sub: ObligationSubTask) {
    if (pendingRef.current.has(sub.id)) return
    setPending(sub.id, true)
    const previous = tasksRef.current
    const optimistic = previous.filter((s) => s.id !== sub.id)
    tasksRef.current = optimistic
    onChange(optimistic)
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/obligations/${obligation.id}/subtasks/${sub.id}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error()
      // Confirm the optimistic deletion with a fresh parent revision. Filter
      // again because an aggregate response may have restored a server-stale
      // copy while DELETE was pending.
      const confirmed = tasksRef.current.filter((task) => task.id !== sub.id)
      tasksRef.current = confirmed
      onChange(confirmed)
      onMutationComplete?.()
    } catch {
      toast.error(t("taskDeleteError"))
      const rollback = tasksRef.current.filter((task) => task.id !== sub.id)
      const previousIndex = previous.findIndex((task) => task.id === sub.id)
      rollback.splice(Math.min(Math.max(previousIndex, 0), rollback.length), 0, sub)
      tasksRef.current = rollback
      onChange(rollback)
    } finally {
      setPending(sub.id, false)
    }
  }

  async function add() {
    const title = newTitle.trim()
    if (!title || busy) return
    setAddError("")
    setBusy(true)
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/obligations/${obligation.id}/subtasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.error === "subtask_limit_reached") {
          const message = t("taskLimitError")
          setAddError(message)
          toast.error(message)
        } else {
          const message = t("taskAddError")
          setAddError(message)
          toast.error(message)
        }
        return
      }
      const created = await res.json()
      const next = [...tasksRef.current, created]
      tasksRef.current = next
      onChange(next)
      setNewTitle("")
      onMutationComplete?.()
    } catch {
      const message = t("taskAddError")
      setAddError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-2" aria-live="polite">
      {obligation.subTasks.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">{t("emptyTasks")}</p>
      )}
      {obligation.subTasks.map((sub) => (
        <div key={sub.id} className="group flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-2 hover:bg-muted/50">
          <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
            <Checkbox
              checked={sub.isCompleted}
              disabled={!canWrite || pendingIds.has(sub.id)}
              aria-label={t(sub.isCompleted ? "reopenTask" : "toggleTask", { title: sub.title })}
              onCheckedChange={() => {
                if (canWrite) toggle(sub)
              }}
            />
          </label>
          <span
            className={cn(
              "min-w-0 flex-1 break-words text-sm text-foreground [overflow-wrap:anywhere]",
              sub.isCompleted && "text-muted-foreground line-through",
            )}
          >
            {sub.title}
          </span>
          {canWrite && (
            <button
              type="button"
              onClick={() => remove(sub)}
              disabled={pendingIds.has(sub.id)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:opacity-100 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={t("deleteTask", { title: sub.title })}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {canWrite && (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label={t("addTaskPlaceholder")}
            placeholder={t("addTaskPlaceholder")}
            value={newTitle}
            onChange={(e) => {
              setNewTitle(e.target.value)
              if (addError) setAddError("")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
            className="min-h-11 flex-1 text-sm"
            disabled={busy}
          />
          {newTitle.trim() && (
            <Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={add} disabled={busy}>
              {t("addTask")}
            </Button>
          )}
        </div>
      )}
      {addError && (
        <p className="text-sm text-destructive" role="alert">
          {addError}
        </p>
      )}
    </div>
  )
}
