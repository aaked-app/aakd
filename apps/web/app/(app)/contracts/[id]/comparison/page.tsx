"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ChevronLeft, GitCompare, Loader2 } from "lucide-react"
import { ContractEditor } from "@/components/editor/contract-editor"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotMeta {
  id: string
  label: string
  createdAt: string
  createdBy: { name: string | null }
}

interface SnapshotFull extends SnapshotMeta {
  content: unknown
  wordCount: number | null
}

type DiffChunk = { value: string; added?: boolean; removed?: boolean }

// ─── Text extraction from TipTap JSON ─────────────────────────────────────────

function extractText(content: unknown): string {
  if (!content) return ""
  const lines: string[] = []

  function walk(node: Record<string, unknown>) {
    if (node.type === "text") {
      lines.push((node.text as string) ?? "")
      return
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content as Record<string, unknown>[]) {
        walk(child)
      }
      const blockTypes = [
        "paragraph", "heading", "bulletList", "orderedList",
        "listItem", "blockquote", "horizontalRule",
      ]
      if (blockTypes.includes(node.type as string)) {
        lines.push("\n")
      }
    }
  }

  const doc = content as { type?: string; content?: unknown[] }
  if (doc.type === "doc" && Array.isArray(doc.content)) {
    for (const node of doc.content as Record<string, unknown>[]) {
      walk(node)
    }
  } else if (Array.isArray(content)) {
    for (const node of content as Record<string, unknown>[]) {
      walk(node)
    }
  }

  return lines.join("").trim()
}

// ─── Word-level LCS diff ──────────────────────────────────────────────────────

const WORD_CAP = 500

