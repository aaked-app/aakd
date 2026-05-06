"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ContractStatusBadge } from "@/components/contract-status-badge"
import { ContractTypeBadge } from "@/components/contract-type-badge"
import { ContractStatus, ContractType } from "@/lib/types"
import { format } from "date-fns"

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

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const debouncedQuery = useDebounce(query, 300)

  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setTotal(0)
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
      } else {
        setResults([])
        setTotal(0)
      }
    } catch {
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    runSearch(debouncedQuery)
    // Sync the URL ?q= param without a hard navigation
    const params = new URLSearchParams(window.location.search)
    if (debouncedQuery) {
      params.set("q", debouncedQuery)
    } else {
      params.delete("q")
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`
    window.history.replaceState(null, "", newUrl)
  }, [debouncedQuery, runSearch])

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across contract titles, counterparties, notes, and extracted text.
        </p>
      </div>

      {/* Search input */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search contracts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Counterparty</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="rounded-xl border border-border px-4 py-12 text-center text-muted-foreground">
          No results for &quot;{debouncedQuery}&quot;
        </div>
      ) : results.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {total} result{total !== 1 ? "s" : ""} for &quot;{debouncedQuery}&quot;
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Counterparty</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/contracts/${r.id}`)}
                  >
                    <td className="px-4 py-3 font-medium max-w-xs">
                      <span className="line-clamp-1">{r.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ContractTypeBadge type={r.contractType} />
                    </td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.counterpartyName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(r.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Type to search across all your contracts.</p>
        </div>
      )}
    </div>
  )
}
