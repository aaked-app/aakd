"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  Layers,
  Sparkles,
  LayoutGrid,
  FileText,
  BarChart3,
  Target,
  Plug,
  CreditCard,
} from "lucide-react"

interface PaletteItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  section: string
}

interface RecentContract {
  id: string
  title: string
}

const STATIC_ITEMS: PaletteItem[] = [
  // Actions
  { label: "New Contract",      href: "/contracts/new",          icon: Plus,        section: "Actions" },
  { label: "New from Template", href: "/templates",              icon: Layers,      section: "Actions" },
  { label: "Create with AI",    href: "/ai/create",              icon: Sparkles,    section: "Actions" },
  // Navigation
  { label: "Dashboard",         href: "/dashboard",              icon: LayoutGrid,  section: "Navigation" },
  { label: "Contracts",         href: "/contracts",              icon: FileText,    section: "Navigation" },
  { label: "Templates",         href: "/templates",              icon: Layers,      section: "Navigation" },
  { label: "Analytics",         href: "/analytics",              icon: BarChart3,   section: "Navigation" },
  { label: "Obligations",       href: "/obligations",            icon: Target,      section: "Navigation" },
  { label: "Integrations",      href: "/settings/integrations",  icon: Plug,        section: "Navigation" },
  { label: "Billing",           href: "/settings/billing",       icon: CreditCard,  section: "Navigation" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<RecentContract[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  // Keyboard listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") {
        close()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [close])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Fetch recent contracts when opening
  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts?limit=3")
      if (!res.ok) return
      const data = await res.json()
      const contracts: RecentContract[] = (data.contracts ?? data ?? []).map(
        (c: { id: string; title: string }) => ({ id: c.id, title: c.title }),
      )
      setRecent(contracts)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchRecent()
    }
  }, [open, fetchRecent])

  // Build filtered sections
  const q = query.toLowerCase()

  const filteredStatic = STATIC_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(q),
  )

  const filteredRecent = recent.filter((c) =>
    c.title.toLowerCase().includes(q),
  )

  // Group static items by section
  const sections = ["Actions", "Navigation"] as const
  const grouped = sections.map((section) => ({
    section,
    items: filteredStatic.filter((i) => i.section === section),
  }))

  const hasResults =
    grouped.some((g) => g.items.length > 0) || filteredRecent.length > 0

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[9990] flex items-start justify-center pt-[15vh]"
      onClick={close}
    >
      <div
        className="w-[520px] rounded-xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, contracts..."
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
          />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-muted-foreground">
            ESC
          </span>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {!hasResults ? (
            <p className="text-[13px] text-muted-foreground py-5 text-center">
              No results found
            </p>
          ) : (
            <>
              {grouped.map(
                ({ section, items }) =>
                  items.length > 0 && (
                    <div key={section}>
                      <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {section}
                      </p>
                      {items.map((item) => {
                        const Icon = item.icon
                        return (
                          <button
                            key={item.href + item.label}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-muted text-[13px] transition-colors"
                            onClick={() => {
                              router.push(item.href)
                              close()
                            }}
                          >
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  ),
              )}

              {filteredRecent.length > 0 && (
                <div>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent Contracts
                  </p>
                  {filteredRecent.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-muted text-[13px] transition-colors"
                      onClick={() => {
                        router.push(`/contracts/${c.id}`)
                        close()
                      }}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
