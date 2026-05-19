"use client"

import { useEffect, useState } from "react"
import { Editor } from "@tiptap/react"
import { formatDistanceToNow } from "date-fns"
import { ArrowRight, Check, ChevronDown, Keyboard, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ChangeItem,
  collectChanges,
  acceptChange,
  rejectChange,
  scrollToChange,
} from "./contract-editor"

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
]

function avatarColor(seed: string | null): string {
  if (!seed) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.[0] ?? "?").toUpperCase()
}

// ── Heading lookup ────────────────────────────────────────────────────────────

function getNearestHeading(editor: Editor, pos: number): string {
  let heading = "Preamble"
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "heading" && nodePos < pos) {
      heading = node.textContent || heading
    }
  })
  return heading
}

// ── Context extraction ────────────────────────────────────────────────────────

function getChangeContext(editor: Editor, change: ChangeItem): {
  before: string
  after: string
} {
  const docSize = editor.state.doc.content.size
  const before = editor.state.doc
    .textBetween(Math.max(0, change.from - 50), change.from, " ")
    .slice(-20)
  const after = editor.state.doc
    .textBetween(change.to, Math.min(docSize, change.to + 50), " ")
    .slice(0, 20)
  return { before, after }
}

// ── ChangeCard sub-component ──────────────────────────────────────────────────

interface ChangeCardProps {
  change: ChangeItem
  editor: Editor
  isActive: boolean
  onActivate: () => void
  onAccept: () => void
  onReject: () => void
}

function ChangeCard({
  change,
  editor,
  isActive,
  onActivate,
  onAccept,
  onReject,
}: ChangeCardProps) {
  const { before, after } = getChangeContext(editor, change)
  const displayText = change.text || "(empty)"

  const authorName = change.userId ?? null
  const timeLabel = change.createdAt
    ? formatDistanceToNow(new Date(change.createdAt), { addSuffix: true })
    : null

  return (
    <div
      className={cn(
        "rounded-md border p-2 cursor-pointer transition-colors",
        isActive
          ? "border-indigo-200 bg-indigo-50"
          : "border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50",
      )}
      onClick={onActivate}
    >
      {/* Top row: avatar + author/time + navigate + accept/reject */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {/* Author avatar */}
        <div
          className={cn(
            "size-5 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-semibold",
            avatarColor(authorName),
          )}
          title={authorName ?? "Unknown author"}
        >
          {getInitials(authorName)}
        </div>

        {/* Type badge */}
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] h-4 px-1 shrink-0",
            change.type === "insertion"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          )}
        >
          {change.type === "insertion" ? "Added" : "Removed"}
        </Badge>

        {/* Timestamp */}
        {timeLabel ? (
          <span className="text-[10px] text-zinc-400 truncate flex-1">{timeLabel}</span>
        ) : (
          <span className="flex-1" />
        )}

        {/* Navigate button */}
        <button
          type="button"
          title="Jump to change"
          onMouseDown={(e) => {
            e.preventDefault()
            scrollToChange(editor, change)
          }}
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center justify-center shrink-0"
        >
          <ArrowRight className="size-3" />
        </button>

        {/* Accept */}
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-emerald-600 hover:bg-emerald-50 shrink-0"
          title="Accept (⌥↵)"
          onClick={(e) => {
            e.stopPropagation()
            onAccept()
          }}
        >
          <Check className="h-3 w-3" />
        </Button>

        {/* Reject */}
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-red-500 hover:bg-red-50 shrink-0"
          title="Reject (⌥⌫)"
          onClick={(e) => {
            e.stopPropagation()
            onReject()
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Context line */}
      <p className="text-[11px] text-zinc-600 leading-snug break-words">
        {before && <span className="text-zinc-400">…{before}</span>}
        <span
          className={cn(
            "font-medium",
            change.type === "insertion" ? "text-emerald-700" : "text-red-600 line-through",
          )}
        >
          [{displayText.slice(0, 80)}{displayText.length > 80 ? "…" : ""}]
        </span>
        {after && <span className="text-zinc-400">{after}…</span>}
      </p>
    </div>
  )
}

// ── TrackChangeSidebar ────────────────────────────────────────────────────────

interface TrackChangeSidebarProps {
  editor: Editor
  onAcceptAll: () => void
  onRejectAll: () => void
}

export function TrackChangeSidebar({
  editor,
  onAcceptAll,
  onRejectAll,
}: TrackChangeSidebarProps) {
  const [changes, setChanges] = useState<ChangeItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Re-collect changes whenever the editor state updates
  useEffect(() => {
    const update = () => setChanges(collectChanges(editor))
    editor.on("update", update)
    update()
    return () => {
      editor.off("update", update)
    }
  }, [editor])

  // Keyboard shortcut: ⌥↓ next change, ⌥↑ prev change
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.altKey) return
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
      e.preventDefault()

      if (changes.length === 0) return
      const currentIndex = changes.findIndex((c) => c.id === activeId)

      let nextIndex: number
      if (e.key === "ArrowDown") {
        nextIndex = currentIndex < changes.length - 1 ? currentIndex + 1 : 0
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : changes.length - 1
      }

      const next = changes[nextIndex]
      if (next) {
        setActiveId(next.id)
        scrollToChange(editor, next)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [changes, activeId, editor])

  function toggleSection(section: string) {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center">
          <Check className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">All caught up</p>
        <p className="text-[12px] text-muted-foreground">
          Enable Track Changes in the toolbar to start recording edits, or import a redlined
          document to review changes.
        </p>
      </div>
    )
  }

  // ── Group changes by nearest heading ────────────────────────────────────────

  const grouped = changes.reduce<Record<string, ChangeItem[]>>((acc, change) => {
    const section = getNearestHeading(editor, change.from)
    if (!acc[section]) acc[section] = []
    acc[section].push(change)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Header with global bulk actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 shrink-0">
        <span className="text-xs font-medium text-zinc-500">
          {changes.length} change{changes.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-1 items-center">
          {/* Keyboard shortcuts tooltip toggle */}
          <button
            type="button"
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard shortcuts"
            className={cn(
              "h-6 w-6 rounded flex items-center justify-center transition-colors shrink-0",
              showShortcuts
                ? "bg-zinc-100 text-zinc-700"
                : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50",
            )}
          >
            <Keyboard className="size-3.5" />
          </button>
          <Button size="sm" variant="ghost" className="h-6 text-xs text-emerald-600" onClick={onAcceptAll}>
            Accept all
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500" onClick={onRejectAll}>
            Reject all
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      {showShortcuts && (
        <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100 space-y-1 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">Shortcuts</p>
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>Next change</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[10px] font-mono">⌥ ↓</kbd>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>Prev change</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[10px] font-mono">⌥ ↑</kbd>
          </div>
        </div>
      )}

      {/* Grouped sections */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([section, sectionChanges]) => {
          // Collect unique author IDs in this section for author summary
          const authorIds = Array.from(new Set(sectionChanges.map((c) => c.userId).filter(Boolean)))

          return (
            <div key={section}>
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0 mr-2">
                  {/* Author avatar cluster */}
                  <div className="flex -space-x-1 shrink-0">
                    {authorIds.slice(0, 3).map((uid) => (
                      <div
                        key={uid}
                        className={cn(
                          "size-4 rounded-full border border-white flex items-center justify-center text-white text-[8px] font-semibold",
                          avatarColor(uid),
                        )}
                        title={uid ?? undefined}
                      >
                        {getInitials(uid)}
                      </div>
                    ))}
                    {authorIds.length > 3 && (
                      <div className="size-4 rounded-full border border-white bg-zinc-300 flex items-center justify-center text-zinc-700 text-[8px] font-semibold">
                        +{authorIds.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="truncate">{section}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Section-level accept/reject all */}
                  <button
                    type="button"
                    title="Accept all in section"
                    onClick={(e) => {
                      e.stopPropagation()
                      sectionChanges.forEach((c) => acceptChange(editor, c))
                    }}
                    className="text-[10px] text-emerald-600 hover:bg-emerald-50 px-1.5 py-0.5 rounded"
                  >
                    ✓ All
                  </button>
                  <button
                    type="button"
                    title="Reject all in section"
                    onClick={(e) => {
                      e.stopPropagation()
                      sectionChanges.forEach((c) => rejectChange(editor, c))
                    }}
                    className="text-[10px] text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded"
                  >
                    ✗ All
                  </button>
                  <span className="flex items-center gap-1">
                    <span className="text-[10px] font-normal">{sectionChanges.length}</span>
                    <ChevronDown
                      className={cn(
                        "size-3 transition-transform",
                        collapsed[section] && "-rotate-90",
                      )}
                    />
                  </span>
                </div>
              </button>

              {/* Section cards */}
              {!collapsed[section] && (
                <div className="space-y-1 px-2 pb-2">
                  {sectionChanges.map((change) => (
                    <ChangeCard
                      key={change.id}
                      change={change}
                      editor={editor}
                      isActive={activeId === change.id}
                      onActivate={() => {
                        setActiveId(change.id)
                        scrollToChange(editor, change)
                      }}
                      onAccept={() => acceptChange(editor, change)}
                      onReject={() => rejectChange(editor, change)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
