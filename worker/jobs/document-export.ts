import { randomUUID } from "node:crypto"
import { Prisma, type DocumentExportArtifact } from "@prisma/client"
import type { Job } from "bullmq"
import { authorizedDocumentExportSource, documentExportAttemptStorageKey, isOwnedDocumentExportStorageKey, type DocumentExportArtifactBinding, type DocumentExportContent } from "@/lib/jobs/document-export-access"
import { assertDocumentExportOutputSize, DOCUMENT_EXPORT_CLEANUP_BATCH_SIZE, DOCUMENT_EXPORT_CLEANUP_LEASE_SECONDS, getDocumentExportRetentionSeconds } from "@/lib/jobs/document-export-lifecycle"
import type { DocumentExportCleanupJobData, DocumentExportJobData } from "@/lib/jobs/queues"

type ExportDb = Prisma.TransactionClient & {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: { isolationLevel?: "ReadCommitted" | "Serializable" }): Promise<T>
}
type ExportStorage = { upload(key: string, body: Buffer, contentType: string, options?: { abortSignal?: AbortSignal }): Promise<string>; delete(key: string): Promise<void> }
type ExportDependencies = { db: ExportDb; storage: ExportStorage; toDocx: (content: DocumentExportContent) => Promise<Buffer>; toPdf: (content: DocumentExportContent) => Promise<Buffer>; now?: () => Date }
const MAX_TIMER_DELAY_MS = 2_147_483_647

const artifactSelect = { jobId: true, organizationId: true, contractId: true, requestedByMemberId: true, requestedById: true, documentId: true, documentVersion: true, documentContentHash: true, format: true, expiresAt: true, state: true, storageKey: true } as const

function bindingOf(artifact: Pick<DocumentExportArtifact, "jobId" | "organizationId" | "contractId" | "requestedByMemberId" | "requestedById" | "documentId" | "documentVersion" | "documentContentHash" | "format" | "expiresAt">): DocumentExportArtifactBinding {
  if (artifact.format !== "docx" && artifact.format !== "pdf") throw new Error("Document export artifact is malformed")
  return { ...artifact, format: artifact.format }
}

async function lockArtifact(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  await tx.$queryRaw`SELECT "jobId" FROM "DocumentExportArtifact" WHERE "jobId" = ${jobId} FOR UPDATE`
}

async function beginAttempt(db: ExportDb, jobId: string, now: Date) {
  return db.$transaction(async (tx) => {
    await lockArtifact(tx, jobId)
    const artifact = await tx.documentExportArtifact.findUnique({ where: { jobId }, select: artifactSelect })
    if (!artifact) throw new Error("Document export job is unbound")
    if (artifact.state === "READY" && artifact.storageKey && artifact.expiresAt > now) return { kind: "ready" as const, artifact, storageKey: artifact.storageKey }
    if (artifact.state !== "QUEUED" || artifact.expiresAt <= now) throw new Error("Document export is unavailable")
    const binding = bindingOf(artifact)
    const content = await authorizedDocumentExportSource(tx, binding, true)
    if (!content) {
      await tx.documentExportArtifact.update({
        where: { jobId },
        data: { state: "FAILED", cleanupError: null },
      })
      return { kind: "denied" as const }
    }
    const attemptId = randomUUID()
    const storageKey = documentExportAttemptStorageKey(binding, attemptId)
    await tx.documentExportAttempt.create({
      data: {
        id: attemptId,
        artifactJobId: jobId,
        storageKey,
        leaseExpiresAt: new Date(artifact.expiresAt.getTime() + DOCUMENT_EXPORT_CLEANUP_LEASE_SECONDS * 1_000),
      },
    })
    return { kind: "attempt" as const, artifact, binding, content, attemptId, storageKey }
  }, { isolationLevel: "ReadCommitted" })
}

async function failBeforeUpload(db: ExportDb, jobId: string, attemptId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockArtifact(tx, jobId)
    await tx.documentExportAttempt.updateMany({ where: { id: attemptId, artifactJobId: jobId, state: "UPLOADING" }, data: { state: "CLEANED", cleanedAt: new Date(), cleanupError: null } })
    await tx.documentExportArtifact.updateMany({ where: { jobId, state: "QUEUED" }, data: { state: "FAILED", cleanupError: null } })
  }, { isolationLevel: "ReadCommitted" }).catch(() => undefined)
}

