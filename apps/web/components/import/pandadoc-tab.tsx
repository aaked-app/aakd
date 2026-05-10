"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dropzone } from "./dropzone"
import { ImportProgressView } from "./import-progress-view"

export function PandaDocTab({ onJobCreated }: { onJobCreated?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  async function startImport() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/import/pandadoc", { method: "POST", body: fd })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Upload failed (${res.status})`)
      }
      const data = await res.json()
      setJobId(data.jobId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start PandaDoc import")
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFile(null)
    setJobId(null)
  }

  if (jobId) {
    return <ImportProgressView jobId={jobId} onComplete={onJobCreated} onReset={reset} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-900 mb-1">How to export from PandaDoc</p>
        <p>Go to <span className="font-mono text-xs bg-white px-1 rounded">Settings → Documents → Export All Documents</span>, download the ZIP, then upload it here.</p>
      </div>

      <Dropzone
        accept=".zip,application/zip"
        selected={file ? [file] : null}
        onClear={() => setFile(null)}
        onFiles={(files) => setFile(files[0] ?? null)}
        hint="PandaDoc export ZIP, up to 500 MB"
      />

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
