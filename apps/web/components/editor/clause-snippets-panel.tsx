"use client"

import React, { useEffect, useState, useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { toast } from "sonner"
import { Search, Trash2, ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuiltInSnippet {
  id: string
  name: string
  category: string
  contentText: string
  content: object[]
}

interface UserSnippet {
  id: string
  name: string
  category: string
  contentText: string
  content: object[]
  createdAt: string
}

interface SnippetsData {
  builtIn: BuiltInSnippet[]
  userSnippets: UserSnippet[]
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClauseSnippetsPanelProps {
  editor: Editor
  contractId?: string
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text
  return text.slice(0, max) + "…"
}

function groupByCategory(snippets: BuiltInSnippet[]): Record<string, BuiltInSnippet[]> {
  return snippets.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {} as Record<string, BuiltInSnippet[]>)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClauseSnippetsPanel({
  editor,
  contractId: _contractId,
  onClose: _onClose,
}: ClauseSnippetsPanelProps): React.ReactElement {
  const [snippets, setSnippets] = useState<SnippetsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveForm, setSaveForm] = useState<{
    open: boolean
    name: string
    category: string
  }>({ open: false, name: "", category: "My Snippets" })

  // Track which built-in categories are collapsed
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // ─── Fetch on mount ──────────────────────────────────────────────────────

  const fetchSnippets = useCallback(() => {
    setLoading(true)
    fetch("/api/snippets")
      .then((r) => r.json())
      .then((data: SnippetsData) => {
        setSnippets(data)
        setLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load snippets")
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchSnippets()
  }, [fetchSnippets])

  // ─── Search filter ───────────────────────────────────────────────────────

  const matchesSearch = useCallback(
    (s: { name: string; contentText: string }) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.contentText.toLowerCase().includes(q)
      )
    },
    [search],
  )

  const filteredBuiltIn = snippets?.builtIn.filter(matchesSearch) ?? []
  const filteredUserSnippets = snippets?.userSnippets.filter(matchesSearch) ?? []
  const grouped = groupByCategory(filteredBuiltIn)

  // ─── Insert snippet ──────────────────────────────────────────────────────

  function insertSnippet(content: object[]) {
    editor.chain().focus().insertContent(content).run()
  }

  // ─── Toggle category collapse ────────────────────────────────────────────

  function toggleCategory(category: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // ─── Delete user snippet ─────────────────────────────────────────────────

  async function deleteSnippet(id: string) {
    if (!window.confirm("Delete this snippet? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/snippets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setSnippets((prev) =>
        prev
          ? { ...prev, userSnippets: prev.userSnippets.filter((s) => s.id !== id) }
          : prev,
      )
      toast.success("Snippet deleted")
    } catch {
      toast.error("Failed to delete snippet")
    }
  }

  // ─── Save selection as snippet ───────────────────────────────────────────

  function openSaveForm() {
    setSaveForm({ open: true, name: "", category: "My Snippets" })
  }

  async function handleSaveSnippet() {
    if (!saveForm.name.trim()) {
      toast.error("Snippet name is required")
      return
    }

    const { from, to } = editor.state.selection
    if (from === to) {
      toast.error("Select some text in the editor before saving as a snippet")
      return
    }

    const selectedContent = editor.state.doc.slice(from, to).toJSON()
    const contentArray = (selectedContent as { content?: object[] }).content ?? []
    const contentText = editor.state.doc.textBetween(from, to, " ")

    setSaving(true)
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveForm.name.trim(),
          category: saveForm.category.trim() || "My Snippets",
          content: contentArray,
          contentText,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Snippet saved")
      setSaveForm({ open: false, name: "", category: "My Snippets" })
      fetchSnippets()
    } catch {
      toast.error("Failed to save snippet")
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const totalBuiltIn = snippets?.builtIn.length ?? 0
  const totalUser = snippets?.userSnippets.length ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clauses…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            {/* ── Built-in section ──────────────────────────────────────── */}
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Built-in ({totalBuiltIn})
              </p>
            </div>
            <div className="h-px bg-border mx-4 mb-2" />

            {filteredBuiltIn.length === 0 && search && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                No built-in snippets match your search.
              </p>
            )}

            {Object.entries(grouped).map(([category, items]) => {
              const collapsed = collapsedCategories.has(category)
              return (
                <div key={category} className="mb-2">
                  {/* Category header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                  >
                    {collapsed ? (
                      <ChevronRight className="size-3.5 shrink-0 text-zinc-400" />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0 text-zinc-400" />
                    )}
                    {category}
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                      {items.length}
                    </span>
                  </button>

                  {/* Category items */}
                  {!collapsed && (
                    <div className="space-y-0.5">
                      {items.map((snippet) => (
                        <SnippetRow
                          key={snippet.id}
                          name={snippet.name}
                          preview={truncate(snippet.contentText)}
                          onInsert={() => insertSnippet(snippet.content)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* ── My Snippets section ───────────────────────────────────── */}
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                My Snippets ({totalUser})
              </p>
            </div>
            <div className="h-px bg-border mx-4 mb-2" />

            {filteredUserSnippets.length === 0 && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                {search
                  ? "No saved snippets match your search."
                  : "No saved snippets yet. Select text in the editor and use the button below to save your first snippet."}
              </p>
            )}

            <div className="space-y-0.5">
              {filteredUserSnippets.map((snippet) => (
                <SnippetRow
                  key={snippet.id}
                  name={snippet.name}
                  preview={truncate(snippet.contentText)}
                  onInsert={() => insertSnippet(snippet.content)}
                  onDelete={() => deleteSnippet(snippet.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Save current selection as snippet ──────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        {!saveForm.open ? (
          <button
            type="button"
            onClick={openSaveForm}
            className="w-full flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-1"
          >
            <Plus className="size-3.5" />
            Save current selection as snippet
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-700">Save selection as snippet</p>
            <Input
              value={saveForm.name}
              onChange={(e) => setSaveForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Snippet name"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveSnippet()
                if (e.key === "Escape") setSaveForm({ open: false, name: "", category: "My Snippets" })
              }}
            />
            <Input
              value={saveForm.category}
              onChange={(e) => setSaveForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Category (default: My Snippets)"
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => void handleSaveSnippet()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setSaveForm({ open: false, name: "", category: "My Snippets" })}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SnippetRow sub-component ─────────────────────────────────────────────────

function SnippetRow({
  name,
  preview,
  onInsert,
  onDelete,
}: {
  name: string
  preview: string
  onInsert: () => void
  onDelete?: () => void
}) {
  return (
    <div className="group px-4 py-2 hover:bg-zinc-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-900 truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {preview}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[11px] px-2"
          onMouseDown={(e) => {
            e.preventDefault()
            onInsert()
          }}
        >
          Insert
        </Button>
        {onDelete && (
          <button
            type="button"
            title="Delete snippet"
            onClick={onDelete}
            className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
