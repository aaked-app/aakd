"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
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
import { useLocale, useTranslations } from "next-intl"

interface ImportHistoryProps {
  refreshKey?: number
}

const RETRY_ERROR_CODES = new Set(["job_not_finished", "no_failed_rows", "retry_already_queued", "queue_unavailable"])

export function ImportHistory({ refreshKey }: ImportHistoryProps) {
  const t = useTranslations("import")
  const locale = useLocale()
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, ImportRow[]>>({})
  const [retrying, setRetrying] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      setLoadError(false)
      const res = await fetch("/api/import?limit=10")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } catch {
      setLoadError(true)
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
        toast.error(t("detailsLoadError"))
      }
    }
  }

  async function retry(jobId: string) {
    if (!confirm(t("retryConfirm"))) return
    setRetrying(jobId)
    try {
      const res = await fetch(`/api/import/${jobId}/retry`, { method: "POST" })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: unknown }
        const code = typeof errBody.error === "string" && RETRY_ERROR_CODES.has(errBody.error)
          ? errBody.error
          : "unknown"
        throw new Error(t(`retryErrors.${code}`))
      }
      toast.success(t("retryQueued"))
      fetchJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("retryError"))
    } finally {
      setRetrying(null)
    }
  }

  function statusBadge(status: ImportJob["status"]) {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">{t("status.PENDING")}</Badge>
      case "PROCESSING":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Loader2 className="h-3 w-3 animate-spin" /> {t("status.PROCESSING")}
          </Badge>
        )
      case "COMPLETED":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{t("status.COMPLETED")}</Badge>
      case "FAILED":
        return <Badge variant="destructive">{t("status.FAILED")}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("history")}</h2>
        <button
          type="button"
          onClick={fetchJobs}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label={t("refresh")}
        >
          {t("refresh")}
        </button>
      </div>
      {loadError && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span>{t("loadError")}</span>
          <Button variant="outline" size="sm" onClick={fetchJobs}>{t("tryAgain")}</Button>
        </div>
      )}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("sourceLabel")}</TableHead>
              <TableHead>{t("statusLabel")}</TableHead>
              <TableHead className="text-end">{t("succeeded")}</TableHead>
              <TableHead className="text-end">{t("failed")}</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-zinc-500">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const isOpen = expanded === job.id
                const isFinished = job.status === "COMPLETED" || job.status === "FAILED"
                return (
                  <Fragment key={job.id}>
                    <TableRow>
                      <TableCell>
                        {job.failedRows > 0 ? (
                          <button type="button" onClick={() => toggleExpand(job.id)} aria-expanded={isOpen} aria-label={t(isOpen ? "collapseFailures" : "expandFailures")} className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400 rtl:rotate-180" />}
                          </button>
                        ) : (
                          <span className="block w-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-700">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.createdAt))}
                      </TableCell>
                      <TableCell className="text-zinc-700">{t(`source.${job.source}`)}</TableCell>
                      <TableCell>{statusBadge(job.status)}</TableCell>
                      <TableCell className="text-end text-zinc-700">{job.succeededRows}</TableCell>
                      <TableCell className={`text-end ${job.failedRows > 0 ? "text-destructive" : "text-zinc-700"}`}>
                        {job.failedRows}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {job.failedRows > 0 && job.errorReportKey && (
                            <a
                              href={`/api/import/${job.id}/error-report`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={t("downloadErrorReport")}
                              className="text-zinc-400 hover:text-zinc-900 p-1"
                            >
                              <FileWarning className="h-4 w-4" />
                            </a>
                          )}
                          {isFinished && job.failedRows > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-zinc-900"
                              onClick={() => retry(job.id)}
                              disabled={retrying === job.id}
                              aria-label={t("retryFailures")}
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
                              <Loader2 className="h-3 w-3 animate-spin" /> {t("loadingFailures")}
                            </div>
                          ) : details[job.id].length === 0 ? (
                            <p className="text-xs text-zinc-500 py-2">{t("noFailedRows")}</p>
                          ) : (
                            <div className="max-h-60 overflow-y-auto py-2">
                              <table className="w-full text-xs">
                                <thead className="text-zinc-500">
                                  <tr>
                                    <th className="px-2 py-1 text-start font-medium">{t("row")}</th>
                                    <th className="px-2 py-1 text-start font-medium">{t("sourceLabel")}</th>
                                    <th className="px-2 py-1 text-start font-medium">{t("error")}</th>
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
      <div className="grid gap-3 md:hidden">
        {loading && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>}
        {!loading && !loadError && jobs.length === 0 && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("empty")}</div>}
        {!loading && !loadError && jobs.map((job) => {
          const isFinished = job.status === "COMPLETED" || job.status === "FAILED"
          return (
            <article key={job.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium text-foreground">{t(`source.${job.source}`)}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.createdAt))}</p></div>
                {statusBadge(job.status)}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">{t("succeeded")}</dt><dd className="mt-1 font-medium">{job.succeededRows}</dd></div><div><dt className="text-xs text-muted-foreground">{t("failed")}</dt><dd className="mt-1 font-medium text-destructive">{job.failedRows}</dd></div></dl>
              {job.failedRows > 0 && job.errorReportKey && <a href={`/api/import/${job.id}/error-report`} target="_blank" rel="noreferrer" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">{t("downloadErrorReport")}</a>}
              {isFinished && job.failedRows > 0 && <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => retry(job.id)} disabled={retrying === job.id}>{t("retryFailures")}</Button>}
            </article>
          )
        })}
      </div>
    </div>
  )
}
