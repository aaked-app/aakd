"use client"

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeft, Upload, Sparkles, FileText, Loader2 } from "lucide-react"
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
  paymentTerms: string
  autoRenewal: boolean
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
  paymentTerms: "",
  autoRenewal: false,
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
  paymentTerms?: string | null
  governingLaw?: string | null
  autoRenewal?: boolean
  renewalDate?: string | null
  noticePeriodDays?: number | null
  description?: string | null
  confidence?: Record<string, number>
  error?: string
  partial?: boolean
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

// ---- Confidence bar ----

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 90
      ? "bg-emerald-500"
      : pct >= 70
        ? "bg-amber-400"
        : "bg-rose-400"

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground capitalize">
          {label.replace(/([A-Z])/g, " $1").trim()}
        </span>
        <span className="text-xs font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
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
      setPendingFile(file)
    },
    [],
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-xl">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-16 text-center transition-colors cursor-default",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50 hover:bg-muted/30",
          )}
        >
          <Upload className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">
            {t("dropTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("uploadHint")}
          </p>

          {pendingFile ? (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
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
                className="w-full"
              >
                {t("continueReview")}
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              className="mt-6"
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
            onChange={handleInputChange}
          />
        </div>

        {pendingFile && (
          <p
            className="mt-3 text-center text-xs text-muted-foreground underline cursor-pointer"
            onClick={() => {
              setPendingFile(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
          >
            {t("removeFile")}
          </p>
        )}
      </div>
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
  submitting,
  onFormChange,
  onToggleRenewal,
  onBack,
  onSubmit,
  onChangeFile,
}: {
  file: File
  formData: FormData
  confidence: Record<string, number>
  aiExtracting: boolean
  submitting: boolean
  onFormChange: (key: keyof FormData, value: string) => void
  onToggleRenewal: () => void
  onBack: () => void
  onSubmit: () => void
  onChangeFile: () => void
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
    <div className="max-w-5xl mx-auto px-4 pb-24">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6 mt-6">
        {/* ---- Left column: editable form ---- */}
        <div className="space-y-6">
          {/* Basic Information */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("basicInformation")}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="title">
                {t("contractTitle")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => onFormChange("title", e.target.value)}
                placeholder={t("contractTitlePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contractType">{t("contractType")}</Label>
              <Select
                value={formData.contractType}
                onValueChange={(v) => onFormChange("contractType", v ?? "")}
              >
                <SelectTrigger id="contractType" className="w-full">
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
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("parties")}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="counterpartyName">{t("counterpartyName")}</Label>
              <Input
                id="counterpartyName"
                value={formData.counterpartyName}
                onChange={(e) => onFormChange("counterpartyName", e.target.value)}
                placeholder={t("counterpartyPlaceholder")}
              />
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("timeline")}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">{t("startDate")}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => onFormChange("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">{t("endDate")}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => onFormChange("endDate", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Financial */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("financial")}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="value">{t("contractValue")}</Label>
                <Input
                  id="value"
                  type="number"
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
                  value={formData.currency}
                  onValueChange={(v) => onFormChange("currency", v ?? "USD")}
                >
                  <SelectTrigger id="currency" className="w-full">
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

            <div className="space-y-1.5">
              <Label htmlFor="paymentTerms">{t("paymentTerms")}</Label>
              <Input
                id="paymentTerms"
                value={formData.paymentTerms}
                onChange={(e) => onFormChange("paymentTerms", e.target.value)}
                placeholder={t("paymentTermsPlaceholder")}
              />
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
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
                  formData.autoRenewal ? "bg-primary" : "bg-muted",
                )}
                aria-label={t("toggleAutoRenewal")}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    formData.autoRenewal ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="governingLaw">{t("governingLaw")}</Label>
              <Input
                id="governingLaw"
                value={formData.governingLaw}
                onChange={(e) => onFormChange("governingLaw", e.target.value)}
                placeholder={t("governingLawPlaceholder")}
              />
            </div>
          </section>
        </div>

        {/* ---- Right column: AI confidence sidebar ---- */}
        <div className="space-y-4">
          {/* AI Extraction card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 sticky top-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">{t("aiExtraction")}</span>
              <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t("poweredByAi")}
              </span>
            </div>

            {aiExtracting ? (
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
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
          </div>

          {/* File card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{file.name}</span>
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground shrink-0">
                {fileExt}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            <button
              type="button"
              onClick={onChangeFile}
              className="text-xs text-primary underline hover:no-underline"
            >
              {t("changeFile")}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Bottom action bar ---- */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            {t("back")}
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !formData.title.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t("createContract")
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
  const [pageState, setPageState] = useState<PageState>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [aiExtracting, setAiExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [previewCompleted, setPreviewCompleted] = useState(false)
  const touchedFieldsRef = useRef<Set<keyof FormData>>(new Set())
  const aiFieldsRef = useRef<Set<keyof FormData>>(new Set())
  const extractionAbortRef = useRef<AbortController | null>(null)

  function updateField(key: keyof FormData, value: string) {
    touchedFieldsRef.current.add(key)
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRenewal() {
    touchedFieldsRef.current.add("autoRenewal")
    setFormData((prev) => ({ ...prev, autoRenewal: !prev.autoRenewal }))
  }

  async function requestExtraction(selectedFile: File, fallbackTitle: string) {
    const controller = new AbortController()
    extractionAbortRef.current?.abort()
    extractionAbortRef.current = controller
    setAiExtracting(true)

    try {
      const fd = new globalThis.FormData()
      fd.append("file", selectedFile)

      const res = await fetch("/api/contracts/extract-preview", {
        method: "POST",
        body: fd,
        credentials: "include",
        signal: controller.signal,
      })

      const extracted: ExtractionResult = await res.json()
      const extractedValues: Partial<FormData> = {
        title: extracted.title ?? undefined,
        contractType: extracted.contractType ?? undefined,
        counterpartyName: extracted.counterpartyName ?? undefined,
        startDate: extracted.startDate?.slice(0, 10) ?? undefined,
        endDate: extracted.endDate?.slice(0, 10) ?? undefined,
        value: extracted.value != null ? String(extracted.value) : undefined,
        currency: extracted.currency ?? undefined,
        paymentTerms: extracted.paymentTerms ?? undefined,
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
      setConfidence(extracted.confidence ?? {})

      if (extracted.error) {
        setPreviewCompleted(false)
        toast.warning(
          extracted.partial
            ? t("create.partialExtractionWarning")
            : t("create.extractionUnavailable"),
        )
      } else {
        // Only skip the worker's authoritative extraction when the preview
        // completed cleanly. Partial/error responses must fall back to the
        // worker so a transient parser failure cannot leave the contract with
        // only the user-entered seed values.
        setPreviewCompleted(true)
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setPreviewCompleted(false)
        toast.error(t("create.continueManually"))
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
    setFile(selectedFile)
    const fileNameWithoutExt = selectedFile.name.replace(/\.[^.]+$/, "")
    touchedFieldsRef.current.clear()
    aiFieldsRef.current.clear()
    setPreviewCompleted(false)
    setFormData({ ...defaultFormData, title: titleCaseFromFilename(fileNameWithoutExt) })
    setConfidence({})
    setPageState("review")
    void requestExtraction(selectedFile, titleCaseFromFilename(fileNameWithoutExt))
  }

  function handleChangeFile() {
    extractionAbortRef.current?.abort()
    extractionAbortRef.current = null
    touchedFieldsRef.current.clear()
    aiFieldsRef.current.clear()
    setPreviewCompleted(false)
    setFile(null)
    setFormData(defaultFormData)
    setConfidence({})
    setAiExtracting(false)
    setPageState("upload")
  }

  async function handleSubmit() {
    if (!formData.title.trim()) {
      toast.error(t("create.titleRequired"))
      return
    }

    setSubmitting(true)
    try {
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
        notes: formData.description || undefined,
      }

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? t("create.createFailed"))
      }

      const contract = (await res.json()) as { id: string }

      if (file) {
        // Persist Pass-1 provenance before uploading the file. The upload
        // enqueues the worker, so doing this first prevents a fast worker from
        // creating an AI row before a user-edited value is recorded as manual.
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

        if (seedPayload.length > 0) {
          const seedRes = await fetch(`/api/contracts/${contract.id}/extractions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ extractions: seedPayload }),
            credentials: "include",
          })
          if (!seedRes.ok) throw new Error(t("create.reviewStateSaveFailed"))
        }

        const fd = new globalThis.FormData()
        fd.append("file", file)
        if (previewCompleted) {
          fd.append("previewCompleted", "true")
        }
        const uploadRes = await fetch(`/api/contracts/${contract.id}/upload`, {
          method: "POST",
          body: fd,
          credentials: "include",
        })
        if (!uploadRes.ok) {
          throw new Error(t("create.fileUploadFailed"))
        }
      }

      toast.success(t("create.created"))
      window.location.assign(`/contracts/${contract.id}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("create.createFailed"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/contracts"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("title")}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-sm font-medium text-foreground">{t("newContract")}</h1>
        </div>
      </div>

      {/* Page content */}
      {pageState === "upload" && (
        <UploadScreen onFileSelected={handleFileSelected} />
      )}
      {pageState === "review" && file && (
        <ReviewScreen
          file={file}
          formData={formData}
          confidence={confidence}
          aiExtracting={aiExtracting}
          submitting={submitting}
          onFormChange={updateField}
          onToggleRenewal={toggleRenewal}
          onBack={handleChangeFile}
          onSubmit={handleSubmit}
          onChangeFile={handleChangeFile}
        />
      )}
    </div>
  )
}
