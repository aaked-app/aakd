"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

interface Shortcut {
  keys: string[]
  desc: string
}

interface ShortcutSection {
  label: string
  shortcuts: Shortcut[]
}

const SECTIONS: ShortcutSection[] = [
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"],        desc: "Open command palette" },
      { keys: ["G", "D"],         desc: "Go to Dashboard" },
      { keys: ["G", "C"],         desc: "Go to Contracts" },
      { keys: ["G", "T"],         desc: "Go to Templates" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: ["⌘", "N"],        desc: "New contract" },
      { keys: ["⌘", "S"],        desc: "Save changes" },
      { keys: ["⌘", "⇧", "F"],  desc: "Full-text search" },
      { keys: ["⌘", "⇧", "E"],  desc: "Export data" },
    ],
  },
  {
    label: "Editor",
    shortcuts: [
      { keys: ["⌘", "B"],        desc: "Bold text" },
      { keys: ["⌘", "I"],        desc: "Italic text" },
      { keys: ["⌘", "⇧", "C"],  desc: "Add comment" },
      { keys: ["Esc"],            desc: "Close panel" },
    ],
  },
]

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "?") {
        setOpen((v) => !v)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[9991] flex items-center justify-center"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[520px] rounded-xl bg-card border border-border shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-base font-bold">Keyboard Shortcuts</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {section.label}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.desc}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[13px] text-foreground/80">
                      {shortcut.desc}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono bg-muted border border-border text-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsModal
