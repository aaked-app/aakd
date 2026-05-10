"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { format as formatDate } from "date-fns"
import { ChevronDown, ChevronRight, Loader2, RotateCw, FileWarning } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ImportJob, ImportRow, ImportJobDetail } from "./types"
import { SOURCE_LABEL } from "./types"

interface ImportHistoryProps {
  refreshKey?: number
}

export function ImportHistory({ refreshKey }: ImportHistoryProps) {
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, ImportRow[]>>({})
  const [retrying, setRetrying] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/import?limit=10")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } catch {
      // silent — history is auxiliary
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs, refreshKey])

  // Auto-poll while any job is in flight
  useEffect(() => {
    const inFlight = jobs.some((j) => j.status === "PENDING" || j.status === "PROCESSING")
    if (!inFlight) return
    const interval = setInterval(() => fetchJobs(), 5000)
    return () => clearInterval(interval)
  }, [jobs, fetchJobs])

  async function toggleExpand(jobId: string) {
    if (expanded === jobId) {
      setExpanded(null)
      return
    }
    setExpanded(jobId)
    if (!details[jobId]) {
      try {
        const res = await fetch(`/api/import/${jobId}`)
        if (!res.ok) throw new Error()
        const data = (await res.json()) as ImportJobDetail
        setDetails((prev) => ({
          ...prev,
          [jobId]: data.rows.filter((r) => r.status === "failed"),
        }))
      } catch {
        toast.error("Failed to load row details")
      }
    }
  }

  async function retry(jobId: string) {
    if (!confirm("Retry failed rows from this import?")) return
    setRetrying(jobId)
    try {
      const res = await fetch(`/api/import/${jobId}/retry`, { method: "POST" })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Retry failed (${res.status})`)
      }
      toast.success("Retry queued")
      fetchJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to retry import")
    } finally {
      setRetrying(null)
    }
  }

  function statusBadge(status: ImportJob["status"]) {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Pending</Badge>
      case "PROCESSING":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing
          </Badge>
        )
      case "COMPLETED":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Completed</Badge>
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Import history</h2>
        <button
          type="button"
          onClick={fetchJobs}
          className="text-xs text-zinc-500 hover:text-zinc-900"
        >
          Refresh
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Succeeded</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-zinc-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  No imports yet.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const isOpen = expanded === job.id
                const isFinished = job.status === "COMPLETED" || job.status === "FAILED"
                return (
                  <Fragment key={job.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => job.failedRows > 0 && toggleExpand(job.id)}
                    >
                      <TableCell>
                        {job.failedRows > 0 ? (
                          isOpen ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <span className="block w-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-700">
                        {formatDate(new Date(job.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-zinc-700">{SOURCE_LABEL[job.source]}</TableCell>
                      <TableCell>{statusBadge(job.status)}</TableCell>
                      <TableCell className="text-right text-zinc-700">{job.succeededRows}</TableCell>
                      <TableCell className={`text-right ${job.failedRows > 0 ? "text-destructive" : "text-zinc-700"}`}>
                        {job.failedRows}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {job.failedRows > 0 && job.errorReportKey && (
                            <a
                              href={`/api/import/${job.id}/error-report`}
                              target="_blank"
                              rel="noreferrer"
                              title="Download error report"
                              className="text-zinc-400 hover:text-zinc-900 p-1"
                            >
                              <FileWarning className="h-4 w-4" />
                            </a>
                          )}
                          {isFinished && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-zinc-900"
                              onClick={() => retry(job.id)}
                              disabled={retrying === job.id}
                              title="Retry failed rows"
                            >
                              <RotateCw className={`h-3.5 w-3.5 ${retrying === job.id ? "animate-spin" : ""}`} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell />
                        <TableCell colSpan={6} className="bg-zinc-50">
                          {details[job.id] === undefined ? (
                            <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Loading failed rows...
                            </div>
                          ) : details[job.id].length === 0 ? (
                            <p className="text-xs text-zinc-500 py-2">No failed rows.</p>
                          ) : (
                            <div className="max-h-60 overflow-y-auto py-2">
                              <table className="w-full text-xs">
                                <thead className="text-zinc-500">
                                  <tr>
                                    <th className="px-2 py-1 text-left font-medium">Row</th>
                                    <th className="px-2 py-1 text-left font-medium">Source</th>
                                    <th className="px-2 py-1 text-left font-medium">Error</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details[job.id].map((row) => (
                                    <tr key={row.rowIndex} className="border-t border-zinc-200">
                                      <td className="px-2 py-1 text-zinc-500">{row.rowIndex}</td>
                                      <td className="px-2 py-1 text-zinc-700 truncate max-w-xs">{row.sourceRef}</td>
                                      <td className="px-2 py-1 text-destructive">{row.errorMessage}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
