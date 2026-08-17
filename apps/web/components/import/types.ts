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

export const FIELD_OPTIONS = [
  "", "title", "contractType", "counterpartyName", "counterpartyContact", "value",
  "currency", "startDate", "endDate", "renewalDate", "noticePeriodDays", "autoRenewal",
  "notes", "status",
] as const

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
