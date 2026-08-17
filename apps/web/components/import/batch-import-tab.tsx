"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dropzone } from "./dropzone"
import { ImportProgressView } from "./import-progress-view"
import { formatBytes } from "./types"
import { useTranslations } from "next-intl"

const MAX_FILES = 50
const MAX_SINGLE_FILE = 50 * 1024 * 1024
const MAX_TOTAL = 500 * 1024 * 1024

export function BatchImportTab({ onJobCreated }: { onJobCreated?: () => void }) {
  const t = useTranslations("import.batch")
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  function selectFiles(picked: File[]) {
    if (picked.length === 1 && picked[0].name.toLowerCase().endsWith(".zip")) {
      if (picked[0].size > MAX_TOTAL) {
        toast.error(t("zipTooLarge", { size: formatBytes(picked[0].size) }))
        return
      }
      setFiles(picked)
      return
    }
    if (picked.length > MAX_FILES) {
      toast.error(t("tooManyFiles", { count: MAX_FILES }))
      return
    }
    let total = 0
    for (const f of picked) {
      if (f.size > MAX_SINGLE_FILE) {
        toast.error(t("fileTooLarge", { name: f.name }))
        return
      }
      total += f.size
    }
    if (total > MAX_TOTAL) {
      toast.error(t("totalTooLarge", { size: formatBytes(total) }))
      return
    }
    setFiles(picked)
  }

  async function startImport() {
    if (files.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      const isZip = files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")
      if (isZip) {
        fd.append("file", files[0])
      } else {
        for (const f of files) {
          fd.append("files[]", f)
        }
      }
      const res = await fetch("/api/import/batch", { method: "POST", body: fd })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? t("uploadStatusError", { status: res.status }))
      }
      const data = await res.json()
      setJobId(data.jobId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("startFailed"))
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFiles([])
    setJobId(null)
  }

  if (jobId) {
    return <ImportProgressView jobId={jobId} onComplete={onJobCreated} onReset={reset} />
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-600">
        {t("description", { count: MAX_FILES })}
      </div>

      <Dropzone
        accept=".pdf,.docx,.zip,application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        selected={files}
        onClear={() => setFiles([])}
        onFiles={selectFiles}
        hint={t("hint", { count: MAX_FILES })}
      />

      {files.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <Button onClick={startImport} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t("uploading")}
              </>
            ) : (
              files.length === 1 && files[0].name.toLowerCase().endsWith(".zip") ? t("uploadZip") : t("uploadFiles", { count: files.length })
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
