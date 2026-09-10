import { createHash, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { Queue } from "bullmq"
import { request } from "@playwright/test"

const require = createRequire(import.meta.url)
const pg = require("pg") as typeof import("pg")
const { storage } = require("../../lib/storage/index.ts") as typeof import("../../lib/storage")
const { MAX_CONTRACT_FILE_BYTES } = require("../../lib/contracts/file-validation.ts") as typeof import("../../lib/contracts/file-validation")
const { createTextPdf } = require("./pdf-fixture.ts") as typeof import("./pdf-fixture")

if (process.env.AAKD_CONTRACT_EXTRACT_SOURCE_PROBE !== "1") {
  throw new Error("Opt in with AAKD_CONTRACT_EXTRACT_SOURCE_PROBE=1")
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL
const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
if (!baseURL || !databaseUrl || !redisUrl) throw new Error("Source probe requires local web, database, and Redis URLs")
const database = new URL(databaseUrl)
const redis = new URL(redisUrl)
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)
  || !['localhost', '127.0.0.1'].includes(database.hostname)
  || !['localhost', '127.0.0.1'].includes(redis.hostname)
  || !/^aakd_acceptance_[a-z0-9_]+$/.test(database.pathname.slice(1))) {
  throw new Error("Source probe is restricted to a named local acceptance stack")
}

const connection = {
  url: redisUrl,
  maxRetriesPerRequest: null,
  ...(redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
}
const queue = new Queue("contract.extract", { connection })
const embedQueue = new Queue("contract.embed", { connection })
const sql = new pg.Pool({ connectionString: databaseUrl })
const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
const suffix = randomBytes(8).toString("hex")
const email = `source-probe-${suffix}@example.test`
const password = randomBytes(32).toString("base64url")
const objectKeys = new Set<string>()
const organizationIds = new Set<string>()
const probeJobIds: string[] = []

function isStorageNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.name === "NoSuchKey" || candidate.Code === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404
}