async function recordCleanupResult(db: ExportDb, jobId: string, attemptId: string, claimId: string, cleaned: boolean): Promise<void> {
  const result = await db.documentExportAttempt.updateMany({
    where: { id: attemptId, artifactJobId: jobId, state: "CLEANUP_PENDING", cleanupClaimId: claimId },
    data: cleaned
      ? { state: "CLEANED", cleanedAt: new Date(), cleanupError: null, cleanupClaimId: null }
      : { state: "CLEANUP_FAILED", cleanedAt: null, cleanupError: "object_cleanup_failed", cleanupClaimId: null },
  })
  if (result.count !== 1) throw new Error("Document export cleanup claim was lost")
  if (!cleaned) await db.documentExportArtifact.updateMany({ where: { jobId }, data: { cleanupError: "object_cleanup_failed" } })
}

async function claimAttemptForCleanup(db: ExportDb, attempt: { id: string; artifactJobId: string; state: string }, now: Date, force: boolean): Promise<string | null> {
  const claimId = randomUUID()
  const claimed = await db.documentExportAttempt.updateMany({
    where: {
      id: attempt.id,
      artifactJobId: attempt.artifactJobId,
      ...(force
        ? { state: attempt.state as never, cleanupClaimId: null }
        : { OR: [
            { state: "UPLOADING", leaseExpiresAt: { lte: now } },
            { state: "WINNER" },
            // A failed delete or an upload with an unknown acknowledgement can
            // still settle after the first cleanup call. Honour the renewed
            // lease before another delete so a late remote PUT cannot recreate
            // an object after the final cleanup attempt.
            { state: "CLEANUP_FAILED", leaseExpiresAt: { lte: now } },
            { state: "CLEANUP_PENDING", leaseExpiresAt: { lte: now } },
          ] }),
    },
    data: {
      state: "CLEANUP_PENDING",
      cleanedAt: null,
      cleanupError: null,
      cleanupClaimId: claimId,
      leaseExpiresAt: new Date(now.getTime() + DOCUMENT_EXPORT_CLEANUP_LEASE_SECONDS * 1_000),
    },
  })
  return claimed.count === 1 ? claimId : null
}

async function cleanupAttemptObject(dependencies: Pick<ExportDependencies, "db" | "storage">, artifact: Pick<DocumentExportArtifact, "jobId" | "organizationId" | "contractId">, attemptId: string, storageKey: string, claimId: string): Promise<boolean> {
  if (!isOwnedDocumentExportStorageKey(storageKey, artifact)) {
    await recordCleanupResult(dependencies.db, artifact.jobId, attemptId, claimId, false).catch(() => undefined)
    return false
  }
  try {
    await dependencies.storage.delete(storageKey)
    await recordCleanupResult(dependencies.db, artifact.jobId, attemptId, claimId, true)
    return true
  } catch {
    await recordCleanupResult(dependencies.db, artifact.jobId, attemptId, claimId, false).catch(() => undefined)
    return false
  }
}

async function cleanupOwnAttempt(dependencies: Pick<ExportDependencies, "db" | "storage" | "now">, artifact: Pick<DocumentExportArtifact, "jobId" | "organizationId" | "contractId">, attemptId: string, storageKey: string): Promise<boolean> {
  const attempt = await dependencies.db.documentExportAttempt.findUnique({ where: { id: attemptId }, select: { id: true, artifactJobId: true, state: true } })
  if (!attempt) return false
  const claimId = await claimAttemptForCleanup(dependencies.db, attempt, dependencies.now?.() ?? new Date(), true)
  return claimId ? cleanupAttemptObject(dependencies, artifact, attemptId, storageKey, claimId) : false
}

function abortAt(deadline: Date): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    const remaining = deadline.getTime() - Date.now()
    if (remaining <= 0) return controller.abort()
    timer = setTimeout(schedule, Math.min(remaining, MAX_TIMER_DELAY_MS))
  }
  schedule()
  return { signal: controller.signal, cancel: () => { if (timer) clearTimeout(timer) } }
}

