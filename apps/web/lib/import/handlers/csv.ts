/**
 * CSV import handler.
 *
 * Streams the CSV from S3, applies the user-supplied column mapping (stored
 * on ImportJob.mappingJson), validates each row, and creates contracts via
 * createImportedContract. Per-row failures don't halt the batch — they
 * write `status: failed` to the corresponding ImportRow with a specific
 * error message, and we keep going.
 */
import { parse } from "csv-parse/sync"
import type { ImportJob } from "@prisma/client"

import { getWorkerPrisma } from "@/lib/db/worker-client"
import { storage } from "@/lib/storage"
import { createImportedContractForRow, recordImportRowFailure } from "../create-contract"
import {
  parseImportDate,
  parseBoolean,
  parseNumber,
  parseInteger,
  parseCurrency,
} from "../parse-utils"
import {
  IMPORT_FIELDS,
  isImportField,
  type ImportField,
} from "../csv-mapping"
import type { ImportProcessContext } from "../processor"

type Mapping = Partial<Record<string, ImportField>>

const VALID_CONTRACT_TYPES = new Set([
  "NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER",
])

const VALID_STATUSES = new Set([
  "DRAFT", "INTERNAL_REVIEW", "PENDING_APPROVAL", "AWAITING_SIGNATURE",
  "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED",
])

