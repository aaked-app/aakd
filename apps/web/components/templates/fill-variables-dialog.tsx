"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

export interface TemplateVariable {
  name: string
  label: string
  type: "text" | "date" | "number"
  required: boolean
  defaultValue?: string
}

interface FullTemplate {
  id: string
  name: string
  variables: TemplateVariable[]
}

export function FillVariablesDialog({
  templateId,
  onClose,
  onCreated,
}: {
  templateId: string
  onClose: () => void
  onCreated: (contractId: string) => void
}) {
  const [template, setTemplate] = useState<FullTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    fetch(`/api/templates/${templateId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((tpl) => {
        if (cancelled) return
        const declared: TemplateVariable[] = Array.isArray(tpl.variables) ? tpl.variables : []
        setTemplate({ id: tpl.id, name: tpl.name, variables: declared })
        setTitle(tpl.name)
        const initial: Record<string, string> = {}
        for (const v of declared) {
          if (v.defaultValue) initial[v.name] = v.defaultValue
        }
        setValues(initial)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        toast.error("Failed to load template")
        onClose()
      })
    return () => {
      cancelled = true
    }
  }, [templateId, onClose])

  async function handleCreate() {
    if (!template) return
    if (!title.trim()) {
      setErrors({ title: "Title is required" })
      return
    }
    const fieldErrors: Record<string, string> = {}
    for (const v of template.variables) {
      if (v.required && !values[v.name]) {
        fieldErrors[v.name] = "This field is required"
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          values,
        }),
      })
      if (res.status === 422) {
        const body = await res.json().catch(() => ({}))
        if (body.error === "missing_required_variables" && Array.isArray(body.missing)) {
          const newErrors: Record<string, string> = {}
          for (const m of body.missing) newErrors[m] = "This field is required"
          setErrors(newErrors)
          return
        }
        toast.error("Validation failed")
        return
      }
      if (!res.ok) {
        toast.error("Failed to create contract")
        return
      }
      const body = await res.json()
      if (body.contractId) {
        onCreated(body.contractId)
      }
    } catch (err) {
      console.error("[fill-variables] failed:", err)
      toast.error("Failed to create contract")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {template ? `Create contract from ${template.name}` : "Create contract"}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : template ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Contract details</p>
              <div className="space-y-2">
                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setErrors((prev) => ({ ...prev, title: "" }))
                  }}
                />
                {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
              </div>
            </div>

            {template.variables.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Variables</p>
                <div className="space-y-3">
                  {template.variables.map((v) => (
                    <div key={v.name} className="space-y-1">
                      <Label htmlFor={`var-${v.name}`}>
                        {v.label}
                        {v.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      <Input
                        id={`var-${v.name}`}
                        type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"}
                        value={values[v.name] ?? ""}
                        onChange={(e) => {
                          setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                          setErrors((prev) => ({ ...prev, [v.name]: "" }))
                        }}
                      />
                      {errors[v.name] && (
                        <p className="text-xs text-red-600">{errors[v.name]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating…" : "Create Contract"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
