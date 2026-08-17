/**
 * Batch file import handler — covers BATCH_FILES (ZIP or multi-upload via S3
 * manifest) and GOOGLE_DRIVE (download from Drive API, otherwise identical).
 */
import type { ImportJob } from "@prisma/client"

import { getWorkerPrisma } from "@/lib/db/worker-client"
import { storage } from "@/lib/storage"
import { createImportedContractForRow, recordImportRowFailure, sanitizeFilename } from "../create-contract"
import { readBoundedResponseBody } from "../bounded-response"
import { detectFileKind, mimeForKind } from "../magic-bytes"
import { downloadDriveFile } from "../gdrive-client"
import { safeUnzipSync, ZipBombError } from "../zip-safety"
import type { ImportProcessContext } from "../processor"

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_FILES = 50

export async function runBatchHandler(
  job: ImportJob,
  ctx: ImportProcessContext,
): Promise<void> {
  if (job.source === "GOOGLE_DRIVE") {
    return handleGoogleDrive(job, ctx)
  }

  if (!job.storageKey) {
    throw new Error("BATCH_FILES import job is missing storageKey")
  }

  if (job.storageKey.endsWith(".zip")) {
    return handleZip(job, ctx)
  }

  // Multi-file upload — manifest.json
  return handleManifest(job, ctx)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface FileLike {
  buffer: Buffer
  filename: string
  sourceRef: string
  errorMessage?: string
}

interface NormalizedManifestEntry {
  filename: string
  storageKey: string
  sizeBytes: number
}

export function normalizeBatchManifest(
  value: unknown,
  context: { organizationId: string; jobId: string },
): NormalizedManifestEntry[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { files?: unknown }).files)
      ? (value as { files: unknown[] }).files
      : null
  if (!entries) throw new Error("manifest_invalid")
  if (entries.length === 0 || entries.length > MAX_FILES) throw new Error("manifest_invalid")

  const expectedPrefix = `imports/${context.organizationId}/${context.jobId}/files/`
  const seenKeys = new Set<string>()

  return entries.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("manifest_invalid")
    const candidate = entry as { filename?: unknown; storageKey?: unknown; key?: unknown; sizeBytes?: unknown }
    const filename = candidate.filename
    const storageKey = candidate.storageKey ?? candidate.key
    const sizeBytes = candidate.sizeBytes
    if (
      typeof filename !== "string" ||
      !filename.trim() ||
      typeof storageKey !== "string" ||
      !storageKey.startsWith(expectedPrefix) ||
      seenKeys.has(storageKey) ||
      typeof sizeBytes !== "number" ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 0 ||
      sizeBytes > MAX_FILE_BYTES
    ) {
      throw new Error("manifest_invalid")
    }
    seenKeys.add(storageKey)
    return { filename, storageKey, sizeBytes }
  })
}

async function processFiles(
  job: ImportJob,
  ctx: ImportProcessContext,
  files: Iterable<FileLike> | AsyncIterable<FileLike>,
): Promise<void> {
  const db = getWorkerPrisma()
  let succeeded = 0
  let failed = 0
  let totalRows = 0

  for await (const f of files) {
    totalRows += 1
    const rowIndex = totalRows
    if (rowIndex > MAX_FILES) {
      await db.importRow.upsert({
        where: { jobId_rowIndex: { jobId: job.id, rowIndex } },
        create: {
          jobId: job.id,
          rowIndex,
          sourceRef: f.sourceRef,
          status: "skipped",
          errorMessage: "batch_limit_exceeded",
        },
        update: {
          sourceRef: f.sourceRef,
          status: "skipped",
          errorMessage: "batch_limit_exceeded",
        },
      })
      continue
    }
    const existing = await db.importRow.findFirst({
      where: { jobId: job.id, rowIndex, status: "success" },
      select: { id: true },
    })
    if (existing) {
      succeeded += 1
      continue
    }
    try {
      if (f.errorMessage) {
        throw new Error(f.errorMessage)
      }
      if (f.buffer.length > MAX_FILE_BYTES) {
        throw new Error("file_too_large")
      }
      const kind = detectFileKind(f.buffer, f.filename)
      if (kind !== "pdf" && kind !== "docx") {
        throw new Error("unsupported_file_type")
      }
      const titleBase = stripExtension(f.filename).replace(/[_\-]+/g, " ").trim() || "Untitled"

      await createImportedContractForRow(
        {
          title: titleBase.slice(0, 500),
          file: {
            buffer: f.buffer,
            filename: f.filename,
            mimeType: mimeForKind(kind),
            sizeBytes: f.buffer.length,
          },
        },
        { organizationId: ctx.organizationId, ownerId: ctx.createdById },
        { jobId: job.id, rowIndex, sourceRef: f.sourceRef },
      )
      succeeded += 1
    } catch (err) {
      const errorMessage = (err as Error).message || "unknown_error"
      await recordImportRowFailure({ jobId: job.id, rowIndex, sourceRef: f.sourceRef }, errorMessage)
      failed += 1
    }

    // Stream progress every file so the UI poll sees it grow.
    if ((succeeded + failed) % 5 === 0) {
      await db.importJob.update({
        where: { id: job.id },
        data: { succeededRows: succeeded, failedRows: failed },
      })
    }
  }

  await db.importJob.update({
    where: { id: job.id },
    data: {
      totalRows,
      succeededRows: succeeded,
      failedRows: failed,
    },
  })
}