export async function processDocumentExportJob(job: Pick<Job<DocumentExportJobData>, "id" | "data">, dependencies: ExportDependencies): Promise<{ storageKey: string; contentType: string }> {
  const actualJobId = job.id
  if (!actualJobId || job.data.jobId !== actualJobId || Object.keys(job.data).some((key) => key !== "jobId")) throw new Error("Document export job is unbound")
  const started = await beginAttempt(dependencies.db, actualJobId, dependencies.now?.() ?? new Date())
  if (started.kind === "denied") throw new Error("Document export is no longer authorized or its source changed")
  if (started.kind === "ready") return { storageKey: started.storageKey, contentType: started.artifact.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }

  const contentType = started.binding.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  let buffer: Buffer
  try {
    buffer = started.binding.format === "docx" ? await dependencies.toDocx(started.content) : await dependencies.toPdf(started.content)
    assertDocumentExportOutputSize(buffer)
  } catch {
    await failBeforeUpload(dependencies.db, actualJobId, started.attemptId)
    throw new Error("Document export generation failed")
  }

  const stillAuthorized = await dependencies.db.$transaction((tx) => authorizedDocumentExportSource(tx, started.binding, true), { isolationLevel: "ReadCommitted" })
  if (!stillAuthorized || started.binding.expiresAt <= (dependencies.now?.() ?? new Date())) {
    await failBeforeUpload(dependencies.db, actualJobId, started.attemptId)
    throw new Error("Document export is no longer authorized or its source changed")
  }

  const uploadAbort = abortAt(started.binding.expiresAt)
  try {
    await dependencies.storage.upload(started.storageKey, buffer, contentType, { abortSignal: uploadAbort.signal })
  } catch {
    await dependencies.db.$transaction(async (tx) => {
      await lockArtifact(tx, actualJobId)
      await tx.documentExportAttempt.updateMany({
        where: { id: started.attemptId, state: "UPLOADING" },
        data: { state: "CLEANUP_FAILED", cleanupError: "upload_ack_unknown", cleanupClaimId: null },
      })
      await tx.documentExportArtifact.updateMany({ where: { jobId: actualJobId, state: "QUEUED" }, data: { state: "FAILED" } })
    }, { isolationLevel: "ReadCommitted" }).catch(() => undefined)
    throw new Error("Document export publication failed")
  } finally {
    uploadAbort.cancel()
  }

  try {
    const result = await dependencies.db.$transaction(async (tx) => {
      await lockArtifact(tx, actualJobId)
      const current = await tx.documentExportArtifact.findUnique({ where: { jobId: actualJobId }, select: artifactSelect })
      if (!current) return { kind: "ambiguous" as const }
      if (current.state === "READY" && current.storageKey) return { kind: current.storageKey === started.storageKey ? "winner" as const : "loser" as const, storageKey: current.storageKey }
      if (current.state !== "QUEUED") return { kind: "loser" as const, storageKey: null }
      if (current.expiresAt <= (dependencies.now?.() ?? new Date()) || !await authorizedDocumentExportSource(tx, bindingOf(current), true)) {
        await tx.documentExportArtifact.update({ where: { jobId: actualJobId }, data: { state: "FAILED" } })
        return { kind: "loser" as const, storageKey: null }
      }
      const attempt = await tx.documentExportAttempt.findUnique({ where: { id: started.attemptId }, select: { state: true, storageKey: true } })
      if (!attempt || attempt.state !== "UPLOADING" || attempt.storageKey !== started.storageKey) {
        await tx.documentExportArtifact.update({ where: { jobId: actualJobId }, data: { state: "FAILED" } })
        return { kind: "loser" as const, storageKey: null }
      }
      await tx.documentExportArtifact.update({ where: { jobId: actualJobId }, data: { state: "READY", storageKey: started.storageKey, publishedAt: new Date(), cleanupError: null } })
      await tx.documentExportAttempt.update({ where: { id: started.attemptId }, data: { state: "WINNER" } })
      await tx.activity.create({ data: { id: `document-export:${actualJobId}`, contractId: current.contractId, userId: current.requestedById, action: "DOCUMENT_EXPORTED", detail: `Exported as ${current.format.toUpperCase()}`, metadata: { jobId: actualJobId, documentVersion: current.documentVersion } } })
      return { kind: "winner" as const, storageKey: started.storageKey }
    }, { isolationLevel: "ReadCommitted" })
    if (result.kind === "winner") return { storageKey: result.storageKey, contentType }
    await cleanupOwnAttempt(dependencies, started.artifact, started.attemptId, started.storageKey)
    if (result.kind === "loser" && result.storageKey) return { storageKey: result.storageKey, contentType }
    throw new Error("Document export publication failed")
  } catch (error) {
    const current = await dependencies.db.documentExportArtifact.findUnique({ where: { jobId: actualJobId }, select: { state: true, storageKey: true } }).catch(() => null)
    if (current?.state === "READY" && current.storageKey === started.storageKey) return { storageKey: started.storageKey, contentType }
    if (current?.state === "READY" && current.storageKey) {
      await cleanupOwnAttempt(dependencies, started.artifact, started.attemptId, started.storageKey)
      return { storageKey: current.storageKey, contentType }
    }
    await dependencies.db.documentExportAttempt.updateMany({
      where: { id: started.attemptId, state: "UPLOADING" },
      data: { state: "CLEANUP_FAILED", cleanupError: "publication_ack_unknown", cleanupClaimId: null },
    }).catch(() => undefined)
    throw error instanceof Error && error.message === "Document export publication failed" ? error : new Error("Document export publication failed")
  }
}

