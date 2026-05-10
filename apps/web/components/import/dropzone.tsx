"use client"

import { useRef, useState } from "react"
import { Upload, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBytes } from "./types"

interface DropzoneProps {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  selected?: File[] | null
  onClear?: () => void
  hint?: string
}

export function Dropzone({ accept, multiple, onFiles, selected, onClear, hint }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handle(files: FileList | null) {
    if (!files || files.length === 0) return
    onFiles(Array.from(files))
  }

  if (selected && selected.length > 0) {
    const totalSize = selected.reduce((acc, f) => acc + f.size, 0)
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {selected.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="truncate text-zinc-900">{f.name}</span>
                <span className="text-xs text-zinc-500 shrink-0">({formatBytes(f.size)})</span>
              </div>
            ))}
            {selected.length > 5 && (
              <p className="text-xs text-zinc-500">+ {selected.length - 5} more files</p>
            )}
            {selected.length > 1 && (
              <p className="text-xs text-zinc-500 pt-1 border-t border-zinc-200">
                {selected.length} files · {formatBytes(totalSize)} total
              </p>
            )}
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 cursor-pointer transition-colors hover:bg-zinc-100 hover:border-zinc-400",
        dragging && "border-indigo-400 bg-indigo-50"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handle(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-white border border-zinc-200">
        <Upload className="h-5 w-5 text-zinc-400" />
      </div>
      <div className="text-center">
        <p className="text-sm text-zinc-600">
          Drag and drop {multiple ? "files" : "a file"} here, or{" "}
          <span className="text-indigo-600 font-medium">click to browse</span>
        </p>
        {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  )
}
