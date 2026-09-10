import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { promisify } from "node:util"
import pg from "pg"

if (process.env.AAKD_DOCUMENT_CONVERT_VERSION_PROBE !== "1") {
  throw new Error("Opt in with AAKD_DOCUMENT_CONVERT_VERSION_PROBE=1")
}

const rootEnvLoaded = await import("./root-env") as unknown as {
  loadRootComposeEnv?: () => void
  default?: { loadRootComposeEnv: () => void }
}
const loadRootComposeEnv = rootEnvLoaded.loadRootComposeEnv ?? rootEnvLoaded.default?.loadRootComposeEnv
if (!loadRootComposeEnv) throw new Error("Could not load the root environment helper")
loadRootComposeEnv()

const source = new URL(process.env.DATABASE_URL ?? "")
if (!["localhost", "127.0.0.1"].includes(source.hostname)) {
  throw new Error("Document conversion version probe requires local PostgreSQL")
}

const run = promisify(execFile)
const webRoot = process.cwd()
const targetDatabase = `aakd_qa_document_convert_${randomBytes(6).toString("hex")}`
const adminUrl = new URL(source)
adminUrl.pathname = "/postgres"
source.pathname = `/${targetDatabase}`

const admin = new pg.Client({ connectionString: adminUrl.href })
await admin.connect()
try {
  await admin.query(`CREATE DATABASE "${targetDatabase}"`)
} finally {
  await admin.end()
}

try {
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: webRoot,
    env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href },
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  })
} catch {
  throw new Error(`Migration failed; inspect preserved database ${targetDatabase}`)
}

process.env.DATABASE_URL = source.href
process.env.DIRECT_URL = source.href
process.env.DATABASE_POOL_SIZE = "4"
process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "false"

const workerClientLoaded = await import("../../lib/db/worker-client") as unknown as {
  getWorkerPrisma?: typeof import("../../lib/db/worker-client")["getWorkerPrisma"]
  default?: typeof import("../../lib/db/worker-client")
}
const getWorkerPrisma = workerClientLoaded.getWorkerPrisma ?? workerClientLoaded.default?.getWorkerPrisma
if (!getWorkerPrisma) throw new Error("Could not load worker Prisma client")

const accessLoaded = await import("../../lib/jobs/document-convert-access") as unknown as {
  documentConversionReady?: typeof import("../../lib/jobs/document-convert-access")["documentConversionReady"]
  default?: typeof import("../../lib/jobs/document-convert-access")
}
const documentConversionReady = accessLoaded.documentConversionReady
  ?? accessLoaded.default?.documentConversionReady
if (!documentConversionReady) throw new Error("Could not load document conversion access helper")

const retryLoaded = await import("../../lib/db/transaction-retry") as unknown as {
  withTransactionRetry?: typeof import("../../lib/db/transaction-retry")["withTransactionRetry"]
  default?: typeof import("../../lib/db/transaction-retry")
}
const withTransactionRetry = retryLoaded.withTransactionRetry ?? retryLoaded.default?.withTransactionRetry
if (!withTransactionRetry) throw new Error("Could not load transaction retry helper")

const db = getWorkerPrisma()
const sql = new pg.Client({ connectionString: source.href })
await sql.connect()

const ids = {
  organization: "qa-convert-org",
  owner: "qa-convert-owner",
  actor: "qa-convert-actor",
  ownerMember: "qa-convert-owner-member",
  actorMember: "qa-convert-actor-member",
  contract: "qa-convert-contract",
  grant: "qa-convert-actor-grant",
  document: "qa-convert-document",
} as const

const jobData = {
  contractId: ids.contract,
  organizationId: ids.organization,
  requestedByMemberId: ids.actorMember,
  storageKey: `tmp/docx-imports/${ids.contract}/source.docx`,
  requestedById: ids.actor,
  expectedDocumentVersion: 1,
  jobId: "qa-convert-job",
  fileType: "docx" as const,
  deleteSource: true,
}