export async function processDocumentExportCleanup(_job: Pick<Job<DocumentExportCleanupJobData>, "data">, dependencies: Pick<ExportDependencies, "db" | "storage" | "now">): Promise<{ inspected: number; cleaned: number; failed: number; purged: number }> {
  const now = dependencies.now?.() ?? new Date()
  const artifacts = await dependencies.db.$transaction((tx) => tx.$queryRaw<DocumentExportArtifact[]>`
    WITH candidates AS (
      SELECT "jobId" FROM "DocumentExportArtifact"
      WHERE "expiresAt" <= ${now}
        AND (
          "state" IN ('QUEUED', 'READY', 'FAILED', 'EXPIRING')
          OR ("state" = 'EXPIRED' AND EXISTS (
            SELECT 1 FROM "DocumentExportAttempt" AS pending_attempt
            WHERE pending_attempt."artifactJobId" = "DocumentExportArtifact"."jobId"
              AND pending_attempt."state" <> 'CLEANED'
          ))
        )
      ORDER BY "expiresAt" ASC LIMIT ${DOCUMENT_EXPORT_CLEANUP_BATCH_SIZE} FOR UPDATE SKIP LOCKED
    )
    UPDATE "DocumentExportArtifact" AS artifact
      SET "state" = CASE WHEN artifact."state" = 'READY' THEN 'EXPIRING'::"DocumentExportArtifactState" ELSE artifact."state" END, "updatedAt" = NOW()
    FROM candidates WHERE artifact."jobId" = candidates."jobId" RETURNING artifact.*
  `, { isolationLevel: "ReadCommitted" })
  let cleaned = 0
  let failed = 0
  let claimed = 0
  for (const artifact of artifacts) {
    const remainingBudget = DOCUMENT_EXPORT_CLEANUP_BATCH_SIZE - claimed
    const attempts = remainingBudget > 0
      ? await dependencies.db.documentExportAttempt.findMany({ where: { artifactJobId: artifact.jobId, state: { not: "CLEANED" } }, take: remainingBudget })
      : []
    for (const attempt of attempts) {
      const claimId = await claimAttemptForCleanup(dependencies.db, attempt, now, false)
      if (!claimId) continue
      claimed += 1
      if (await cleanupAttemptObject(dependencies, artifact, attempt.id, attempt.storageKey, claimId)) cleaned += 1
      else failed += 1
    }
    await dependencies.db.$transaction(async (tx) => {
      await lockArtifact(tx, artifact.jobId)
      const remaining = await tx.documentExportAttempt.count({ where: { artifactJobId: artifact.jobId, state: { not: "CLEANED" } } })
      if (remaining === 0) await tx.documentExportArtifact.updateMany({ where: { jobId: artifact.jobId, expiresAt: { lte: now }, state: { in: ["QUEUED", "FAILED", "EXPIRING"] } }, data: { state: "EXPIRED", storageKey: null, cleanedAt: now, cleanupError: null } })
    }, { isolationLevel: "ReadCommitted" })
  }
  const purgeBefore = new Date(now.getTime() - getDocumentExportRetentionSeconds() * 1_000)
  const purged = await dependencies.db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ jobId: string }>>`
      SELECT artifact."jobId" FROM "DocumentExportArtifact" AS artifact
      WHERE artifact."state" = 'EXPIRED' AND artifact."cleanedAt" <= ${purgeBefore}
        AND NOT EXISTS (SELECT 1 FROM "DocumentExportAttempt" AS attempt WHERE attempt."artifactJobId" = artifact."jobId" AND attempt."state" <> 'CLEANED')
      ORDER BY artifact."cleanedAt" ASC LIMIT ${DOCUMENT_EXPORT_CLEANUP_BATCH_SIZE} FOR UPDATE SKIP LOCKED
    `
    if (rows.length === 0) return 0
    return (await tx.documentExportArtifact.deleteMany({ where: { jobId: { in: rows.map((row) => row.jobId) }, state: "EXPIRED" } })).count
  }, { isolationLevel: "ReadCommitted" })
  return { inspected: artifacts.length, cleaned, failed, purged }
}
