/**
 * Generic CLM export ZIP import handler — supports ContractBook and DocuSign CLM
 * formats. Format auto-detection looks at the archive's directory layout.
 */
import { unzipSync } from "fflate"
import { parse as parseCsv } from "csv-parse/sync"
import { DOMParser } from "@xmldom/xmldom"
import type { ImportJob } from "@prisma/client"

import { getWorkerPrisma } from "@/lib/db/worker-client"
import { storage } from "@/lib/storage"
import { createImportedContract } from "../create-contract"
import { detectFileKind, mimeForKind } from "../magic-bytes"
import { parseImportDate, parseCurrency, parseNumber } from "../parse-utils"
import type { ImportProcessContext } from "../processor"

const MAX_DOCUMENTS = 50

type ZipEntries = ReturnType<typeof unzipSync>

export async function runClmExportHandler(
  job: ImportJob,
  ctx: ImportProcessContext,
): Promise<void> {
  if (!job.storageKey) {
    throw new Error("CLM export import job is missing storageKey")
  }

  const url = await storage.getSignedDownloadUrl(job.storageKey, 600)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download ZIP from storage: ${res.status}`)
  }
  const zipBuffer = Buffer.from(await res.arrayBuffer())

  let entries: ZipEntries
  try {
    entries = unzipSync(zipBuffer)
  } catch (err) {
    throw new Error(`zip_extract_failed: ${(err as Error).message}`)
  }

  // Honor explicit format hint if it was passed via mappingJson
  // (the API layer stores `{ "format": "contractbook" | "docusign" | "auto" }`).
  let formatHint: "contractbook" | "docusign" | "auto" = "auto"
  if (job.mappingJson) {
    try {
      const parsed = JSON.parse(job.mappingJson) as { format?: string }
      if (parsed.format === "contractbook" || parsed.format === "docusign") {
        formatHint = parsed.format
      }
    } catch {
      // ignore — fall back to auto-detect
    }
  }

  const detected = formatHint === "auto" ? detectFormat(entries) : formatHint
  if (!detected) {
    throw new Error("unknown_clm_export_format")
  }

  if (detected === "contractbook") {
    await runContractBook(entries, job, ctx)
  } else {
    await runDocuSign(entries, job, ctx)
  }
}

function detectFormat(entries: ZipEntries): "contractbook" | "docusign" | null {
  const paths = Object.keys(entries)

  const hasContractsCsv = paths.some(
    (p) => p === "contracts.csv" || p === "metadata.csv" || /^[^/]+\/contracts\.csv$/.test(p),
  )
  const hasContractsFolder = paths.some((p) => p.startsWith("contracts/"))
  if (hasContractsCsv && hasContractsFolder) return "contractbook"

  const hasDocumentsFolder = paths.some((p) => p.startsWith("documents/"))
  if (hasDocumentsFolder) {
    const hasMeta = paths.some((p) => /^documents\/[^/]+\/metadata\.(json|xml)$/.test(p))
    if (hasMeta) return "docusign"
  }

  return null
}

// ─── ContractBook ────────────────────────────────────────────────────────────

const CB_STATUS_MAP: Record<string, string> = {
  active: "ACTIVE",
  signed: "ACTIVE",
  draft: "DRAFT",
  expired: "EXPIRED",
  terminated: "TERMINATED",
}

async function runContractBook(
  entries: ZipEntries,
  job: ImportJob,
  ctx: ImportProcessContext,
): Promise<void> {
  // Find the CSV (root-level only — spec).
  const csvPath = Object.keys(entries).find(
    (p) => p === "contracts.csv" || p === "metadata.csv",
  )
  if (!csvPath) {
    throw new Error("contractbook_csv_not_found")
  }

  const csvContent = entries[csvPath]
  const csvText = Buffer.from(csvContent).toString("utf8")
  let records: Record<string, string>[]
  try {
    records = parseCsv(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[]
  } catch (err) {
    throw new Error(`contractbook_csv_parse_failed: ${(err as Error).message}`)
  }

  if (records.length === 0) {
    throw new Error("contractbook_no_rows")
  }

  // Index PDFs by their normalized base filename for matching.
  const pdfIndex = new Map<string, { path: string; buffer: Buffer }>()
  for (const [path, content] of Object.entries(entries)) {
    if (!path.startsWith("contracts/")) continue
    if (!path.toLowerCase().endsWith(".pdf")) continue
    const name = path.slice("contracts/".length)
    pdfIndex.set(normalizeMatchKey(stripExt(name)), {
      path,
      buffer: Buffer.from(content),
    })
  }

  const db = getWorkerPrisma()
  await db.importJob.update({
    where: { id: job.id },
    data: { totalRows: records.length },
  })

  let succeeded = 0
  let failed = 0
  const head = records.slice(0, MAX_DOCUMENTS)

  for (let i = 0; i < head.length; i++) {
    const rowIndex = i + 1
    const row = head[i]
    try {
      const title = (row.Title ?? "").trim()
      if (!title) throw new Error("title: required (Title column)")

      const value = parseNumber(row["Contract value"])
      const currency = parseCurrency(row.Currency) || "USD"
      const startDate = parseImportDate(row["Signed at"])
      const endDate = parseImportDate(row["Expiry date"])
      const cbStatus = (row.Status ?? "").trim().toLowerCase()
      const status = CB_STATUS_MAP[cbStatus] ?? "DRAFT"

      // Match a PDF by title (case-insensitive, special-char-stripped).
      const matchKey = normalizeMatchKey(title)
      const matched = pdfIndex.get(matchKey)
      let file
      if (matched) {
        const kind = detectFileKind(matched.buffer, matched.path)
        if (kind === "pdf" || kind === "docx") {
          file = {
            buffer: matched.buffer,
            filename: matched.path.split("/").pop() || `${title}.pdf`,
            mimeType: mimeForKind(kind),
            sizeBytes: matched.buffer.length,
          }
        }
      }

      const contractId = await createImportedContract(
        {
          title: title.slice(0, 500),
          counterpartyName: row.Counterparty?.trim() || undefined,
          value: value ?? undefined,
          currency,
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,
          status,
          file,
        },
        { organizationId: ctx.organizationId, ownerId: ctx.createdById },
      )

      await db.importRow.create({
        data: {
          jobId: job.id,
          rowIndex,
          sourceRef: title,
          status: "success",
          contractId,
        },
      })
      succeeded += 1
    } catch (err) {
      await db.importRow.create({
        data: {
          jobId: job.id,
          rowIndex,
          sourceRef: row.Title ?? `row_${rowIndex}`,
          status: "failed",
          errorMessage: (err as Error).message || "unknown_error",
        },
      })
      failed += 1
    }
  }

  for (let i = MAX_DOCUMENTS; i < records.length; i++) {
    await db.importRow.create({
      data: {
        jobId: job.id,
        rowIndex: i + 1,
        sourceRef: records[i].Title ?? `row_${i + 1}`,
        status: "skipped",
        errorMessage: "batch_limit_exceeded",
      },
    })
  }

  await db.importJob.update({
    where: { id: job.id },
    data: {
      totalRows: records.length,
      succeededRows: succeeded,
      failedRows: failed,
    },
  })
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "")
}

function normalizeMatchKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

// ─── DocuSign CLM ────────────────────────────────────────────────────────────

const DS_STATUS_MAP: Record<string, string> = {
  EXECUTED: "ACTIVE",
  VOIDED: "TERMINATED",
  DECLINED: "TERMINATED",
  IN_PROCESS: "DRAFT",
}

interface DocuSignMetadata {
  documentName?: string
  status?: string
  effectiveDate?: string
  expirationDate?: string
  parties?: Array<{ partyName?: string; partyType?: string }>
  documentAmount?: number
  currencyCode?: string
}

async function runDocuSign(
  entries: ZipEntries,
  job: ImportJob,
  ctx: ImportProcessContext,
): Promise<void> {
  // Group entries by `documents/{guid}/` directory.
  const dirs = new Map<
    string,
    {
      dir: string
      metadata: DocuSignMetadata | null
      pdfBuffer: Buffer | null
      pdfName: string | null
    }
  >()

  for (const [path, content] of Object.entries(entries)) {
    if (!path.startsWith("documents/")) continue
    const rest = path.slice("documents/".length)
    const slash = rest.indexOf("/")
    if (slash <= 0) continue
    const guid = rest.slice(0, slash)
    const file = rest.slice(slash + 1).toLowerCase()
    const dirKey = `documents/${guid}`

    let entry = dirs.get(dirKey)
    if (!entry) {
      entry = { dir: dirKey, metadata: null, pdfBuffer: null, pdfName: null }
      dirs.set(dirKey, entry)
    }

    if (file === "metadata.json") {
      try {
        entry.metadata = JSON.parse(Buffer.from(content).toString("utf8")) as DocuSignMetadata
      } catch {
        entry.metadata = null
      }
    } else if (file === "metadata.xml" && !entry.metadata) {
      entry.metadata = parseDocuSignXml(Buffer.from(content).toString("utf8"))
    } else if (file.endsWith(".pdf")) {
      entry.pdfBuffer = Buffer.from(content)
      entry.pdfName = file
    }
  }

  const candidates = Array.from(dirs.values()).filter((e) => e.metadata != null)
  if (candidates.length === 0) {
    throw new Error("docusign_no_documents")
  }

  const db = getWorkerPrisma()
  await db.importJob.update({
    where: { id: job.id },
    data: { totalRows: candidates.length },
  })

  const head = candidates.slice(0, MAX_DOCUMENTS)
  let succeeded = 0
  let failed = 0

  for (let i = 0; i < head.length; i++) {
    const rowIndex = i + 1
    const doc = head[i]
    try {
      const meta = doc.metadata!
      const title = (meta.documentName || doc.dir.split("/").pop() || "Untitled").slice(0, 500)

      const counterparty =
        meta.parties?.find((p) => p.partyType === "Counterparty")?.partyName ||
        meta.parties?.[0]?.partyName ||
        undefined

      const value =
        typeof meta.documentAmount === "number" && Number.isFinite(meta.documentAmount)
          ? meta.documentAmount
          : undefined
      const currency = parseCurrency(meta.currencyCode) || "USD"

      const startDate = meta.effectiveDate ? parseImportDate(meta.effectiveDate) : null
      const endDate = meta.expirationDate ? parseImportDate(meta.expirationDate) : null

      const status = DS_STATUS_MAP[(meta.status ?? "").toUpperCase()] ?? "DRAFT"

      let file
      if (doc.pdfBuffer && doc.pdfName) {
        const kind = detectFileKind(doc.pdfBuffer, doc.pdfName)
        if (kind === "pdf" || kind === "docx") {
          file = {
            buffer: doc.pdfBuffer,
            filename: doc.pdfName,
            mimeType: mimeForKind(kind),
            sizeBytes: doc.pdfBuffer.length,
          }
        }
      }

      const contractId = await createImportedContract(
        {
          title,
          counterpartyName: counterparty,
          value,
          currency,
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,
          status,
          file,
        },
        { organizationId: ctx.organizationId, ownerId: ctx.createdById },
      )

      await db.importRow.create({
        data: {
          jobId: job.id,
          rowIndex,
          sourceRef: doc.dir,
          status: "success",
          contractId,
        },
      })
      succeeded += 1
    } catch (err) {
      await db.importRow.create({
        data: {
          jobId: job.id,
          rowIndex,
          sourceRef: doc.dir,
          status: "failed",
          errorMessage: (err as Error).message || "unknown_error",
        },
      })
      failed += 1
    }
  }

  for (let i = MAX_DOCUMENTS; i < candidates.length; i++) {
    await db.importRow.create({
      data: {
        jobId: job.id,
        rowIndex: i + 1,
        sourceRef: candidates[i].dir,
        status: "skipped",
        errorMessage: "batch_limit_exceeded",
      },
    })
  }

  await db.importJob.update({
    where: { id: job.id },
    data: {
      totalRows: candidates.length,
      succeededRows: succeeded,
      failedRows: failed,
    },
  })
}

function parseDocuSignXml(xml: string): DocuSignMetadata | null {
  try {
    const doc = new DOMParser({
      errorHandler: () => {},
    }).parseFromString(xml, "text/xml")

    const text = (tag: string): string | undefined => {
      const el = doc.getElementsByTagName(tag).item(0)
      const v = el?.textContent?.trim()
      return v && v.length > 0 ? v : undefined
    }

    const parties: Array<{ partyName?: string; partyType?: string }> = []
    const partyEls = doc.getElementsByTagName("party")
    for (let i = 0; i < partyEls.length; i++) {
      const p = partyEls.item(i)!
      const nameEl = p.getElementsByTagName("partyName").item(0)
      const typeEl = p.getElementsByTagName("partyType").item(0)
      parties.push({
        partyName: nameEl?.textContent?.trim() || undefined,
        partyType: typeEl?.textContent?.trim() || undefined,
      })
    }

    const amountStr = text("documentAmount")
    const amount = amountStr ? parseNumber(amountStr) : null

    return {
      documentName: text("documentName"),
      status: text("status"),
      effectiveDate: text("effectiveDate"),
      expirationDate: text("expirationDate"),
      parties: parties.length > 0 ? parties : undefined,
      documentAmount: amount ?? undefined,
      currencyCode: text("currencyCode"),
    }
  } catch {
    return null
  }
}