async function waitFor(predicate: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function waitForJob(jobId: string, expected: "completed" | "failed") {
  return waitForQueueJob(queue, jobId, expected)
}

async function waitForQueueJob(targetQueue: Queue, jobId: string, expected: "completed" | "failed") {
  await waitFor(async () => {
    const job = await targetQueue.getJob(jobId)
    return job ? await job.getState() === expected : false
  }, `${jobId} to ${expected}`)
}

async function createOrganizationWithContract(label: string, text: string) {
  const organization = await api.post("/api/auth/organization/create", {
    data: { name: `Source Probe ${label} ${suffix}`, slug: `source-probe-${label.toLowerCase()}-${suffix}` },
  })
  if (!organization.ok()) throw new Error(`Organization ${label} creation failed with ${organization.status()}`)
  const organizationId = (await organization.json() as { id: string }).id
  organizationIds.add(organizationId)
  const active = await api.post("/api/auth/organization/set-active", { data: { organizationId } })
  if (!active.ok()) throw new Error(`Organization ${label} activation failed with ${active.status()}`)
  const contractResponse = await api.post("/api/contracts", { data: { title: `Source ${label} ${suffix}` } })
  if (contractResponse.status() !== 201) throw new Error(`Contract ${label} creation failed with ${contractResponse.status()}`)
  const contractId = (await contractResponse.json() as { id: string }).id
  const source = createTextPdf([text])
  const upload = await api.post(`/api/contracts/${contractId}/upload`, { multipart: {
    file: { name: `${label.toLowerCase()}.pdf`, mimeType: "application/pdf", buffer: source },
  } })
  if (upload.status() !== 201) throw new Error(`Contract ${label} upload failed with ${upload.status()}`)
  const file = (await sql.query<{ id: string; storageKey: string; version: number }>(
    `SELECT id, "storageKey", version FROM "ContractFile" WHERE "contractId"=$1 AND "isLatest"=TRUE`, [contractId],
  )).rows[0]
  if (!file) throw new Error(`Contract ${label} source file was not persisted`)
  objectKeys.add(file.storageKey)
  await waitFor(async () => {
    const row = await sql.query<{ extractedText: string | null }>(`SELECT "extractedText" FROM "Contract" WHERE id=$1`, [contractId])
    return row.rows[0]?.extractedText?.includes(text.slice(0, 24)) === true
  }, `${label} initial extraction`)
  return { organizationId, contractId, file, source, text }
}

let proofResult: Record<string, boolean | string> | undefined
let primaryFailure: unknown
try {
  const signup = await api.post("/api/auth/sign-up/email", { data: { name: "Source Probe", email, password } })
  if (!signup.ok()) throw new Error(`Signup failed with ${signup.status()}`)

  const alphaText = "ALPHA SOURCE AGREEMENT IS AUTHORITATIVE FOR THIS CONTRACT AND MUST NEVER RECEIVE FOREIGN BETA CONTENT IN ITS DURABLE EXTRACTION RECORD."
  const betaText = "BETA FOREIGN AGREEMENT BELONGS TO A DIFFERENT ORGANIZATION AND MUST NEVER BE READ OR PERSISTED AS THE ALPHA CONTRACT SOURCE DOCUMENT."
  const alpha = await createOrganizationWithContract("Alpha", alphaText)
  const beta = await createOrganizationWithContract("Beta", betaText)
  await api.post("/api/auth/organization/set-active", { data: { organizationId: alpha.organizationId } })

  await sql.query(
    `UPDATE "Contract" SET "extractedText"=NULL, "isOcrExtracted"=FALSE,
      "extractedSourceFileId"=NULL, "extractedSourceFileVersion"=NULL, "extractedSourceHash"=NULL
     WHERE id=$1`, [alpha.contractId],
  )
  const baselineActivities = Number((await sql.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Activity" WHERE "contractId"=$1 AND action='METADATA_EXTRACTED'`, [alpha.contractId],
  )).rows[0]?.count ?? "0")

  const mismatchId = `source-mismatch-${suffix}`
  probeJobIds.push(mismatchId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    fileId: alpha.file.id, storageKey: beta.file.storageKey, preserveUserFields: true,
  }, { jobId: mismatchId, attempts: 1, removeOnFail: false })
  await waitForJob(mismatchId, "failed")

  const wrongOrganizationId = `source-wrong-org-${suffix}`
  probeJobIds.push(wrongOrganizationId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: beta.organizationId,
    fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
  }, { jobId: wrongOrganizationId, attempts: 1, removeOnFail: false })
  await waitForJob(wrongOrganizationId, "failed")

  const denied = (await sql.query<{ extractedText: string | null; count: string }>(
    `SELECT c."extractedText", COUNT(a.id)::text AS count FROM "Contract" c
     LEFT JOIN "Activity" a ON a."contractId"=c.id AND a.action='METADATA_EXTRACTED'
     WHERE c.id=$1 GROUP BY c.id`, [alpha.contractId],
  )).rows[0]
  if (denied?.extractedText !== null || Number(denied?.count ?? "0") !== baselineActivities) {
    throw new Error("Rejected source identity mutated contract extraction state")
  }

  await storage.upload(alpha.file.storageKey, Buffer.alloc(MAX_CONTRACT_FILE_BYTES + 1), "application/pdf")
  const oversizedId = `source-oversized-${suffix}`
  probeJobIds.push(oversizedId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
  }, { jobId: oversizedId, attempts: 1, removeOnFail: false })
  await waitForJob(oversizedId, "failed")
  await storage.upload(alpha.file.storageKey, alpha.source, "application/pdf")

  const noTextSource = createTextPdf([""])
  await storage.upload(alpha.file.storageKey, noTextSource, "application/pdf")
  const lockClient = await sql.connect()
  try {
    await lockClient.query("BEGIN")
    const blockerPid = (await lockClient.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]?.pid
    if (!blockerPid) throw new Error("Could not identify the source-race lock holder")
    await lockClient.query(`SELECT id FROM "Contract" WHERE id=$1 FOR UPDATE`, [alpha.contractId])
    await lockClient.query(`UPDATE "ContractFile" SET "isLatest"=FALSE WHERE id=$1`, [alpha.file.id])
    const staleFailureId = `source-stale-failure-${suffix}`
    probeJobIds.push(staleFailureId)
    await queue.add("extract", {
      contractId: alpha.contractId, organizationId: alpha.organizationId,
      fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
    }, { jobId: staleFailureId, attempts: 1, removeOnComplete: false })
    await waitFor(async () => {
      const blocked = await sql.query<{ blocked: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_stat_activity a
           WHERE $1::int = ANY(pg_blocking_pids(a.pid))
             AND a.wait_event_type='Lock'
             AND a.query LIKE '%FOR UPDATE%'
         ) AS blocked`, [blockerPid],
      )
      return blocked.rows[0]?.blocked === true
    }, `${staleFailureId} to reach its persistence lock`)
    await lockClient.query("COMMIT")
    await waitForJob(staleFailureId, "completed")
  } catch (error) {
    await lockClient.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    lockClient.release()
  }
  const failureAuditCount = Number((await sql.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Activity" WHERE "contractId"=$1 AND action='METADATA_EXTRACTED'`, [alpha.contractId],
  )).rows[0]?.count ?? "0")
  if (failureAuditCount !== baselineActivities) {
    throw new Error("Superseded no-text source created a misleading failure audit")
  }
  await storage.upload(alpha.file.storageKey, alpha.source, "application/pdf")
  await sql.query(`UPDATE "ContractFile" SET "isLatest"=TRUE WHERE id=$1`, [alpha.file.id])

  await sql.query(`UPDATE "ContractFile" SET "isLatest"=FALSE WHERE id=$1`, [alpha.file.id])
  const staleId = `source-stale-${suffix}`
  probeJobIds.push(staleId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
  }, { jobId: staleId, attempts: 1, removeOnComplete: false })
  await waitForJob(staleId, "completed")
  await sql.query(`UPDATE "ContractFile" SET "isLatest"=TRUE WHERE id=$1`, [alpha.file.id])

  const controlId = `source-control-${suffix}`
  probeJobIds.push(controlId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
  }, { jobId: controlId, attempts: 1, removeOnComplete: false })
  await waitForJob(controlId, "completed")

  const control = (await sql.query<{
    extractedText: string | null; extractedSourceFileId: string | null
    extractedSourceFileVersion: number | null; extractedSourceHash: string | null
  }>(`SELECT "extractedText", "extractedSourceFileId", "extractedSourceFileVersion", "extractedSourceHash"
      FROM "Contract" WHERE id=$1`, [alpha.contractId])).rows[0]
  const controlChecks = {
    hasAuthoritativeMarker: control?.extractedText?.includes("ALPHA SOURCE AGREEMENT") === true,
    hasNoForeignMarker: control?.extractedText?.includes("BETA FOREIGN") === false,
    exactFile: control?.extractedSourceFileId === alpha.file.id,
    exactVersion: control?.extractedSourceFileVersion === alpha.file.version,
    exactTextHash: control?.extractedText != null
      && control.extractedSourceHash === createHash("sha256").update(control.extractedText).digest("hex"),
  }
  if (Object.values(controlChecks).some((passed) => !passed)) {
    throw new Error(`Authoritative source control did not persist its exact binding: ${JSON.stringify(controlChecks)}`)
  }

  const sourceHash = control.extractedSourceHash!
  const embedJobId = `contract-embed-${alpha.contractId}-${alpha.file.id}-${alpha.file.version}-${sourceHash}`
  probeJobIds.push(embedJobId)
  await waitForQueueJob(embedQueue, embedJobId, "completed")
  const activityCountAfterControl = Number((await sql.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Activity" WHERE "contractId"=$1 AND action='METADATA_EXTRACTED'`, [alpha.contractId],
  )).rows[0]?.count ?? "0")

  await (await embedQueue.getJob(embedJobId))?.remove()
  const missingRecoveryId = `source-reconcile-missing-${suffix}`
  probeJobIds.push(missingRecoveryId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
  }, { jobId: missingRecoveryId, attempts: 1, removeOnComplete: false })
  await waitForJob(missingRecoveryId, "completed")
  await waitForQueueJob(embedQueue, embedJobId, "completed")

  await (await embedQueue.getJob(embedJobId))?.remove()
  await sql.query(`UPDATE "ContractFile" SET "isLatest"=FALSE WHERE id=$1`, [alpha.file.id])
  await embedQueue.add("embed", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    extractedText: control.extractedText!, sourceFileId: alpha.file.id,
    sourceFileVersion: alpha.file.version, sourceHash, preserveUserFields: true,
  }, { jobId: embedJobId, attempts: 1, removeOnFail: false })
  await waitForQueueJob(embedQueue, embedJobId, "failed")
  await sql.query(`UPDATE "ContractFile" SET "isLatest"=TRUE WHERE id=$1`, [alpha.file.id])
  const failedRecoveryId = `source-reconcile-failed-${suffix}`
  probeJobIds.push(failedRecoveryId)
  await queue.add("extract", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    fileId: alpha.file.id, storageKey: alpha.file.storageKey, preserveUserFields: true,
  }, { jobId: failedRecoveryId, attempts: 1, removeOnComplete: false })
  await waitForJob(failedRecoveryId, "completed")
  await waitForQueueJob(embedQueue, embedJobId, "completed")

  const activityCountAfterRecovery = Number((await sql.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Activity" WHERE "contractId"=$1 AND action='METADATA_EXTRACTED'`, [alpha.contractId],
  )).rows[0]?.count ?? "0")
  if (activityCountAfterRecovery !== activityCountAfterControl) {
    throw new Error("Downstream recovery duplicated the durable extraction activity")
  }

  await sql.query(`UPDATE "ContractFile" SET version=version+1 WHERE id=$1`, [alpha.file.id])
  const staleEmbedId = `source-embed-stale-version-${suffix}`
  probeJobIds.push(staleEmbedId)
  await embedQueue.add("embed", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    extractedText: control.extractedText!, sourceFileId: alpha.file.id,
    sourceFileVersion: alpha.file.version, sourceHash, preserveUserFields: true,
  }, { jobId: staleEmbedId, attempts: 1, removeOnFail: false })
  await waitForQueueJob(embedQueue, staleEmbedId, "failed")
  await sql.query(`UPDATE "ContractFile" SET version=$2 WHERE id=$1`, [alpha.file.id, alpha.file.version])

  const legacyEmbedId = `source-embed-legacy-${suffix}`
  probeJobIds.push(legacyEmbedId)
  await embedQueue.add("embed", {
    contractId: alpha.contractId, organizationId: alpha.organizationId,
    extractedText: control.extractedText!, preserveUserFields: true,
  }, { jobId: legacyEmbedId, attempts: 1, removeOnComplete: false })
  await waitForQueueJob(embedQueue, legacyEmbedId, "completed")

  proofResult = { status: "PASS", mismatchedKeyDenied: true, wrongOrganizationDenied: true,
    oversizedSourceDenied: true, staleFailureAuditDenied: true, staleSourceSkipped: true,
    authoritativeControlPersisted: true, missingEmbedRecovered: true, failedEmbedRecovered: true,
    duplicateActivityDenied: true, staleEmbedDenied: true, exactLegacyEmbedReconciled: true,
    cleanupVerified: true }
} catch (error) {
  primaryFailure = error
} finally {
  const cleanupFailures: unknown[] = []
  try {
    const discovered = await sql.query<{ storageKey: string }>(
      `SELECT cf."storageKey" FROM "ContractFile" cf JOIN "Contract" c ON c.id=cf."contractId"
       WHERE c."organizationId"=ANY($1::text[])`, [[...organizationIds]],
    )
    for (const row of discovered.rows) objectKeys.add(row.storageKey)
  } catch (error) {
    cleanupFailures.push(new Error("Source probe could not discover all uploaded objects", { cause: error }))
  }
  for (const jobId of probeJobIds) {
    try {
      const job = await queue.getJob(jobId)
      const embedJob = await embedQueue.getJob(jobId)
      if (job) await job.remove()
      if (embedJob) await embedJob.remove()
    } catch (error) {
      cleanupFailures.push(new Error(`Source probe job cleanup failed for ${jobId}`, { cause: error }))
    }
  }
  for (const key of objectKeys) {
    try {
      await storage.delete(key)
    } catch (error) {
      cleanupFailures.push(new Error("Source probe object cleanup failed", { cause: error }))
    }
  }
  for (const organizationId of organizationIds) {
    try {
      await sql.query(`DELETE FROM "Organization" WHERE id=$1`, [organizationId])
    } catch (error) {
      cleanupFailures.push(new Error("Source probe organization cleanup failed", { cause: error }))
    }
  }
  try {
    await sql.query(`DELETE FROM "User" WHERE email=$1`, [email])
  } catch (error) {
    cleanupFailures.push(new Error("Source probe user cleanup failed", { cause: error }))
  }
  try {
    const leftovers = await sql.query<{ organizations: string; users: string }>(
      `SELECT (SELECT COUNT(*) FROM "Organization" WHERE id=ANY($1::text[]))::text AS organizations,
        (SELECT COUNT(*) FROM "User" WHERE email=$2)::text AS users`, [[...organizationIds], email],
    )
    if (leftovers.rows[0]?.organizations !== "0" || leftovers.rows[0]?.users !== "0") {
      cleanupFailures.push(new Error("Source probe database cleanup was incomplete"))
    }
  } catch (error) {
    cleanupFailures.push(new Error("Source probe database cleanup could not be verified", { cause: error }))
  }
  for (const key of objectKeys) {
    try {
      await storage.getObject(key, 1)
      cleanupFailures.push(new Error("Source probe object cleanup was incomplete"))
    } catch (error) {
      if (!isStorageNotFound(error)) {
        cleanupFailures.push(new Error("Source probe object cleanup could not be verified", { cause: error }))
      }
    }
  }
  try {
    await api.dispose()
  } catch (error) {
    cleanupFailures.push(new Error("Source probe HTTP context cleanup failed", { cause: error }))
  }
  try {
    await queue.close()
  } catch (error) {
    cleanupFailures.push(new Error("Source probe queue cleanup failed", { cause: error }))
  }
  try {
    await embedQueue.close()
  } catch (error) {
    cleanupFailures.push(new Error("Source probe embed queue cleanup failed", { cause: error }))
  }
  try {
    await sql.end()
  } catch (error) {
    cleanupFailures.push(new Error("Source probe database connection cleanup failed", { cause: error }))
  }
  if (primaryFailure !== undefined && cleanupFailures.length > 0) {
    throw new AggregateError([primaryFailure, ...cleanupFailures], "Source probe and cleanup failed")
  }
  if (primaryFailure !== undefined) throw primaryFailure
  if (cleanupFailures.length > 0) throw new AggregateError(cleanupFailures, "Source probe cleanup failed")
}

console.log(JSON.stringify(proofResult))
