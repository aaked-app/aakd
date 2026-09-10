"use client"

import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeft, Upload, FileText, Loader2, ShieldCheck, ScanText, Check, PenLine } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { buildExtractionSeedPayload } from "@/lib/ai/extraction-seed"
import { useSession, useActiveOrganization } from "@/lib/auth/client"

// ---- Constants ----

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "OTHER"] as const

// ---- Types ----

type PageState = "upload" | "review"

interface FormData {
  title: string
  contractType: string
  counterpartyName: string
  startDate: string
  endDate: string
  value: string
  currency: string
  autoRenewal: boolean
  renewalReminderEnabled: boolean
  renewalDate: string
  noticePeriodDays: string
  governingLaw: string
  description: string
}

const defaultFormData: FormData = {
  title: "",
  contractType: "",
  counterpartyName: "",
  startDate: "",
  endDate: "",
  value: "",
  currency: "USD",
  autoRenewal: false,
  renewalReminderEnabled: true,
  renewalDate: "",
  noticePeriodDays: "",
  governingLaw: "",
  description: "",
}

interface ExtractionResult {
  title?: string | null
  contractType?: string | null
  counterpartyName?: string | null
  startDate?: string | null
  endDate?: string | null
  value?: number | null
  currency?: string | null
  governingLaw?: string | null
  autoRenewal?: boolean
  renewalDate?: string | null
  noticePeriodDays?: number | null
  description?: string | null
  confidence?: Record<string, number>
  error?: string
  partial?: boolean
}

interface ExtractionPreviewPoll {
  status: "pending" | "completed" | "failed" | "expired"
  result?: ExtractionResult
}

// ---- Utility ----

function titleCaseFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function waitForPreviewPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const onAbort = () => {
      clearTimeout(timeout)
      reject(new DOMException("Aborted", "AbortError"))
    }
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, 1000)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

// ---- Confidence bar ----

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? "bg-primary" : "bg-amber-500"

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground capitalize">
          {label.replace(/([A-Z])/g, " $1").trim()}
        </span>
        <span className="text-xs font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-zinc-100">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---- Upload Screen ----

