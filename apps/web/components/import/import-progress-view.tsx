"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, AlertCircle, Loader2, FileWarning, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ImportJobDetail } from "./types"
import { useTranslations } from "next-intl"

interface ImportProgressViewProps {
  jobId: string
  onComplete?: () => void
  onReset?: () => void
}

export function ImportProgressView({ jobId, onComplete, onReset }: ImportProgressViewProps) {
  const t = useTranslations("import.progress")
  const [detail, setDetail] = useState<ImportJobDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    completedRef.current = false

    async function poll() {
      try {
        const res = await fetch(`/api/import/${jobId}`)
        if (!res.ok) {
          throw new Error(t("loadStatusError", { status: res.status }))
        }
        const data: ImportJobDetail = await res.json()
        if (cancelled) return
        setDetail(data)
        setError(null)
        if (
          (data.job.status === "COMPLETED" || data.job.status === "FAILED") &&
          !completedRef.current
        ) {
          completedRef.current = true
          onComplete?.()
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : t("loadFailed"))
      }
    }

    poll()
    const interval = setInterval(() => {
      if (completedRef.current) return
      poll()
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId, onComplete, t])

  if (error && !detail) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading")}
      </div>
    )
  }

  const { job } = detail
  const isFinished = job.status === "COMPLETED" || job.status === "FAILED"
  const total = Math.max(job.totalRows, 1)
  const processed = job.succeededRows + job.failedRows
  const percent = job.totalRows === 0 ? 0 : Math.min(100, Math.round((processed / total) * 100))

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {job.status === "PENDING" && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
            {job.status === "PROCESSING" && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
            {job.status === "COMPLETED" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {job.status === "FAILED" && <AlertCircle className="h-4 w-4 text-destructive" />}
            <span className="text-sm font-medium text-zinc-900">
              {t(`status.${job.status}`)}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            {t("processed", { processed, total: job.totalRows || "?" })}
          </span>
        </div>

        <Progress value={percent} className="bg-zinc-100" />

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-zinc-500">{t("total")}</div>
            <div className="font-semibold text-zinc-900">{job.totalRows}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">{t("succeeded")}</div>
            <div className="font-semibold text-emerald-700">{job.succeededRows}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">{t("failed")}</div>
            <div className="font-semibold text-destructive">{job.failedRows}</div>
          </div>
        </div>

        {isFinished && (
          <div className="pt-2 border-t border-zinc-200 flex flex-wrap items-center gap-2">
            {job.failedRows > 0 && (
              <a
                href={`/api/import/${jobId}/error-report`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm">
                  <FileWarning className="h-4 w-4" />
                  {t("downloadReport")}
                </Button>
              </a>
            )}
            <Link href="/contracts">
              <Button size="sm">
                {t("viewContracts")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
            {onReset && (
              <Button size="sm" variant="ghost" onClick={onReset}>
                {t("startAnother")}
              </Button>
            )}
          </div>
        )}
      </div>

      {isFinished && job.failedRows > 0 && detail.rows.some((r) => r.status === "failed") && (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-500 uppercase">
            {t("failedRows")}
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">{t("row")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("source")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("error")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows
                  .filter((r) => r.status === "failed")
                  .slice(0, 50)
                  .map((row) => (
                    <tr key={row.rowIndex} className="border-t border-zinc-100">
                      <td className="px-4 py-2 text-zinc-500">{row.rowIndex}</td>
                      <td className="px-4 py-2 text-zinc-700 truncate max-w-xs">{row.sourceRef}</td>
                      <td className="px-4 py-2 text-destructive">{row.errorMessage}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