function wordDiff(oldText: string, newText: string): DiffChunk[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)

  if (oldWords.length > WORD_CAP || newWords.length > WORD_CAP) {
    return [{ value: "(Document too large for inline diff — use Side by side view)" }]
  }

  const m = oldWords.length
  const n = newWords.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  let i = m
  let j = n
  const chunks: DiffChunk[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      chunks.unshift({ value: oldWords[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      chunks.unshift({ value: newWords[j - 1], added: true })
      j--
    } else {
      chunks.unshift({ value: oldWords[i - 1], removed: true })
      i--
    }
  }

  return chunks
}

function countDiffWords(chunks: DiffChunk[], type: "added" | "removed"): number {
  return chunks
    .filter((c) => (type === "added" ? c.added : c.removed))
    .reduce((n, c) => n + c.value.split(/\s+/).filter(Boolean).length, 0)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComparisonPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const contractId = params.id
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [snapsLoading, setSnapsLoading] = useState(true)

  // Version selectors — driven by URL params initially
  const [selectedA, setSelectedA] = useState(searchParams.get("a") ?? "")
  const [selectedB, setSelectedB] = useState(searchParams.get("b") ?? "live")

  // Fetched full snapshot data
  const [snapA, setSnapA] = useState<SnapshotFull | null>(null)
  const [snapB, setSnapB] = useState<SnapshotFull | null>(null)
  const [labelB, setLabelB] = useState("Current version")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Computed diff
  const [chunks, setChunks] = useState<DiffChunk[]>([])
  const [wordsAdded, setWordsAdded] = useState(0)
  const [wordsRemoved, setWordsRemoved] = useState(0)

  // View toggle
  const [view, setView] = useState<"diff" | "sidebyside">("diff")

  // ── Load snapshot list ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/contracts/${contractId}/snapshots`)
      .then((r) => r.json())
      .then((d: { snapshots?: SnapshotMeta[] }) => {
        setSnapshots(d.snapshots ?? [])
        setSnapsLoading(false)
      })
      .catch(() => setSnapsLoading(false))
  }, [contractId])

  // ── Fetch and diff when selectors change ────────────────────────────────────
  useEffect(() => {
    if (!selectedA) {
      setSnapA(null)
      setSnapB(null)
      setChunks([])
      setWordsAdded(0)
      setWordsRemoved(0)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function run() {
      try {
        // Fetch snapshot A
        const resA = await fetch(`/api/contracts/${contractId}/snapshots/${selectedA}`)
        if (!resA.ok) throw new Error("Could not load snapshot A")
        const dataA = await resA.json() as { snapshot: SnapshotFull }
        if (cancelled) return
        const fetchedA = dataA.snapshot
        setSnapA(fetchedA)

        // Fetch snapshot B or live document
        let fetchedB: SnapshotFull | null = null
        let resolvedLabelB = "Current version"

        if (selectedB === "live") {
          const resDoc = await fetch(`/api/contracts/${contractId}/document`)
          if (!resDoc.ok) throw new Error("Could not load live document")
          const dataDoc = await resDoc.json() as { document?: { content: unknown; version: number; updatedAt: string } }
          if (cancelled) return
          const doc = dataDoc.document
          if (doc) {
            fetchedB = {
              id: "live",
              label: "Current version",
              createdAt: doc.updatedAt,
              createdBy: { name: null },
              content: doc.content,
              wordCount: null,
            }
          }
          resolvedLabelB = "Current version"
        } else {
          const resB = await fetch(`/api/contracts/${contractId}/snapshots/${selectedB}`)
          if (!resB.ok) throw new Error("Could not load snapshot B")
          const dataB = await resB.json() as { snapshot: SnapshotFull }
          if (cancelled) return
          fetchedB = dataB.snapshot
          resolvedLabelB = dataB.snapshot.label
        }

        if (cancelled) return

        setSnapB(fetchedB)
        setLabelB(resolvedLabelB)

        // Compute word diff
        const textA = extractText(fetchedA.content)
        const textB = extractText(fetchedB?.content)
        const computed = wordDiff(textA, textB)
        setChunks(computed)
        setWordsAdded(countDiffWords(computed, "added"))
        setWordsRemoved(countDiffWords(computed, "removed"))
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load comparison")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => { cancelled = true }
  }, [contractId, selectedA, selectedB])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const snapshotLabel = (id: string) =>
    snapshots.find((s) => s.id === id)?.label ?? id

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Top nav bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background shrink-0">
        <Link
          href={`/contracts/${contractId}?tab=editor`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to contract
        </Link>
        <span className="mx-2 text-border">|</span>
        <h1 className="text-sm font-semibold">Version Comparison</h1>
      </div>

      {/* ── Version selector bar ─────────────────────────────────────────────── */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-4 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-8">From</span>
          {snapsLoading ? (
            <Skeleton className="h-8 w-52" />
          ) : (
            <Select
              value={selectedA}
              onValueChange={(v) => { if (v) setSelectedA(v) }}
            >
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Select snapshot…" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="ml-2 text-muted-foreground">
                      {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-8">To</span>
          {snapsLoading ? (
            <Skeleton className="h-8 w-52" />
          ) : (
            <Select
              value={selectedB}
              onValueChange={(v) => { if (v) setSelectedB(v) }}
            >
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Select version…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live" className="text-xs font-medium text-indigo-600">
                  Current document (live)
                </SelectItem>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="ml-2 text-muted-foreground">
                      {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── Changes summary bar ──────────────────────────────────────────────── */}
      {selectedA && !loading && !error && (
        <div className="flex items-center gap-6 px-6 py-2.5 border-b border-border bg-muted/10 text-sm shrink-0">
          <div className="flex items-center gap-1.5">
            <GitCompare className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Changes</span>
          </div>
          {wordsAdded > 0 && (
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="font-semibold">+{wordsAdded}</span>
              <span className="text-emerald-600">words added</span>
            </span>
          )}
          {wordsRemoved > 0 && (
            <span className="flex items-center gap-1 text-red-700">
              <span className="font-semibold">-{wordsRemoved}</span>
              <span className="text-red-600">words removed</span>
            </span>
          )}
          {wordsAdded === 0 && wordsRemoved === 0 && chunks.length > 0 && (
            <span className="text-muted-foreground">No changes detected</span>
          )}

          {/* View toggle — right-aligned */}
          <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("diff")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                view === "diff"
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              Diff view
            </button>
            <button
              type="button"
              onClick={() => setView("sidebyside")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors border-l border-border",
                view === "sidebyside"
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              Side by side
            </button>
          </div>
        </div>
      )}

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* Empty state */}
        {!selectedA && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <GitCompare className="size-10 text-border" />
            <p className="text-sm">Select a snapshot above to compare versions</p>
          </div>
        )}

        {/* Loading */}
        {selectedA && loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Loading comparison…</p>
          </div>
        )}

        {/* Error */}
        {selectedA && !loading && error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
            <p className="text-sm font-medium">Could not load comparison</p>
            <p className="text-xs text-muted-foreground">{error} — snapshot may have been deleted.</p>
          </div>
        )}

        {/* Diff view */}
        {selectedA && !loading && !error && snapA && snapB && view === "diff" && (
          <div className="p-6">
            <div className="rounded-md border border-border bg-muted/10 p-4 max-h-[calc(100vh-18rem)] overflow-y-auto font-mono text-sm leading-relaxed">
              {chunks.length === 0 ? (
                <span className="text-muted-foreground">Nothing to compare.</span>
              ) : (
                chunks.map((chunk, i) => (
                  <span
                    key={i}
                    className={cn(
                      chunk.added && "bg-emerald-100 text-emerald-900",
                      chunk.removed && "bg-red-100 text-red-900 line-through",
                      !chunk.added && !chunk.removed && "text-foreground",
                    )}
                  >
                    {chunk.value}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Side-by-side view */}
        {selectedA && !loading && !error && snapA && snapB && view === "sidebyside" && (
          <div className="grid grid-cols-2 gap-0 h-full min-h-0">

            {/* Left — Before */}
            <div className="border-r border-border overflow-y-auto">
              <div className="px-4 py-2 border-b border-border bg-muted/30 text-sm font-medium flex items-center gap-2 sticky top-0 z-10">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Before</span>
                <span className="font-semibold">{snapA.label ?? snapshotLabel(selectedA)}</span>
                {snapA.createdAt && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(snapA.createdAt), { addSuffix: true })}
                  </span>
                )}
                {snapA.createdBy?.name && (
                  <span className="text-xs text-muted-foreground">by {snapA.createdBy.name}</span>
                )}
              </div>
              <div className="p-4">
                <ContractEditor
                  initialContent={snapA.content}
                  initialVersion={0}
                  readOnly={true}
                  enableAutoSave={false}
                  onChange={() => {}}
                />
              </div>
            </div>

            {/* Right — After */}
            <div className="overflow-y-auto">
              <div className="px-4 py-2 border-b border-border bg-emerald-50 text-sm font-medium flex items-center gap-2 sticky top-0 z-10">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">After</span>
                <span className="font-semibold">{labelB}</span>
                {selectedB === "live" ? (
                  <Badge className="ml-auto text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                    Live
                  </Badge>
                ) : snapB.createdAt ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(snapB.createdAt), { addSuffix: true })}
                  </span>
                ) : null}
                {snapB.createdBy?.name && (
                  <span className="text-xs text-muted-foreground">by {snapB.createdBy.name}</span>
                )}
              </div>
              <div className="p-4">
                <ContractEditor
                  initialContent={snapB.content}
                  initialVersion={0}
                  readOnly={true}
                  enableAutoSave={false}
                  onChange={() => {}}
                />
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