function UploadScreen({
  onFileSelected,
}: {
  onFileSelected: (file: File) => void
}) {
  const t = useTranslations("contracts.create")
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")
      if (!isPdf && !isDocx) {
        toast.error(t("uploadHint"))
        return
      }
      setPendingFile(file)
    },
    [t],
  )

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-12">
      <div className="min-w-0 border border-zinc-200 bg-white p-5 sm:p-8">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border border-dashed p-8 text-center transition-colors sm:p-12",
            isDragging
              ? "border-primary bg-emerald-50/40"
              : "border-zinc-300 bg-[#faf9f6] hover:border-primary",
          )}
        >
          <span className="mx-auto mb-5 flex size-10 items-center justify-center border border-zinc-200 bg-white text-zinc-700">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">
            {t("dropTitle")}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {t("uploadHint")}
          </p>

          {pendingFile ? (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-center gap-2 border border-zinc-200 bg-white px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[260px]">
                  {pendingFile.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFileSize(pendingFile.size)}
                </span>
              </div>
              <Button
                onClick={() => onFileSelected(pendingFile)}
                className="min-h-11 w-full"
              >
                {t("continueReview")}
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              className="mt-6 min-h-11"
              onClick={() => inputRef.current?.click()}
            >
              {t("browseFiles")}
            </Button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            aria-label={t("browseFiles")}
            onChange={handleInputChange}
          />
        </div>

        {pendingFile && (
          <button
            type="button"
            className="mt-3 min-h-11 w-full text-center text-xs font-medium text-zinc-600 underline"
            onClick={() => {
              setPendingFile(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
          >
            {t("removeFile")}
          </button>
        )}
      </div>
      <aside className="border border-zinc-200 bg-white p-6" aria-label={t("intakeGuidance")}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{t("beforeUpload")}</p>
        <dl className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
          <div className="py-4"><dt className="font-medium text-zinc-950">{t("acceptedFiles")}</dt><dd className="mt-1 text-xs leading-5 text-zinc-600">{t("acceptedFilesDescription")}</dd></div>
          <div className="py-4"><dt className="font-medium text-zinc-950">{t("reviewControl")}</dt><dd className="mt-1 text-xs leading-5 text-zinc-600">{t("reviewControlDescription")}</dd></div>
        </dl>
        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-zinc-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-800" aria-hidden="true" />{t("uploadPrivacy")}</p>
      </aside>
    </div>
  )
}

// ---- Extracting Screen ----

// ---- Review Screen ----

function ReviewScreen({
  file,
  formData,
  confidence,
  aiExtracting,
  manualReview,
  submitting,
  locked,
  onFormChange,
  onToggleRenewal,
  onToggleRenewalReminder,
  onBack,
  onSubmit,
  onChangeFile,
  onContinueManually,
}: {
  file: File
  formData: FormData
  confidence: Record<string, number>
  aiExtracting: boolean
  manualReview: boolean
  submitting: boolean
  locked: boolean
  onFormChange: (key: keyof FormData, value: string) => void
  onToggleRenewal: () => void
  onToggleRenewalReminder: () => void
  onBack: () => void
  onSubmit: () => void
  onChangeFile: () => void
  onContinueManually: () => void
}) {
  const typeT = useTranslations("contract.types")
  const t = useTranslations("contracts.create")
  const CONTRACT_TYPES = [
    { value: "NDA",        label: typeT("NDA") },
    { value: "MSA",        label: typeT("MSA") },
    { value: "SOW",        label: typeT("SOW") },
    { value: "EMPLOYMENT", label: typeT("EMPLOYMENT") },
    { value: "VENDOR",     label: typeT("VENDOR") },
    { value: "CUSTOMER",   label: typeT("CUSTOMER") },
    { value: "OTHER",      label: typeT("OTHER") },
  ]
  const fileExt = file.name.split(".").pop()?.toUpperCase() ?? "FILE"

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* Two-column layout */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---- Left column: editable form ---- */}
        <fieldset disabled={locked} className="min-w-0 space-y-6">
          {/* Basic Information */}
          <section className="space-y-4 border border-zinc-200 bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("basicInformation")}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="title">
                {t("contractTitle")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                className="min-h-11"
                value={formData.title}
                onChange={(e) => onFormChange("title", e.target.value)}
                placeholder={t("contractTitlePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contractType">{t("contractType")}</Label>
              <Select
                disabled={locked}
                value={formData.contractType}
                onValueChange={(v) => onFormChange("contractType", v ?? "")}
              >
                <SelectTrigger id="contractType" className="min-h-11 w-full">
                  <SelectValue placeholder={t("selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => onFormChange("description", e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
              />
            </div>
          </section>

          {/* Parties */}
          <section className="space-y-4 border border-zinc-200 bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("parties")}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="counterpartyName">{t("counterpartyName")}</Label>
              <Input
                id="counterpartyName"
                className="min-h-11"
                value={formData.counterpartyName}
                onChange={(e) => onFormChange("counterpartyName", e.target.value)}
                placeholder={t("counterpartyPlaceholder")}
              />
            </div>
          </section>

          {/* Timeline */}
          <section className="space-y-4 border border-zinc-200 bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("timeline")}
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">{t("startDate")}</Label>
                <Input
                  id="startDate"
                  type="date"
                  className="min-h-11"
                  value={formData.startDate}
                  onChange={(e) => onFormChange("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">{t("endDate")}</Label>
                <Input
                  id="endDate"
                  type="date"
                  className="min-h-11"
                  value={formData.endDate}
                  onChange={(e) => onFormChange("endDate", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Financial */}
          <section className="space-y-4 border border-zinc-200 bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("financial")}
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="value">{t("contractValue")}</Label>
                <Input
                  id="value"
                  type="number"
                  className="min-h-11"
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => onFormChange("value", e.target.value)}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">{t("currency")}</Label>
                <Select
                  disabled={locked}
                  value={formData.currency}
                  onValueChange={(v) => onFormChange("currency", v ?? "USD")}
                >
                  <SelectTrigger id="currency" className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-Renewal toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("autoRenewal")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("autoRenewalDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleRenewal}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("toggleAutoRenewal")}
                aria-pressed={formData.autoRenewal}
              >
                <span className={cn(
                  "relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors",
                  formData.autoRenewal ? "bg-primary" : "bg-muted",
                )}>
                  <span
                  className={cn(
                    "pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    formData.autoRenewal ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
                  )}
                  />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("fields.renewalDate")}</p>
                <p className="text-xs text-muted-foreground">{t("autoRenewalDescription")}</p>
              </div>
              <button
                type="button"
                onClick={onToggleRenewalReminder}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("fields.renewalDate")}
                aria-pressed={formData.renewalReminderEnabled}
              >
                <span className={cn("relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors", formData.renewalReminderEnabled ? "bg-primary" : "bg-muted")}>
                  <span className={cn("pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform", formData.renewalReminderEnabled ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0")} />
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="governingLaw">{t("governingLaw")}</Label>
              <Input
                id="governingLaw"
                className="min-h-11"
                value={formData.governingLaw}
                onChange={(e) => onFormChange("governingLaw", e.target.value)}
                placeholder={t("governingLawPlaceholder")}
              />
            </div>
          </section>
        </fieldset>

        {/* ---- Right column: AI confidence sidebar ---- */}
        <div className="space-y-4">
          <div className="sticky top-6 space-y-3 border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              {aiExtracting ? <Loader2 className="size-4 shrink-0 animate-spin text-amber-700" aria-hidden="true" /> : manualReview ? <PenLine className="size-4 shrink-0 text-zinc-600" aria-hidden="true" /> : <ScanText className="size-4 shrink-0 text-primary" aria-hidden="true" />}
              <span className="text-sm font-semibold text-zinc-950">{t("extractionReview")}</span>
              <span className="ms-auto border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
                {manualReview ? t("manualMode") : aiExtracting ? t("readingDocument") : t("reviewStatus")}
              </span>
            </div>

            {aiExtracting ? (
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                {t("aiReading")}
              </div>
            ) : Object.keys(confidence).length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {Object.entries(confidence).map(([field, val]) => (
                  <ConfidenceBar key={field} label={t(`fields.${field}`)} value={val} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">
                {t("noConfidence")}
              </p>
            )}

            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              {t("reviewExtractedValues")}
            </p>
            {aiExtracting && (
              <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onContinueManually}>
                {t("continueWithoutExtraction")}
              </Button>
            )}
          </div>

          {/* File card */}
          <div className="space-y-3 border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{file.name}</span>
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground shrink-0">
                {fileExt}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-800"><Check className="size-3.5" aria-hidden="true" />{t("sourceAttached")}</p>
            <button
              type="button"
              onClick={onChangeFile}
              disabled={locked}
              className="inline-flex min-h-11 items-center text-xs text-primary underline hover:no-underline"
            >
              {t("changeFile")}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Bottom action bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button type="button" variant="outline" className="min-h-11" onClick={onBack} disabled={locked}>
            {t("back")}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={onSubmit}
            disabled={submitting || !formData.title.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t(locked ? "retrySave" : "createContract")
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----

export default function NewContractPage() {
  const t = useTranslations("contracts")
  const { data: session } = useSession()
  const { data: activeOrganization } = useActiveOrganization()
  const [pageState, setPageState] = useState<PageState>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [aiExtracting, setAiExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [saveLocked, setSaveLocked] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [manualReview, setManualReview] = useState(false)
  const touchedFieldsRef = useRef<Set<keyof FormData>>(new Set())
  const aiFieldsRef = useRef<Set<keyof FormData>>(new Set())
  const extractionAbortRef = useRef<AbortController | null>(null)
  const pendingRequestId = useRef<string | null>(null)
  const pendingSave = useRef<globalThis.FormData | null>(null)
  const saving = useRef(false)
  const saveWarningRef = useRef<HTMLDivElement | null>(null)
  const storageKey = session?.user.id && activeOrganization?.id
    ? `aakd:intake:${session.user.id}:${activeOrganization.id}` : null

  function forgetSavedRequest() {
    pendingRequestId.current = null
    pendingSave.current = null
    if (storageKey) {
      try { sessionStorage.removeItem(storageKey) } catch { /* Browser storage is optional. */ }
    }
  }

  async function recoverSavedRequest(requestId = pendingRequestId.current) {
    if (!requestId) return false
    setRecovering(true)
    try {
      const res = await fetch(`/api/contracts/intake?requestId=${encodeURIComponent(requestId)}`, {
        credentials: "include", cache: "no-store",
      })
      if (!res.ok) return false
      const saved = await res.json() as { id?: string }
      if (!saved.id) return false
      forgetSavedRequest()
      window.location.assign(`/contracts/${encodeURIComponent(saved.id)}`)
      return true
    } catch {
      return false
    } finally {
      setRecovering(false)
    }
  }

  useEffect(() => {
    if (!storageKey) return
    let stored: string | null = null
    try { stored = sessionStorage.getItem(storageKey) } catch { /* Use in-memory retry when storage is disabled. */ }
    if (!stored || !/^[0-9a-f-]{36}$/i.test(stored)) return
    pendingRequestId.current = stored
    setSaveWarning(t("create.recoveryPending"))
    void recoverSavedRequest(stored)
    // Retry state belongs to this exact signed-in account and organization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => () => extractionAbortRef.current?.abort(), [])
  useEffect(() => {
    if (saveWarning) saveWarningRef.current?.focus()
  }, [saveWarning])

  function updateField(key: keyof FormData, value: string) {
    if (pendingSave.current) return
    touchedFieldsRef.current.add(key)
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRenewal() {
    if (pendingSave.current) return
    touchedFieldsRef.current.add("autoRenewal")
    setFormData((prev) => ({ ...prev, autoRenewal: !prev.autoRenewal }))
  }

  function toggleRenewalReminder() {
    if (pendingSave.current) return
    touchedFieldsRef.current.add("renewalReminderEnabled")
    setFormData((prev) => ({ ...prev, renewalReminderEnabled: !prev.renewalReminderEnabled }))
  }

  async function requestExtraction(selectedFile: File, fallbackTitle: string) {
    const controller = new AbortController()
    extractionAbortRef.current?.abort()
    extractionAbortRef.current = controller
    setAiExtracting(true)
    setExtractionWarning(null)

    try {
      const fd = new globalThis.FormData()
      fd.append("file", selectedFile)

      const res = await fetch("/api/contracts/extract-preview", {
        method: "POST",
        body: fd,
        credentials: "include",
        signal: controller.signal,
      })

      const accepted = await res.json() as { jobId?: string }
      if (!res.ok || !accepted.jobId) throw new Error("Preview could not be queued")

      let extracted: ExtractionResult | null = null
      for (let attempt = 0; attempt < 90; attempt += 1) {
        const poll = await fetch(
          `/api/contracts/extract-preview?jobId=${encodeURIComponent(accepted.jobId)}`,
          { credentials: "include", signal: controller.signal },
        )
        if (!poll.ok) throw new Error("Preview polling failed")
        const status = await poll.json() as ExtractionPreviewPoll
        if (status.status === "completed" && status.result) {
          extracted = status.result
          break
        }
        if (status.status === "failed" || status.status === "expired") {
          throw new Error("Preview processing failed")
        }
        await waitForPreviewPoll(controller.signal)
      }
      if (!extracted) throw new Error("Preview processing timed out")
      controller.signal.throwIfAborted()

      const extractedValues: Partial<FormData> = {
        title: extracted.title ?? undefined,
        contractType: extracted.contractType ?? undefined,
        counterpartyName: extracted.counterpartyName ?? undefined,
        startDate: extracted.startDate?.slice(0, 10) ?? undefined,
        endDate: extracted.endDate?.slice(0, 10) ?? undefined,
        value: extracted.value != null ? String(extracted.value) : undefined,
        currency: extracted.currency ?? undefined,
        autoRenewal: extracted.autoRenewal,
        renewalDate: extracted.renewalDate?.slice(0, 10) ?? undefined,
        noticePeriodDays: extracted.noticePeriodDays != null ? String(extracted.noticePeriodDays) : undefined,
        governingLaw: extracted.governingLaw ?? undefined,
        description: extracted.description ?? undefined,
      }

      for (const [key, value] of Object.entries(extractedValues) as Array<[keyof FormData, FormData[keyof FormData] | undefined]>) {
        if (value !== undefined && value !== null && value !== "") {
          aiFieldsRef.current.add(key)
        }
      }

      setFormData((prev) => {
        const next = { ...prev }
        for (const [key, value] of Object.entries(extractedValues) as Array<[keyof FormData, FormData[keyof FormData] | undefined]>) {
          if (value !== undefined && value !== null && value !== "" && !touchedFieldsRef.current.has(key)) {
            next[key] = value as never
          }
        }
        return next
      })
      setConfidence(Object.fromEntries(Object.entries(extracted.confidence ?? {}).filter(([key]) => key in defaultFormData)))

      if (extracted.error) {
        setExtractionWarning(
          extracted.partial
            ? t("create.partialExtractionWarning")
            : t("create.extractionUnavailable"),
        )
      } else {
        // Preview values are provisional UI assistance. The worker always
        // re-extracts the uploaded source so pending review rows gain exact
        // source text and page evidence before they can be trusted.
        setManualReview(false)
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setExtractionWarning(t("create.continueManually"))
        setFormData((prev) =>
          prev.title ? prev : { ...prev, title: fallbackTitle },
        )
      }
    } finally {
      if (extractionAbortRef.current === controller) {
        extractionAbortRef.current = null
        setAiExtracting(false)
      }
    }
  }

  function handleFileSelected(selectedFile: File) {
    if (pendingSave.current) return
    setFile(selectedFile)
    const fileNameWithoutExt = selectedFile.name.replace(/\.[^.]+$/, "")
    touchedFieldsRef.current.clear()
    aiFieldsRef.current.clear()
    setManualReview(false)
    setFormData({ ...defaultFormData, title: titleCaseFromFilename(fileNameWithoutExt) })
    setConfidence({})
    setPageState("review")
    void requestExtraction(selectedFile, titleCaseFromFilename(fileNameWithoutExt))
  }

  function handleChangeFile() {
    if (pendingSave.current) return
    extractionAbortRef.current?.abort()
    extractionAbortRef.current = null
    touchedFieldsRef.current.clear()
    aiFieldsRef.current.clear()
    setManualReview(false)
    setFile(null)
    setFormData(defaultFormData)
    setConfidence({})
    setAiExtracting(false)
    setPageState("upload")
  }

  function handleContinueManually() {
    extractionAbortRef.current?.abort()
    extractionAbortRef.current = null
    setAiExtracting(false)
    setManualReview(true)
  }

  async function handleSubmit() {
    if (saving.current || recovering) return
    if (!file || !storageKey) {
      setSaveWarning(t("create.sessionNotReady"))
      return
    }
    if (!formData.title.trim()) {
      setSaveWarning(t("create.titleRequired"))
      return
    }

    saving.current = true
    setSubmitting(true)
    extractionAbortRef.current?.abort()
    extractionAbortRef.current = null
    setAiExtracting(false)
    try {
      if (!pendingSave.current) {
      // Helper: only send a date if it's already in YYYY-MM-DD format (what the
      // API expects). AI-extracted dates may arrive in other formats — skip those
      // rather than causing a 422 validation failure.
      const isoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined

      const body: Record<string, unknown> = {
        title: formData.title.trim(),
        contractType: formData.contractType || undefined,
        counterpartyName: formData.counterpartyName || undefined,
        value: formData.value ? Number(formData.value) : undefined,
        // Normalise currency: "OTHER" is a UI-only placeholder; send "USD" instead
        currency: formData.currency === "OTHER" ? "USD" : (formData.currency || "USD"),
        startDate: formData.startDate ? isoDate(formData.startDate) : undefined,
        endDate: formData.endDate ? isoDate(formData.endDate) : undefined,
        renewalDate: formData.renewalDate ? isoDate(formData.renewalDate) : undefined,
        noticePeriodDays: formData.noticePeriodDays ? Number(formData.noticePeriodDays) : undefined,
        governingLaw: formData.governingLaw || undefined,
        autoRenewal: formData.autoRenewal,
        renewalReminderEnabled: formData.renewalReminderEnabled,
        notes: formData.description || undefined,
      }

        // Freeze the file, canonical values and provenance together. Retrying
        // an uncertain response must resend exactly the same intent.
        const seedFields: Array<{ field: keyof FormData; rawValue: string }> = [
          { field: "contractType",     rawValue: formData.contractType },
          { field: "counterpartyName", rawValue: formData.counterpartyName },
          { field: "startDate",        rawValue: formData.startDate },
          { field: "endDate",          rawValue: formData.endDate },
          { field: "value",            rawValue: formData.value },
          { field: "currency",         rawValue: formData.currency === "OTHER" ? "USD" : formData.currency },
          { field: "governingLaw",     rawValue: formData.governingLaw },
          { field: "autoRenewal",      rawValue: String(formData.autoRenewal) },
          { field: "renewalDate",      rawValue: formData.renewalDate },
          { field: "noticePeriodDays", rawValue: formData.noticePeriodDays },
        ]
        const seedPayload = buildExtractionSeedPayload(
          seedFields,
          touchedFieldsRef.current,
          aiFieldsRef.current,
          confidence,
        )

        const fd = new globalThis.FormData()
        fd.append("file", file)
        fd.append("metadata", JSON.stringify(body))
        fd.append("extractions", JSON.stringify(seedPayload))
        pendingRequestId.current ??= crypto.randomUUID()
        fd.append("requestId", pendingRequestId.current)
        pendingSave.current = fd
        try { sessionStorage.setItem(storageKey, pendingRequestId.current) } catch { /* Keep in-memory retry. */ }
      }
      setSaveLocked(true)
      const res = await fetch("/api/contracts/intake", {
        method: "POST", body: pendingSave.current, credentials: "include",
      })
      if (!res.ok) {
        if ([400, 413, 415, 422].includes(res.status)) {
          // These responses reject input before persistence. Keep the request
          // identity, but allow correcting the invalid input.
          pendingSave.current = null
          setSaveLocked(false)
          throw new Error(t("create.invalidIntake"))
        }
        throw new Error(t(res.status === 409 ? "create.intakeConflict" : "create.saveUncertain"))
      }
      const contract = await res.json() as { id?: string; extractionQueued?: boolean; conversionQueued?: boolean }
      if (!contract.id) throw new Error(t("create.saveUncertain"))
      forgetSavedRequest()
      toast.success(t("create.created"))
      if (!contract.extractionQueued || !contract.conversionQueued) toast.warning(t("create.processingDelayed"))
      window.location.assign(`/contracts/${encodeURIComponent(contract.id)}${!contract.extractionQueued || !contract.conversionQueued ? "?processing=delayed" : ""}`)
    } catch (err) {
      const message = err instanceof Error && [t("create.invalidIntake"), t("create.intakeConflict"), t("create.saveUncertain")].includes(err.message)
        ? err.message : t("create.saveUncertain")
      setSaveWarning(message)
    } finally {
      saving.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
          <Link
            href="/contracts"
            className="flex min-h-11 items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("title")}
          </Link>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{t("create.workspaceEyebrow")}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-3xl">{t("create.pageTitle")}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{t("create.pageDescription")}</p>
            </div>
            <ol aria-label={t("create.workflowLabel")} className="grid grid-cols-3 border border-zinc-200 bg-[#faf9f6]">
              {[t("create.stepUpload"), t("create.stepReview"), t("create.stepCreate")].map((step, index) => {
                const active = pageState === "upload" ? index === 0 : index === 1
                return <li key={step} className={cn("min-w-0 border-e border-zinc-200 px-3 py-2.5 text-xs last:border-e-0 sm:min-w-32", active ? "bg-white font-semibold text-zinc-950" : "text-zinc-500")}><span className="me-1.5 text-[10px] tabular-nums">0{index + 1}</span>{step}</li>
              })}
            </ol>
          </div>
        </div>
      </header>

      {/* Page content */}
      {saveWarning && (
        <div ref={saveWarningRef} tabIndex={-1} className="mx-auto my-4 max-w-6xl space-y-2 px-4 sm:px-6" role="status">
          <p className="text-sm text-amber-900">{saveWarning}</p>
          <Button type="button" variant="outline" className="min-h-11" disabled={submitting || recovering} onClick={() => void recoverSavedRequest()}>
            {t(recovering ? "create.checkingSaved" : "create.checkSaved")}
          </Button>
        </div>
      )}
      {pageState === "upload" && (
        <UploadScreen onFileSelected={handleFileSelected} />
      )}
      {pageState === "review" && extractionWarning && (
        <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {extractionWarning}
        </p>
      )}
      {pageState === "review" && file && (
        <ReviewScreen
          file={file}
          formData={formData}
          confidence={confidence}
          aiExtracting={aiExtracting}
          manualReview={manualReview}
          submitting={submitting}
          locked={saveLocked}
          onFormChange={updateField}
          onToggleRenewal={toggleRenewal}
          onToggleRenewalReminder={toggleRenewalReminder}
          onBack={handleChangeFile}
          onSubmit={handleSubmit}
          onChangeFile={handleChangeFile}
          onContinueManually={handleContinueManually}
        />
      )}
    </div>
  )
}