function stripExtension(name: string): string {
  return name.replace(/\.(pdf|docx|PDF|DOCX)$/, "")
}

// ─── ZIP path ────────────────────────────────────────────────────────────────

async function handleZip(job: ImportJob, ctx: ImportProcessContext): Promise<void> {
  const url = await storage.getSignedDownloadUrl(job.storageKey!, 600)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download ZIP from storage: ${res.status}`)
  }
  const zipBuffer = Buffer.from(await res.arrayBuffer())

  let entries: ReturnType<typeof safeUnzipSync>
  try {
    // safeUnzipSync rejects entries by declared size (and skips non pdf/docx
    // entries) BEFORE inflating them, so a decompression bomb never gets
    // fully decompressed into memory.
    entries = safeUnzipSync(zipBuffer, {
      accept: (path) => {
        if (shouldSkipEntry(path)) return false
        const lower = path.toLowerCase()
        return lower.endsWith(".pdf") || lower.endsWith(".docx")
      },
    })
  } catch (err) {
    if (err instanceof ZipBombError) {
      const db = getWorkerPrisma()
      await db.importJob.update({
        where: { id: job.id },
        data: { status: "FAILED", completedAt: new Date() },
      })
      throw new Error(`total_size_too_large: ${err.message}`)
    }
    throw new Error(`zip_extract_failed: ${(err as Error).message}`)
  }

  const paths = Object.keys(entries)
  if (paths.length === 0) {
    throw new Error("no_valid_files_in_zip")
  }
  function* candidates(): Generator<FileLike> {
    for (const path of paths) {
      const content = entries[path]
      delete entries[path]
      yield { buffer: Buffer.from(content), filename: basename(path), sourceRef: path }
    }
  }
  await processFiles(job, ctx, candidates())
}

function shouldSkipEntry(path: string): boolean {
  if (path.startsWith("__MACOSX/")) return true
  if (path.includes("/.DS_Store") || path.endsWith(".DS_Store")) return true
  // Zip-slip protection — anything that escapes the archive root is hostile.
  if (path.startsWith("/") || path.includes("../") || path.includes("..\\")) return true
  if (path.endsWith("/")) return true // directory entries
  return false
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(idx + 1) : path
}

// ─── Manifest path (multi-file POST) ─────────────────────────────────────────

async function handleManifest(job: ImportJob, ctx: ImportProcessContext): Promise<void> {
  const url = await storage.getSignedDownloadUrl(job.storageKey!, 600)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download manifest from storage: ${res.status}`)
  }
  const manifest = normalizeBatchManifest(await res.json(), {
    organizationId: ctx.organizationId,
    jobId: job.id,
  })

  async function* files(): AsyncGenerator<FileLike> {
    for (const entry of manifest) {
      const dlUrl = await storage.getSignedDownloadUrl(entry.storageKey, 600)
      const dlRes = await fetch(dlUrl)
      if (!dlRes.ok) {
        // Tag this entry as failed without aborting the run — manifest entries
        // are independent.
        yield { buffer: Buffer.alloc(0), filename: entry.filename, sourceRef: entry.storageKey }
        continue
      }
      try {
        const buffer = await readBoundedResponseBody(dlRes)
        yield { buffer, filename: entry.filename, sourceRef: entry.storageKey }
      } catch (err) {
        yield {
          buffer: Buffer.alloc(0),
          filename: entry.filename,
          sourceRef: entry.storageKey,
          errorMessage: (err as Error).message || "download_failed",
        }
      }
    }
  }
  await processFiles(job, ctx, files())
}

// ─── Google Drive path ───────────────────────────────────────────────────────

async function handleGoogleDrive(job: ImportJob, ctx: ImportProcessContext): Promise<void> {
  const db = getWorkerPrisma()
  if (!job.driveFileIds) {
    throw new Error("GOOGLE_DRIVE import is missing driveFileIds")
  }

  const integration = await db.googleDriveIntegration.findUnique({
    where: { organizationId: ctx.organizationId },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
    },
  })
  if (!integration) {
    throw new Error("google_drive_not_connected")
  }
  const connectedIntegration = integration

  const fileIds = job.driveFileIds.split(",").map((s) => s.trim()).filter(Boolean)
  if (fileIds.length === 0) {
    throw new Error("no_files_selected")
  }
  async function* files(): AsyncGenerator<FileLike> {
    for (const fileId of fileIds) {
      try {
        const dl = await downloadDriveFile(connectedIntegration, fileId)
        yield {
          buffer: dl.buffer,
          filename: sanitizeFilename(dl.name),
          sourceRef: `drive:${fileId}`,
        }
      } catch (err) {
        // Record an immediate failure row through the normal per-file path.
        yield {
          buffer: Buffer.alloc(0),
          filename: `drive_${fileId}.bin`,
          sourceRef: `drive:${fileId}:${(err as Error).message}`,
        }
      }
    }
  }
  await processFiles(job, ctx, files())
}
