"use client"

import { useRef, useState } from "react"
import { Upload, X, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploadZone({ onFileSelect, accept = ".pdf,.docx", className }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<File | null>(null)

  function handleFile(file: File) {
    setSelected(file)
    onFileSelect(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function clear() {
    setSelected(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  if (selected) {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3", className)}>
        <FileText className="h-5 w-5 text-zinc-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 truncate">{selected.name}</p>
          <p className="text-xs text-zinc-500">{formatBytes(selected.size)}</p>
        </div>
        <button type="button" onClick={clear} className="text-zinc-400 hover:text-zinc-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 cursor-pointer transition-colors hover:bg-zinc-100 hover:border-zinc-400",
        dragging && "border-indigo-400 bg-indigo-50",
        className
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-white border border-zinc-200">
        <Upload className="h-5 w-5 text-zinc-400" />
      </div>
      <div className="text-center">
        <p className="text-sm text-zinc-600">
          Drag and drop a file here, or{" "}
          <span className="text-indigo-600 font-medium">click to browse</span>
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">PDF or DOCX up to 50 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