await sql.query("BEGIN")
try {
  await sql.query(`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
    ($1, 'QA Conversion Owner', 'qa-convert-owner@example.test', true, NOW(), NOW()),
    ($2, 'QA Conversion Actor', 'qa-convert-actor@example.test', true, NOW(), NOW())`,
  [ids.owner, ids.actor])
  await sql.query(`INSERT INTO "Organization" (id, name, slug, "createdAt")
    VALUES ($1, 'QA Document Conversion', $2, NOW())`,
  [ids.organization, `qa-document-convert-${randomBytes(4).toString("hex")}`])
  await sql.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt") VALUES
    ($1, $2, $3, 'owner', NOW()),
    ($4, $2, $5, 'member', NOW())`,
  [ids.ownerMember, ids.organization, ids.owner, ids.actorMember, ids.actor])
  await sql.query(`INSERT INTO "Contract"
    (id, title, "contractType", status, "ownerId", "organizationId", "updatedAt")
    VALUES ($1, 'QA Document Conversion Contract', 'OTHER', 'DRAFT', $2, $3, NOW())`,
  [ids.contract, ids.owner, ids.organization])
  await sql.query(`INSERT INTO "ContractAccessGrant"
    (id, "organizationId", "contractId", "memberId", "grantedById") VALUES ($1, $2, $3, $4, $5)`,
  [ids.grant, ids.organization, ids.contract, ids.actorMember, ids.owner])
  await sql.query(`INSERT INTO "ContractDocument"
    (id, "contractId", content, "wordCount", version, "savedById", "createdAt", "updatedAt")
    VALUES ($1, $2, $3::jsonb, 1, 1, $4, NOW(), NOW())`,
  [ids.document, ids.contract, JSON.stringify([{ type: "paragraph", children: [{ text: "baseline" }] }]), ids.owner])
  await sql.query("COMMIT")
} catch (error) {
  await sql.query("ROLLBACK")
  throw error
}

let attemptCount = 0

async function conversionAttempt(afterAuthorized?: (attempt: number) => Promise<void>) {
  return withTransactionRetry(() => db.$transaction(async (tx) => {
    attemptCount += 1
    const attempt = attemptCount
    if (!await documentConversionReady(tx, jobData, true)) return false
    if (afterAuthorized) await afterAuthorized(attempt)
    const existing = await tx.contractDocument.findUnique({
      where: { contractId: ids.contract },
      select: { version: true },
    })
    assert.ok(existing)
    const updated = await tx.contractDocument.updateMany({
      where: { contractId: ids.contract, version: existing.version },
      data: {
        content: [{ type: "paragraph", children: [{ text: "converted" }] }],
        wordCount: 1,
        version: existing.version + 1,
        savedById: ids.actor,
      },
    })
    if (updated.count !== 1) throw new Error("Document changed during conversion")
    await tx.activity.create({
      data: {
        contractId: ids.contract,
        userId: ids.actor,
        action: "DOCUMENT_IMPORTED",
        detail: "QA conversion",
      },
    })
    return true
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 }))
}

async function expectBlocked<T>(promise: Promise<T>, label: string) {
  let settled = false
  void promise.then(() => { settled = true }, () => { settled = true })
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.equal(settled, false, `${label} did not remain in flight during the controlled race`)
}

async function resetDocument() {
  await sql.query(`UPDATE "ContractDocument"
    SET content=$2::jsonb, "wordCount"=1, version=1, "savedById"=$3, "updatedAt"=NOW()
    WHERE "contractId"=$1`, [ids.contract, JSON.stringify([{ type: "paragraph", children: [{ text: "baseline" }] }]), ids.owner])
  await sql.query(`DELETE FROM "Activity" WHERE "contractId"=$1 AND detail='QA conversion'`, [ids.contract])
  attemptCount = 0
}

async function documentState() {
  const result = await sql.query(`SELECT content, version, "savedById" FROM "ContractDocument" WHERE "contractId"=$1`, [ids.contract])
  return result.rows[0] as { content: Array<{ children: Array<{ text: string }> }>; version: number; savedById: string }
}

let probeError: unknown
const report: Record<string, unknown> = { targetDatabase }
try {
  // The editor write obtains the document-row lock first. The conversion may
  // inspect the old snapshot, but after retry it must observe version 2 and deny.
  await sql.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
  await sql.query(`UPDATE "ContractDocument"
    SET content=$2::jsonb, version=2, "savedById"=$3, "updatedAt"=NOW()
    WHERE "contractId"=$1`, [ids.contract, JSON.stringify([{ type: "paragraph", children: [{ text: "editor-first" }] }]), ids.actor])
  const editorFirstConversion = conversionAttempt()
  await expectBlocked(editorFirstConversion, "conversion behind editor-first document update")
  await sql.query("COMMIT")
  assert.equal(await editorFirstConversion, false)
  assert.deepEqual(await documentState(), {
    content: [{ type: "paragraph", children: [{ text: "editor-first" }] }],
    version: 2,
    savedById: ids.actor,
  })
  assert.ok(attemptCount >= 2, "Serializable conflict did not retry the full authorization transaction")
  report.editorFirst = { conversionApplied: false, attempts: attemptCount }

  await resetDocument()

  // The conversion completes its authorization read first. An editor write can
  // still commit before the conditional update; the worker must not overwrite it.
  let authorized!: () => void
  const authorizedReached = new Promise<void>((resolve) => { authorized = resolve })
  let release!: () => void
  const releaseConversion = new Promise<void>((resolve) => { release = resolve })
  const workerFirstConversion = conversionAttempt(async (attempt) => {
    if (attempt !== 1) return
    authorized()
    await releaseConversion
  })
  await authorizedReached
  await sql.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
  await sql.query(`UPDATE "ContractDocument"
    SET content=$2::jsonb, version=2, "savedById"=$3, "updatedAt"=NOW()
    WHERE "contractId"=$1`, [ids.contract, JSON.stringify([{ type: "paragraph", children: [{ text: "editor-between-check-and-write" }] }]), ids.actor])
  await sql.query("COMMIT")
  release()
  assert.equal(await workerFirstConversion, false)
  assert.deepEqual(await documentState(), {
    content: [{ type: "paragraph", children: [{ text: "editor-between-check-and-write" }] }],
    version: 2,
    savedById: ids.actor,
  })
  assert.ok(attemptCount >= 2, "Worker-first conflict did not retry current document version")
  report.workerAuthorizedFirst = { conversionApplied: false, attempts: attemptCount }

  const activityCount = Number((await sql.query(
    `SELECT COUNT(*)::int AS count FROM "Activity" WHERE "contractId"=$1 AND detail='QA conversion'`,
    [ids.contract],
  )).rows[0].count)
  assert.equal(activityCount, 0, "Denied conversion left a partial audit row")
  report.partialConversionActivities = activityCount
  report.status = "PASS"
} catch (error) {
  probeError = error
  await sql.query("ROLLBACK").catch(() => {})
  report.status = "FAIL"
  report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
} finally {
  await sql.end()
  await db.$disconnect()
}

process.stdout.write(`${JSON.stringify({ ...report, postgresPreservedForInspection: true })}\n`)
if (probeError) throw probeError
