"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
// The import below triggers the TipTap module augmentation for our custom commands
import "@/lib/editor/search-and-replace"
import type { SearchAndReplaceStorage } from "@/lib/editor/search-and-replace"
import { X, ChevronUp, ChevronDown, Replace, ReplaceAll, Search } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Props ────────────────────────────────────────────────────────────────────

interface FindReplacePanelProps {
  editor: Editor | null
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [replaceTerm, setReplaceTerm] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus the search input when the panel opens
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const getStorage = useCallback(
    (): SearchAndReplaceStorage | null =>
      editor ? (editor.storage.searchAndReplace as SearchAndReplaceStorage) : null,
    [editor],
  )

  // Sync search term into extension storage and refresh match count
  const updateSearch = useCallback(
    (term: string, cs: boolean) => {
      if (!editor) return
      editor.commands.setSearchTerm(term)
      editor.commands.setCaseSensitive(cs)
      // Storage is updated synchronously after the commands above
      const s = getStorage()
      setMatchCount(s?.results.length ?? 0)
      setCurrentIndex(s && s.results.length > 0 ? s.resultIndex + 1 : 0)
    },
    [editor, getStorage],
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearchTerm(val)
      updateSearch(val, caseSensitive)
    },
    [caseSensitive, updateSearch],
  )

  const handleCaseSensitiveToggle = useCallback(() => {
    const next = !caseSensitive
    setCaseSensitive(next)
    updateSearch(searchTerm, next)
  }, [caseSensitive, searchTerm, updateSearch])

  const handleNext = useCallback(() => {
    if (!editor) return
    editor.commands.nextSearchResult()
    const s = getStorage()
    setCurrentIndex(s && s.results.length > 0 ? s.resultIndex + 1 : 0)
  }, [editor, getStorage])

  const handlePrev = useCallback(() => {
    if (!editor) return
    editor.commands.previousSearchResult()
    const s = getStorage()
    setCurrentIndex(s && s.results.length > 0 ? s.resultIndex + 1 : 0)
  }, [editor, getStorage])

  const handleReplace = useCallback(() => {
    if (!editor) return
    editor.commands.setReplaceTerm(replaceTerm)
    editor.commands.replaceCurrentSearchResult()
    // Storage updates happen async after doc mutation — read it on next tick
    setTimeout(() => {
      const s = getStorage()
      setMatchCount(s?.results.length ?? 0)
      setCurrentIndex(s && s.results.length > 0 ? s.resultIndex + 1 : 0)
    }, 10)
  }, [editor, replaceTerm, getStorage])

  const handleReplaceAll = useCallback(() => {
    if (!editor) return
    editor.commands.setReplaceTerm(replaceTerm)
    editor.commands.replaceAllSearchResults()
    setMatchCount(0)
    setCurrentIndex(0)
  }, [editor, replaceTerm])

  // Keyboard shortcuts inside the panel
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (e.shiftKey) {
          handlePrev()
        } else {
          handleNext()
        }
      }
    },
    [onClose, handleNext, handlePrev],
  )

  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "Enter") {
        e.preventDefault()
        handleReplace()
      }
    },
    [onClose, handleReplace],
  )

  // Clear search when panel closes
  const handleClose = useCallback(() => {
    if (editor) {
      editor.commands.setSearchTerm("")
    }
    onClose()
  }, [editor, onClose])

  return (
    <div
      className="absolute top-[52px] right-4 z-50 w-72 bg-white rounded-md border border-zinc-200 shadow-lg"
      // Prevent mousedown from stealing editor focus / selection
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
          <Search className="size-3.5" />
          Find &amp; Replace
        </span>
        <button
          type="button"
          title="Close (Esc)"
          onMouseDown={(e) => { e.preventDefault(); handleClose() }}
          className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Find row */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find…"
            spellCheck={false}
            className="w-full h-8 rounded border border-zinc-200 px-2.5 pr-28 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          />

          {/* Match count + nav buttons inline */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {searchTerm && (
              <span className="text-[10px] text-zinc-400 tabular-nums mr-0.5 select-none">
                {matchCount === 0 ? "No results" : `${currentIndex} / ${matchCount}`}
              </span>
            )}
            <button
              type="button"
              title="Previous match (Shift+Enter)"
              onMouseDown={(e) => { e.preventDefault(); handlePrev() }}
              disabled={matchCount === 0}
              className={cn(
                "h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100",
                matchCount === 0 && "opacity-40 cursor-not-allowed hover:bg-transparent",
              )}
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              title="Next match (Enter)"
              onMouseDown={(e) => { e.preventDefault(); handleNext() }}
              disabled={matchCount === 0}
              className={cn(
                "h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100",
                matchCount === 0 && "opacity-40 cursor-not-allowed hover:bg-transparent",
              )}
            >
              <ChevronDown className="size-3.5" />
            </button>
            {/* Case-sensitive toggle */}
            <button
              type="button"
              title={caseSensitive ? "Case-sensitive (on)" : "Case-sensitive (off)"}
              onMouseDown={(e) => { e.preventDefault(); handleCaseSensitiveToggle() }}
              className={cn(
                "h-6 w-6 inline-flex items-center justify-center rounded text-xs font-bold",
                caseSensitive
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700",
              )}
            >
              Aa
            </button>
          </div>
        </div>

        {/* Replace row */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace with…"
            spellCheck={false}
            className="flex-1 h-8 rounded border border-zinc-200 px-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 min-w-0"
          />
          <button
            type="button"
            title="Replace current (Enter in replace field)"
            onMouseDown={(e) => { e.preventDefault(); handleReplace() }}
            disabled={matchCount === 0}
            className={cn(
              "h-8 w-8 shrink-0 inline-flex items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100",
              matchCount === 0 && "opacity-40 cursor-not-allowed hover:bg-transparent hover:border-zinc-200",
            )}
          >
            <Replace className="size-3.5" />
          </button>
          <button
            type="button"
            title="Replace all"
            onMouseDown={(e) => { e.preventDefault(); handleReplaceAll() }}
            disabled={matchCount === 0}
            className={cn(
              "h-8 w-8 shrink-0 inline-flex items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100",
              matchCount === 0 && "opacity-40 cursor-not-allowed hover:bg-transparent hover:border-zinc-200",
            )}
          >
            <ReplaceAll className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
