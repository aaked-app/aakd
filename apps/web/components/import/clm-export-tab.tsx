"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dropzone } from "./dropzone"
import { ImportProgressView } from "./import-progress-view"

type ClmFormat = "auto" | "contractbook" | "docusign"

export function ClmExportTab({ onJobCreated }: { onJobCreated?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ClmFormat>("auto")
  const [uploading, setUploading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  async function startImport() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("format", format)
      const res = await fetch("/api/import/clm-export", { method: "POST", body: fd })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Upload failed (${res.status})`)
      }
      const data = await res.json()
      setJobId(data.jobId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start CLM import")
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFile(null)
    setFormat("auto")
    setJobId(null)
  }

  if (jobId) {
    return <ImportProgressView jobId={jobId} onComplete={onJobCreated} onReset={reset} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <p>
          Supported formats: <span className="font-medium">ContractBook</span> export ZIP and{" "}
          <span className="font-medium">DocuSign CLM</span> export ZIP. For other tools, use the Batch Files tab.
        </p>
      </div>

      <Dropzone
        accept=".zip,application/zip"
        selected={file ? [file] : null}
        onClear={() => setFile(null)}
        onFiles={(files) => setFile(files[0] ?? null)}
        hint="ContractBook or DocuSign CLM export ZIP, up to 500 MB"
      />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-zinc-500">Format</p>
        <div className="flex flex-col gap-2">
          {[
            { value: "auto" as const, label: "Auto-detect (recommended)" },
            { value: "contractbook" as const, label: "ContractBook" },
            { value: "docusign" as const, label: "DocuSign CLM" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="clm-format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="text-zinc-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {file && (
        <div className="flex items-center justify-end gap-2">
          <Button onClick={startImport} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
              </>
            ) : (
              "Upload and Import"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
