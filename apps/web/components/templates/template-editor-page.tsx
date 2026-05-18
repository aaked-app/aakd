"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ChevronRight, Plus, ScanText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ContractEditor, EMPTY_DOC } from "@/components/editor/contract-editor"

const CONTRACT_TYPES = ["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"] as const
type ContractType = (typeof CONTRACT_TYPES)[number]

interface Variable {
  name: string
  label: string
  type: "text" | "date" | "number"
  required: boolean
  defaultValue?: string
}

function prettifySnakeCase(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function TemplateEditorPage({ templateId }: { templateId?: string }) {
  const router = useRouter()
  const isEdit = !!templateId

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [contractType, setContractType] = useState<ContractType | "NONE">("NONE")
  const [content, setContent] = useState<unknown>(EMPTY_DOC)
  const [wordCount, setWordCount] = useState(0)
  const [variables, setVariables] = useState<Variable[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  // Sheet for adding a new variable
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [newVar, setNewVar] = useState<Variable>({
    name: "",
    label: "",
    type: "text",
    required: true,
    defaultValue: "",
  })

  // Scan results
  const [scanResults, setScanResults] = useState<string[] | null>(null)

  useEffect(() => {
    if (!isEdit || !templateId) return
    fetch(`/api/templates/${templateId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((tpl) => {
        setName(tpl.name ?? "")
        setDescription(tpl.description ?? "")
        setContractType((tpl.contractType ?? "NONE") as ContractType | "NONE")
        if (tpl.content) setContent(tpl.content)
        if (Array.isArray(tpl.variables)) setVariables(tpl.variables)
        setWordCount(tpl.wordCount ?? 0)
        setLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load template")
        router.push("/templates")
      })
  }, [isEdit, templateId, router])

  const handleEditorChange = useCallback((value: unknown, wc: number) => {
    setContent(value)
    setWordCount(wc)
  }, [])

  function addVariable() {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(newVar.name)) {
      toast.error("Variable name must be lowercase letters, numbers, underscores; start with a letter.")
      return
    }
    if (!newVar.label.trim()) {
      toast.error("Variable label is required")
      return
    }
    if (variables.some((v) => v.name === newVar.name)) {
      toast.error("Variable name already exists")
      return
    }
    if (variables.length >= 50) {
      toast.error("Max 50 variables per template")
      return
    }
    setVariables([...variables, { ...newVar, defaultValue: newVar.defaultValue || undefined }])
    setNewVar({ name: "", label: "", type: "text", required: true, defaultValue: "" })
    setShowAddSheet(false)
  }

  function removeVariable(name: string) {
    setVariables((vs) => vs.filter((v) => v.name !== name))
  }

  function handleScan() {
    const used = findUsedVariableNames(content)
    const declaredNames = new Set(variables.map((v) => v.name))
    const undeclared = used.filter((n) => !declaredNames.has(n))
    setScanResults(undeclared)
    if (undeclared.length === 0) {
      toast.success("No undeclared variables found")
    }
  }

  function addAllUndeclared() {
    if (!scanResults || scanResults.length === 0) return
    const toAdd: Variable[] = []
    for (const vname of scanResults) {
      if (!variables.some((v) => v.name === vname) && variables.length + toAdd.length < 50) {
        toAdd.push({
          name: vname,
          label: prettifySnakeCase(vname),
          type: "text",
          required: true,
          defaultValue: undefined,
        })
      }
    }
    if (toAdd.length > 0) {
      setVariables((prev) => [...prev, ...toAdd])
      toast.success(`Added ${toAdd.length} variable${toAdd.length > 1 ? "s" : ""}`)
    }
    setScanResults(null)
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    // Client-side check: every {{variable}} chip must reference a declared variable.
    const used = findUsedVariableNames(content)
    const declaredNames = new Set(variables.map((v) => v.name))
    const undeclared = used.filter((n) => !declaredNames.has(n))
    if (undeclared.length > 0) {
      toast.error(
        "Some variables in the document are not declared. Add them in the Variables panel or remove them from the document.",
      )
      return
    }

    setSaving(true)
    try {
      const body = {
        name,
        description: description || undefined,
        contractType: contractType === "NONE" ? undefined : contractType,
        content,
        variables,
        wordCount,
      }
      const url = isEdit ? `/api/templates/${templateId}` : "/api/templates"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.error === "template_limit_reached") {
          toast.error("Template limit reached (200). Archive unused templates to create new ones.")
        } else if (err.error === "duplicate_variable_names") {
          toast.error(`Duplicate variable names: ${err.duplicates?.join(", ")}`)
        } else if (err.error === "undeclared_variables") {
          toast.error(`Undeclared variables in document: ${err.names?.join(", ")}`)
        } else if (err.error === "payload_too_large") {
          toast.error("Template content too large (max 5 MB)")
        } else {
          toast.error("Failed to save template")
        }
        return
      }
      toast.success("Template saved")
      router.push("/templates")
    } catch (err) {
      console.error("[template-editor] save failed:", err)
      toast.error("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading template…</div>

  return (
    <div className="p-6 space-y-4">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/templates" className="hover:text-foreground transition-colors">Templates</Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{isEdit ? name || "Edit Template" : "New Template"}</span>
      </nav>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="tpl-name"
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contract type</Label>
              <Select value={contractType} onValueChange={(v) => v && setContractType(v as ContractType | "NONE")}>
                <SelectTrigger className="h-9 text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variables panel */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variables</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={handleScan}
                  title="Scan document for undeclared variable placeholders"
                >
                  <ScanText className="size-3.5" />
                  Scan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setNewVar({ name: "", label: "", type: "text", required: true, defaultValue: "" })
                    setShowAddSheet(true)
                  }}
                  disabled={variables.length >= 50}
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
            </div>

            {/* Scan results banner */}
            {scanResults !== null && scanResults.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 space-y-2">
                <p className="font-medium">Found undeclared:</p>
                <p className="font-mono">{scanResults.map((n) => `{{${n}}}`).join(", ")}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={addAllUndeclared}
                  >
                    Add all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300"
                    onClick={() => setScanResults(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {variables.length === 0 && (
                <p className="text-xs text-muted-foreground">No variables declared yet.</p>
              )}
              {variables.map((v) => (
                <div key={v.name} className="rounded border border-border px-2 py-1.5 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{v.label}</p>
                    <p className="text-muted-foreground truncate">{v.name} · {v.type}{v.required ? " · req" : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariable(v.name)}
                    className="text-destructive hover:text-destructive/80 transition-colors"
                    title="Remove variable"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Editor area */}
        <div className="col-span-12 md:col-span-9 space-y-3">
          <div className="flex items-center justify-end gap-2">
            <Link href="/templates">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Template"}
            </Button>
          </div>
          <ContractEditor
            initialContent={content}
            initialVersion={0}
            onChange={handleEditorChange}
            showVariablesPanel
            variables={variables.map((v) => ({ name: v.name, label: v.label, required: v.required }))}
            enableAutoSave={false}
          />
        </div>
      </div>

      {/* Add Variable Sheet */}
      <Sheet open={showAddSheet} onOpenChange={(open) => !open && setShowAddSheet(false)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Variable</SheetTitle>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. party_name"
                value={newVar.name}
                onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, underscores only. Must start with a letter.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Label <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Party Name"
                value={newVar.label}
                onChange={(e) => setNewVar({ ...newVar, label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Shown to users when they fill in this variable.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={newVar.type}
                onValueChange={(v) => v && setNewVar({ ...newVar, type: v as "text" | "date" | "number" })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default value</Label>
              <Input
                placeholder="Optional — pre-fills the field"
                value={newVar.defaultValue ?? ""}
                onChange={(e) => setNewVar({ ...newVar, defaultValue: e.target.value })}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Switch
                checked={newVar.required}
                onCheckedChange={(c) => setNewVar({ ...newVar, required: c })}
              />
              Required field
            </label>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={addVariable}>
                Add Variable
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAddSheet(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utility — extract all templateVariable names from a TipTap/Slate doc
// ---------------------------------------------------------------------------
function findUsedVariableNames(doc: unknown): string[] {
  const out = new Set<string>()
  function visit(n: unknown): void {
    if (!n || typeof n !== "object") return
    const node = n as {
      type?: string
      variable?: string          // legacy Slate
      attrs?: { variable?: string } // TipTap
      children?: unknown[]
      content?: unknown[]
    }
    // TipTap templateVariable node
    if (node.type === "templateVariable" && node.attrs?.variable) {
      out.add(node.attrs.variable)
    }
    // Legacy Slate template_variable node
    if (node.type === "template_variable" && typeof node.variable === "string") {
      out.add(node.variable)
    }
    // TipTap children are in `content`
    if (Array.isArray(node.content)) {
      for (const c of node.content) visit(c)
    }
    // Legacy Slate children are in `children`
    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c)
    }
  }
  if (Array.isArray(doc)) {
    for (const n of doc) visit(n)
  } else {
    visit(doc)
  }
  return Array.from(out)
}
