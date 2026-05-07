"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard, FileText, Settings, Plus, LogOut,
  Search
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { ContractStatusBadge } from "@/components/contract-status-badge"
import { signOut } from "@/lib/auth/client"
import { ContractStatus, ContractType } from "@/lib/types"

interface SearchResult {
  id: string
  title: string
  contractType: ContractType | null
  status: ContractStatus
  counterpartyName: string | null
  createdAt: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function CmdK() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const router = useRouter()

  const debouncedQuery = useDebounce(query, 200)

  // Fetch search results whenever the debounced query changes
  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    fetchResults(debouncedQuery)
  }, [debouncedQuery, fetchResults])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
    }
  }, [open])

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  function run(fn: () => void) {
    setOpen(false)
    fn()
  }

  const showContractsGroup = query.length >= 2

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contracts or commands..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching..." : "No results found."}
        </CommandEmpty>

        {/* Contract search results */}
        {showContractsGroup && (
          <>
            <CommandGroup heading="Contracts">
              {results.length === 0 && !searching ? (
                <CommandItem disabled>
                  No contracts found for &quot;{query}&quot;
                </CommandItem>
              ) : (
                results.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`contract-${r.id}`}
                    onSelect={() => run(() => router.push(`/contracts/${r.id}`))}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="truncate">{r.title}</span>
                    </div>
                    <ContractStatusBadge status={r.status} />
                  </CommandItem>
                ))
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => run(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to Dashboard
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/contracts"))}>
            <FileText className="mr-2 h-4 w-4" />
            Go to Contracts
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/search"))}>
            <Search className="mr-2 h-4 w-4" />
            Go to Search
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/settings/org"))}>
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => router.push("/contracts/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            New Contract
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push(`/search${query ? `?q=${encodeURIComponent(query)}` : ``}`))}>
            <Search className="mr-2 h-4 w-4" />
            Search Contracts
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => run(() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") } }))}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