export async function runCsvHandler(
  job: ImportJob,
  ctx: ImportProcessContext,
): Promise<void> {
  const db = getWorkerPrisma()

  if (!job.storageKey) {
    throw new Error("CSV import job is missing storageKey")
  }

  // 1. Download the CSV from S3.
  const url = await storage.getSignedDownloadUrl(job.storageKey, 600)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download CSV from storage: ${res.status}`)
  }
  const text = await res.text()

  // 2. Parse with csv-parse/sync — files are <= 10MB, fully in memory is fine.
  let records: Record<string, string>[]
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[]
  } catch (err) {
    throw new Error(`csv_parse_failed: ${(err as Error).message}`)
  }

  // 3. Build mapping. mappingJson is { "CSV Header": "clauseflowField" | null }.
  let rawMapping: Record<string, unknown> = {}
  if (job.mappingJson) {
    try {
      rawMapping = JSON.parse(job.mappingJson) as Record<string, unknown>
    } catch {
      throw new Error("invalid_mapping_json")
    }
  }
  const mapping: Mapping = {}
  for (const [header, field] of Object.entries(rawMapping)) {
    if (isImportField(field)) {
      mapping[header] = field
    }
  }

  // 4. Resolve title column up front — required.
  const titleHeader = Object.entries(mapping).find(([, f]) => f === "title")?.[0]
  if (!titleHeader) {
    throw new Error("title_not_mapped")
  }

  // 5. Process rows. Update totalRows now that we've counted.
  await db.importJob.update({
    where: { id: job.id },
    data: { totalRows: records.length },
  })

  let succeeded = 0
  let failed = 0

  for (let i = 0; i < records.length; i++) {
    const rowIndex = i + 1
    const row = records[i]
    const sourceRef = JSON.stringify(row).slice(0, 1000)

    // Idempotency: skip rows that already succeeded on a prior run (retry).
    const existing = await db.importRow.findFirst({
      where: { jobId: job.id, rowIndex, status: "success" },
      select: { id: true },
    })
    if (existing) {
      succeeded += 1
      continue
    }

    try {
      const data = mapRow(row, mapping)
      await createImportedContractForRow(
        data,
        { organizationId: ctx.organizationId, ownerId: ctx.createdById },
        { jobId: job.id, rowIndex, sourceRef },
      )
      succeeded += 1
    } catch (err) {
      const message = (err as Error)?.message || "unknown_error"
      await recordImportRowFailure({ jobId: job.id, rowIndex, sourceRef }, message)
      failed += 1
    }

    // Stream progress every 50 rows so the UI's polling sees live progress.
    if ((succeeded + failed) % 50 === 0) {
      await db.importJob.update({
        where: { id: job.id },
        data: { succeededRows: succeeded, failedRows: failed },
      })
    }
  }

  await db.importJob.update({
    where: { id: job.id },
    data: { succeededRows: succeeded, failedRows: failed, totalRows: records.length },
  })
}

function mapRow(row: Record<string, string>, mapping: Mapping) {
  const data: Record<string, unknown> = {}

  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue
    const raw = row[header]
    if (raw == null) continue
    const value = String(raw).trim()
    if (!value) continue

    switch (field) {
      case "title": {
        if (!value) throw new Error("title: required")
        if (value.length > 500) throw new Error("title: exceeds 500 characters")
        data.title = value
        break
      }
      case "contractType": {
        const upper = value.toUpperCase()
        if (!VALID_CONTRACT_TYPES.has(upper)) {
          throw new Error(`contractType: '${value}' is not a valid type`)
        }
        data.contractType = upper
        break
      }
      case "counterpartyName":
        data.counterpartyName = value
        break
      case "counterpartyContact":
        data.counterpartyContact = value
        break
      case "value": {
        const n = parseNumber(value)
        if (n == null || n < 0) throw new Error(`value: '${value}' is not a valid positive number`)
        data.value = n
        break
      }
      case "currency": {
        const c = parseCurrency(value)
        if (!c) throw new Error(`currency: '${value}' must be 3 uppercase letters`)
        data.currency = c
        break
      }
      case "startDate": {
        const d = parseImportDate(value)
        if (!d) throw new Error(`startDate: '${value}' is not a valid date`)
        data.startDate = d
        break
      }
      case "endDate": {
        const d = parseImportDate(value)
        if (!d) throw new Error(`endDate: '${value}' is not a valid date`)
        data.endDate = d
        break
      }
      case "renewalDate": {
        const d = parseImportDate(value)
        if (!d) throw new Error(`renewalDate: '${value}' is not a valid date`)
        data.renewalDate = d
        break
      }
      case "noticePeriodDays": {
        const n = parseInteger(value)
        if (n == null || n < 0) {
          throw new Error(`noticePeriodDays: '${value}' must be a non-negative integer`)
        }
        data.noticePeriodDays = n
        break
      }
      case "autoRenewal": {
        const b = parseBoolean(value)
        if (b == null) {
          throw new Error(`autoRenewal: '${value}' must be true/false/yes/no/1/0`)
        }
        data.autoRenewal = b
        break
      }
      case "notes":
        data.notes = value
        break
      case "status": {
        const upper = value.toUpperCase()
        if (!VALID_STATUSES.has(upper)) {
          // Spec: default DRAFT if unrecognized — soft-fall instead of hard-failing.
          data.status = "DRAFT"
        } else {
          data.status = upper
        }
        break
      }
    }
  }

  if (typeof data.title !== "string" || !data.title) {
    throw new Error("title: required")
  }
  return data as { title: string } & Record<string, unknown>
}

/** Persist a batch of row outcomes using the retry-safe unique key. */
export async function flushOutcomes(
  jobId: string,
  outcomes: Array<{
    rowIndex: number
    sourceRef: string
    status: "success" | "failed"
    errorMessage?: string
    contractId?: string
  }>,
): Promise<void> {
  if (outcomes.length === 0) return
  const db = getWorkerPrisma()
  for (const outcome of outcomes) {
    await db.importRow.upsert({
      where: { jobId_rowIndex: { jobId, rowIndex: outcome.rowIndex } },
      create: {
        jobId,
        rowIndex: outcome.rowIndex,
        sourceRef: outcome.sourceRef,
        status: outcome.status,
        errorMessage: outcome.errorMessage,
        contractId: outcome.contractId ?? null,
      },
      update: {
        sourceRef: outcome.sourceRef,
        status: outcome.status,
        errorMessage: outcome.errorMessage ?? null,
        contractId: outcome.contractId ?? null,
      },
    })
  }
}

// Re-export for tests.
export { IMPORT_FIELDS }
