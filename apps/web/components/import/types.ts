export type ImportSource = "CSV" | "BATCH_FILES" | "GOOGLE_DRIVE" | "PANDADOC" | "CLM_EXPORT"
export type ImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"

export interface ImportJob {
  id: string
  source: ImportSource
  status: ImportStatus
  totalRows: number
  succeededRows: number
  failedRows: number
  errorReportKey: string | null
  createdAt: string
  completedAt: string | null
  createdBy: { name: string }
}

export interface ImportRow {
  rowIndex: number
  sourceRef: string
  status: string
  contractId: string | null
  errorMessage: string | null
}

export interface ImportJobDetail {
  job: ImportJob & { errorReportKey: string | null }
  rows: ImportRow[]
}

export const SOURCE_LABEL: Record<ImportSource, string> = {
  CSV: "Spreadsheet",
  BATCH_FILES: "Batch Files",
  GOOGLE_DRIVE: "Google Drive",
  PANDADOC: "PandaDoc",
  CLM_EXPORT: "CLM Export",
}

export const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "(ignore)" },
  { value: "title", label: "Contract title *" },
  { value: "contractType", label: "Contract type" },
  { value: "counterpartyName", label: "Counterparty name" },
  { value: "counterpartyContact", label: "Counterparty email" },
  { value: "value", label: "Contract value" },
  { value: "currency", label: "Currency" },
  { value: "startDate", label: "Start date" },
  { value: "endDate", label: "End date" },
  { value: "renewalDate", label: "Renewal date" },
  { value: "noticePeriodDays", label: "Notice period (days)" },
  { value: "autoRenewal", label: "Auto-renewal" },
  { value: "notes", label: "Notes" },
  { value: "status", label: "Status" },
]

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
