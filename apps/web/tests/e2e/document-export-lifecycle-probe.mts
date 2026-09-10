import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { promisify } from "node:util"
import pg from "pg"

if (process.env.AAKD_DOCUMENT_EXPORT_LIFECYCLE_PROBE !== "1") throw new Error("Opt in with AAKD_DOCUMENT_EXPORT_LIFECYCLE_PROBE=1")
const rootEnvLoaded = await import("./root-env") as unknown as { loadRootComposeEnv?: () => void; default?: { loadRootComposeEnv: () => void } }
const loadRootComposeEnv = rootEnvLoaded.loadRootComposeEnv ?? rootEnvLoaded.default?.loadRootComposeEnv
if (!loadRootComposeEnv) throw new Error("Could not load root environment helper")
loadRootComposeEnv()

const source = new URL(process.env.DATABASE_URL ?? "")
if (!["localhost", "127.0.0.1"].includes(source.hostname)) throw new Error("Probe requires local PostgreSQL")
const targetDatabase = `aakd_qa_export_lifecycle_${randomBytes(6).toString("hex")}`
const adminUrl = new URL(source); adminUrl.pathname = "/postgres"
source.pathname = `/${targetDatabase}`
const admin = new pg.Client({ connectionString: adminUrl.href })
await admin.connect()
try { await admin.query(`CREATE DATABASE "${targetDatabase}"`) } finally { await admin.end() }

const run = promisify(execFile)
try {
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href }, timeout: 120_000,
  })
} catch { throw new Error(`Migration failed; inspect preserved database ${targetDatabase}`) }

process.env.DATABASE_URL = source.href
process.env.DIRECT_URL = source.href
process.env.DATABASE_POOL_SIZE = "4"
process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "false"
const { getWorkerPrisma } = await import("../../lib/db/worker-client")
const { documentContentHash } = await import("../../lib/jobs/document-export-access")
const { processDocumentExportCleanup, processDocumentExportJob } = await import("../../../../worker/jobs/document-export")
const db = getWorkerPrisma()
const sql = new pg.Client({ connectionString: source.href })
await sql.connect()

const ids = {
  org: "qa-export-life-org", owner: "qa-export-life-owner", actor: "qa-export-life-actor",
  ownerMember: "qa-export-life-owner-member", actorMember: "qa-export-life-actor-member",
  contract: "qa-export-life-contract", grant: "qa-export-life-grant", document: "qa-export-life-document", job: "qa-export-life-job",
}
const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "lifecycle" }] }] }
const hash = documentContentHash(content)
const future = new Date(Date.now() + 86_400_000)
const objects = new Map<string, Buffer>()
const deletes = new Map<string, number>()
const failDeleteOnce = new Set<string>()
const storage = {
  upload: async (key: string, body: Buffer) => { objects.set(key, body); return key },
  delete: async (key: string) => {
    deletes.set(key, (deletes.get(key) ?? 0) + 1)
    if (failDeleteOnce.delete(key)) throw new Error("synthetic delete failure")
    objects.delete(key)
  },
}

let probeError: unknown
const report: Record<string, unknown> = { targetDatabase }
try {
  await sql.query(`INSERT INTO "User" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES
    ($1,'Owner','qa-export-life-owner@example.test',true,NOW(),NOW()),($2,'Actor','qa-export-life-actor@example.test',true,NOW(),NOW())`, [ids.owner, ids.actor])
  await sql.query(`INSERT INTO "Organization" (id,name,slug,"createdAt") VALUES ($1,'Export Lifecycle',$2,NOW())`, [ids.org, `qa-export-life-${randomBytes(4).toString("hex")}`])
  await sql.query(`INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,'owner',NOW()),($4,$2,$5,'member',NOW())`, [ids.ownerMember, ids.org, ids.owner, ids.actorMember, ids.actor])
  await sql.query(`INSERT INTO "Contract" (id,title,"contractType",status,"ownerId","organizationId","updatedAt") VALUES ($1,'Lifecycle','OTHER','DRAFT',$2,$3,NOW())`, [ids.contract, ids.owner, ids.org])
  await sql.query(`INSERT INTO "ContractAccessGrant" (id,"organizationId","contractId","memberId","grantedById") VALUES ($1,$2,$3,$4,$5)`, [ids.grant, ids.org, ids.contract, ids.actorMember, ids.owner])
  await sql.query(`INSERT INTO "ContractDocument" (id,"contractId",content,"wordCount",version,"savedById","createdAt","updatedAt") VALUES ($1,$2,$3::jsonb,1,1,$4,NOW(),NOW())`, [ids.document, ids.contract, JSON.stringify(content), ids.owner])
  await sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,"expiresAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,1,$7,'docx',$8,NOW())`, [ids.job, ids.org, ids.contract, ids.actorMember, ids.actor, ids.document, hash, future])
  const seedArtifact = (jobId: string) => sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,"expiresAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,1,$7,'docx',$8,NOW())`, [jobId, ids.org, ids.contract, ids.actorMember, ids.actor, ids.document, hash, future])

  let arrivals = 0
  let release!: () => void
  const barrier = new Promise<void>((resolve) => { release = resolve })
  const toDocx = async () => { arrivals += 1; if (arrivals === 2) release(); await barrier; return Buffer.from("docx") }
  const dependencies = { db: db as never, storage, toDocx, toPdf: async () => Buffer.from("pdf") }
  const results = await Promise.all([
    processDocumentExportJob({ id: ids.job, data: { jobId: ids.job } }, dependencies),
    processDocumentExportJob({ id: ids.job, data: { jobId: ids.job } }, dependencies),
  ])
  assert.equal(results[0].storageKey, results[1].storageKey)
  const attempts = await sql.query(`SELECT state,"storageKey" FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1 ORDER BY id`, [ids.job])
  assert.equal(attempts.rows.length, 2)
  assert.equal(attempts.rows.filter((row) => row.state === "WINNER").length, 1)
  assert.equal(attempts.rows.filter((row) => row.state === "CLEANED").length, 1)
  assert.equal(objects.size, 1)
  const activity = await sql.query(`SELECT COUNT(*)::int count FROM "Activity" WHERE id=$1`, [`document-export:${ids.job}`])
  assert.equal(activity.rows[0].count, 1)
  report.concurrentPublication = { attempts: 2, winners: 1, objects: 1, activities: 1 }

  const ambiguousJob = "qa-export-ambiguous-commit"
  await seedArtifact(ambiguousJob)
  let transactionCalls = 0
  const ambiguousDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver)
      return async (...args: Parameters<typeof db.$transaction>) => {
        transactionCalls += 1
        const result = await (db.$transaction as (...values: Parameters<typeof db.$transaction>) => Promise<unknown>)(...args)
        if (transactionCalls === 3) throw new Error("synthetic lost commit acknowledgement")
        return result
      }
    },
  })
  const ambiguousResult = await processDocumentExportJob({ id: ambiguousJob, data: { jobId: ambiguousJob } }, { db: ambiguousDb as never, storage, toDocx: async () => Buffer.from("docx"), toPdf: async () => Buffer.from("pdf") })
  assert.equal(objects.has(ambiguousResult.storageKey), true)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "Activity" WHERE id=$1`, [`document-export:${ambiguousJob}`])).rows[0].count, 1)
  report.commitAcknowledgementRecovery = { winnerPreserved: true, activities: 1 }

  const assertPreStartDenied = async (jobId: string) => {
    await assert.rejects(processDocumentExportJob({ id: jobId, data: { jobId } }, {
      db: db as never, storage, toDocx: async () => Buffer.from("docx"), toPdf: async () => Buffer.from("pdf"),
    }), /no longer authorized/)
    assert.equal((await sql.query(`SELECT state FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [jobId])).rows[0].state, "FAILED")
    assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1`, [jobId])).rows[0].count, 0)
    assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "Activity" WHERE id=$1`, [`document-export:${jobId}`])).rows[0].count, 0)
    assert.equal([...objects.keys()].some((key) => key.includes(jobId)), false)
  }

  const preStartGrantJob = "qa-export-prestart-grant"
  await seedArtifact(preStartGrantJob)
  await sql.query(`DELETE FROM "ContractAccessGrant" WHERE id=$1`, [ids.grant])
  await assertPreStartDenied(preStartGrantJob)
  await sql.query(`INSERT INTO "ContractAccessGrant" (id,"organizationId","contractId","memberId","grantedById") VALUES ($1,$2,$3,$4,$5)`, [ids.grant, ids.org, ids.contract, ids.actorMember, ids.owner])
  const preStartRetryJob = "qa-export-prestart-restored"
  const staleReusable = await db.documentExportArtifact.findFirst({ where: { jobId: preStartGrantJob, state: { in: ["QUEUED", "READY"] } } })
  assert.equal(staleReusable, null)
  await seedArtifact(preStartRetryJob)
  const restoredResult = await processDocumentExportJob({ id: preStartRetryJob, data: { jobId: preStartRetryJob } }, dependencies)
  assert.equal(restoredResult.storageKey.includes(preStartRetryJob), true)

  const preStartMemberJob = "qa-export-prestart-member"
  await seedArtifact(preStartMemberJob)
  await sql.query(`DELETE FROM "ContractAccessGrant" WHERE id=$1`, [ids.grant])
  await sql.query(`DELETE FROM "Member" WHERE id=$1`, [ids.actorMember])
  await assertPreStartDenied(preStartMemberJob)
  await sql.query(`INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,'member',NOW())`, [ids.actorMember, ids.org, ids.actor])
  await sql.query(`INSERT INTO "ContractAccessGrant" (id,"organizationId","contractId","memberId","grantedById") VALUES ($1,$2,$3,$4,$5)`, [ids.grant, ids.org, ids.contract, ids.actorMember, ids.owner])

  const preStartSourceJob = "qa-export-prestart-source"
  await seedArtifact(preStartSourceJob)
  await sql.query(`UPDATE "ContractDocument" SET version=2,"updatedAt"=NOW() WHERE id=$1`, [ids.document])
  await assertPreStartDenied(preStartSourceJob)
  await sql.query(`UPDATE "ContractDocument" SET version=1,"updatedAt"=NOW() WHERE id=$1`, [ids.document])
  report.preStartDenials = { grant: "FAILED", membership: "FAILED", source: "FAILED", attempts: 0, restoredFreshJobCompleted: true }

  const revokedJob = "qa-export-revoked"
  await seedArtifact(revokedJob)
  await assert.rejects(processDocumentExportJob({ id: revokedJob, data: { jobId: revokedJob } }, {
    db: db as never,
    storage,
    toDocx: async () => { await sql.query(`DELETE FROM "ContractAccessGrant" WHERE id=$1`, [ids.grant]); return Buffer.from("docx") },
    toPdf: async () => Buffer.from("pdf"),
  }), /no longer authorized/)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "Activity" WHERE id=$1`, [`document-export:${revokedJob}`])).rows[0].count, 0)
  await sql.query(`INSERT INTO "ContractAccessGrant" (id,"organizationId","contractId","memberId","grantedById") VALUES ($1,$2,$3,$4,$5)`, [ids.grant, ids.org, ids.contract, ids.actorMember, ids.owner])

  const changedJob = "qa-export-source-changed"
  await seedArtifact(changedJob)
  await assert.rejects(processDocumentExportJob({ id: changedJob, data: { jobId: changedJob } }, {
    db: db as never,
    storage: { ...storage, upload: async (key: string, body: Buffer) => { objects.set(key, body); await sql.query(`UPDATE "ContractDocument" SET version=2,"updatedAt"=NOW() WHERE id=$1`, [ids.document]); return key } },
    toDocx: async () => Buffer.from("docx"), toPdf: async () => Buffer.from("pdf"),
  }), /publication failed/)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "Activity" WHERE id=$1`, [`document-export:${changedJob}`])).rows[0].count, 0)
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [changedJob])).rows[0].state, "FAILED")
  assert.equal([...objects.keys()].some((key) => key.includes(changedJob)), false)
  await sql.query(`UPDATE "ContractDocument" SET version=1,"updatedAt"=NOW() WHERE id=$1`, [ids.document])

  const uploadAckJob = "qa-export-upload-ack"
  await seedArtifact(uploadAckJob)
  await assert.rejects(processDocumentExportJob({ id: uploadAckJob, data: { jobId: uploadAckJob } }, {
    db: db as never,
    storage: { ...storage, upload: async (key: string, body: Buffer) => { objects.set(key, body); throw new Error("synthetic upload ack lost") } },
    toDocx: async () => Buffer.from("docx"), toPdf: async () => Buffer.from("pdf"),
  }), /publication failed/)
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1`, [uploadAckJob])).rows[0].state, "CLEANUP_FAILED")
  await sql.query(`UPDATE "DocumentExportArtifact" SET "createdAt"=NOW()-INTERVAL '3 days',"expiresAt"=NOW()-INTERVAL '2 days',"updatedAt"=NOW() WHERE "jobId"=$1`, [uploadAckJob])
  const uploadAckEarlyCleanup = await processDocumentExportCleanup({ data: { triggeredAt: new Date().toISOString() } } as never, { db: db as never, storage, now: () => new Date() })
  assert.equal(uploadAckEarlyCleanup.cleaned, 0)
  assert.equal([...objects.keys()].some((key) => key.includes(uploadAckJob)), true)
  await sql.query(`UPDATE "DocumentExportAttempt" SET "createdAt"=NOW()-INTERVAL '2 seconds', "leaseExpiresAt"=NOW()-INTERVAL '1 second' WHERE "artifactJobId"=$1`, [uploadAckJob])
  await processDocumentExportCleanup({ data: { triggeredAt: new Date().toISOString() } } as never, { db: db as never, storage, now: () => new Date() })
  assert.equal([...objects.keys()].some((key) => key.includes(uploadAckJob)), false)
  report.revocationSourceAndUnknownUpload = { revokedNoAudit: true, staleSourceNoAudit: true, unknownUploadCleaned: true }

  const settlementJob = "qa-export-settlement"
  const settlementExpiry = new Date(Date.now() + 60_000)
  await sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,"expiresAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,1,$7,'docx',$8,NOW())`, [settlementJob, ids.org, ids.contract, ids.actorMember, ids.actor, ids.document, hash, settlementExpiry])
  const persistedSettlementExpiry = (await db.documentExportArtifact.findUniqueOrThrow({ where: { jobId: settlementJob }, select: { expiresAt: true } })).expiresAt
  let settlementKey = ""
  await processDocumentExportJob({ id: settlementJob, data: { jobId: settlementJob } }, {
    db: db as never,
    storage: {
      ...storage,
      upload: async (key: string, body: Buffer) => {
        settlementKey = key
        const earlyCleanup = await processDocumentExportCleanup({ data: { triggeredAt: persistedSettlementExpiry.toISOString() } } as never, { db: db as never, storage, now: () => new Date(persistedSettlementExpiry.getTime() + 1_000) })
        assert.equal(earlyCleanup.cleaned, 0)
        assert.equal(deletes.has(key), false)
        objects.set(key, body)
        return key
      },
    },
    toDocx: async () => Buffer.from("docx"), toPdf: async () => Buffer.from("pdf"),
  })
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [settlementJob])).rows[0].state, "READY")
  assert.equal(objects.has(settlementKey), true)

  const lateJob = "qa-export-late-upload"
  const lateExpiry = new Date(Date.now() + 60_000)
  await sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,"expiresAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,1,$7,'docx',$8,NOW())`, [lateJob, ids.org, ids.contract, ids.actorMember, ids.actor, ids.document, hash, lateExpiry])
  const persistedLateExpiry = (await db.documentExportArtifact.findUniqueOrThrow({ where: { jobId: lateJob }, select: { expiresAt: true } })).expiresAt
  let lateKey = ""
  let failCompensatingDelete = true
  let firstLateCleanupCount = -1
  let firstLateInspected = -1
  let firstLateAttemptState = ""
  const lateStorage = {
    ...storage,
    delete: async (key: string) => {
      deletes.set(key, (deletes.get(key) ?? 0) + 1)
      if (key === lateKey && objects.has(key) && failCompensatingDelete) { failCompensatingDelete = false; throw new Error("synthetic compensating delete failure") }
      objects.delete(key)
    },
    upload: async (key: string, body: Buffer) => {
      lateKey = key
      const firstLateCleanup = await processDocumentExportCleanup({ data: { triggeredAt: persistedLateExpiry.toISOString() } } as never, { db: db as never, storage: lateStorage, now: () => new Date(persistedLateExpiry.getTime() + 301_000) })
      firstLateCleanupCount = firstLateCleanup.cleaned
      firstLateInspected = firstLateCleanup.inspected
      firstLateAttemptState = (await sql.query(`SELECT state FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1`, [lateJob])).rows[0].state
      objects.set(key, body)
      return key
    },
  }
  const lateOutcome = await processDocumentExportJob({ id: lateJob, data: { jobId: lateJob } }, { db: db as never, storage: lateStorage, toDocx: async () => Buffer.from("docx"), toPdf: async () => Buffer.from("pdf") })
    .then(() => "resolved", (error) => error instanceof Error ? error.message : String(error))
  assert.equal(firstLateAttemptState, "CLEANED", JSON.stringify({ firstLateCleanupCount, firstLateInspected, firstLateAttemptState, lateOutcome }))
  assert.match(lateOutcome, /publication failed/)
  assert.equal(objects.has(lateKey), true)
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1`, [lateJob])).rows[0].state, "CLEANUP_FAILED")
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [lateJob])).rows[0].count, 1)
  await processDocumentExportCleanup({ data: { triggeredAt: persistedLateExpiry.toISOString() } } as never, { db: db as never, storage: lateStorage, now: () => new Date(persistedLateExpiry.getTime() + 302_000) })
  assert.equal(objects.has(lateKey), false)
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1`, [lateJob])).rows[0].state, "CLEANED")
  report.lateUploadSettlement = { preSettlementNotDeleted: true, compensatingFailureRetained: true, expiredRetryCleaned: true, prematurePurge: false }

  await sql.query(`UPDATE "DocumentExportArtifact" SET "createdAt"=NOW()-INTERVAL '3 days', "expiresAt"=NOW()-INTERVAL '2 days', "updatedAt"=NOW() WHERE "jobId"=$1`, [ids.job])
  await sql.query(`DELETE FROM "Organization" WHERE id=$1`, [ids.org])
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "Contract" WHERE id=$1`, [ids.contract])).rows[0].count, 0)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [ids.job])).rows[0].count, 1)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1`, [ids.job])).rows[0].count, 2)
  await processDocumentExportCleanup({ data: { triggeredAt: new Date().toISOString() } } as never, { db: db as never, storage, now: () => new Date() })
  const expired = await sql.query(`SELECT state,"storageKey","cleanedAt" FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [ids.job])
  assert.deepEqual({ state: expired.rows[0].state, key: expired.rows[0].storageKey, cleaned: Boolean(expired.rows[0].cleanedAt) }, { state: "EXPIRED", key: null, cleaned: true })
  assert.equal(objects.has(results[0].storageKey), false)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM "DocumentExportAttempt" WHERE "artifactJobId"=$1 AND state<>'CLEANED'`, [ids.job])).rows[0].count, 0)
  report.parentDeletionAndCleanup = { tombstoneSurvived: true, exactObjectsDeleted: true, terminal: true }

  const retryJob = "cleanup-retry-job"
  const retryAttempt = "cleanup-retry-attempt"
  const retryKey = `exports/o/c/${retryJob}/${retryAttempt}.docx`
  objects.set(retryKey, Buffer.from("retry")); failDeleteOnce.add(retryKey)
  await sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,state,"storageKey","publishedAt","expiresAt","createdAt","updatedAt") VALUES ($1,'o','c','m','u','d',1,$2,'docx','READY',$3,NOW()-INTERVAL '1 day',NOW()-INTERVAL '1 day',NOW()-INTERVAL '2 days',NOW())`, [retryJob, "c".repeat(64), retryKey])
  await sql.query(`INSERT INTO "DocumentExportAttempt" (id,"artifactJobId","storageKey",state,"leaseExpiresAt","createdAt","updatedAt") VALUES ($1,$2,$3,'WINNER',NOW()-INTERVAL '1 day',NOW()-INTERVAL '2 days',NOW())`, [retryAttempt, retryJob, retryKey])
  const retryNow = new Date()
  const firstCleanup = await processDocumentExportCleanup({ data: { triggeredAt: retryNow.toISOString() } } as never, { db: db as never, storage, now: () => retryNow })
  assert.equal(firstCleanup.failed, 1)
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportAttempt" WHERE id=$1`, [retryAttempt])).rows[0].state, "CLEANUP_FAILED")
  await sql.query(`UPDATE "DocumentExportAttempt" SET "leaseExpiresAt"=NOW()-INTERVAL '1 second' WHERE id=$1`, [retryAttempt])
  const [cleanerA, cleanerB] = await Promise.all([
    processDocumentExportCleanup({ data: { triggeredAt: new Date().toISOString() } } as never, { db: db as never, storage, now: () => new Date() }),
    processDocumentExportCleanup({ data: { triggeredAt: new Date().toISOString() } } as never, { db: db as never, storage, now: () => new Date() }),
  ])
  assert.equal(deletes.get(retryKey), 2)
  assert.equal(objects.has(retryKey), false)
  assert.equal((await sql.query(`SELECT state FROM "DocumentExportArtifact" WHERE "jobId"=$1`, [retryJob])).rows[0].state, "EXPIRED")
  report.cleanupRetryAndClaimRace = { firstFailed: 1, concurrentDeletes: (cleanerA.cleaned + cleanerB.cleaned), physicalAttempts: 2, terminal: true }

  const invalidArtifact = async (jobId: string, state: string) => {
    await assert.rejects(sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,state,"expiresAt","updatedAt") VALUES ($1,'o','c','m','u','d',1,$2,'docx',$3,NOW()+INTERVAL '1 day',NOW())`, [jobId, "a".repeat(64), state]))
  }
  await invalidArtifact("invalid-ready", "READY")
  await invalidArtifact("invalid-expiring", "EXPIRING")
  await invalidArtifact("invalid-expired", "EXPIRED")
  await sql.query(`INSERT INTO "DocumentExportArtifact" ("jobId","organizationId","contractId","requestedByMemberId","requestedById","documentId","documentVersion","documentContentHash",format,"expiresAt","updatedAt") VALUES ('attempt-parent','o','c','m','u','d',1,$1,'docx',NOW()+INTERVAL '1 day',NOW())`, ["b".repeat(64)])
  await assert.rejects(sql.query(`INSERT INTO "DocumentExportAttempt" (id,"artifactJobId","storageKey",state,"leaseExpiresAt","updatedAt") VALUES ('invalid-cleaned','attempt-parent','exports/o/c/attempt-parent/x.docx','CLEANED',NOW()+INTERVAL '1 day',NOW())`))
  await assert.rejects(sql.query(`INSERT INTO "DocumentExportAttempt" (id,"artifactJobId","storageKey",state,"leaseExpiresAt","updatedAt") VALUES ('invalid-pending','attempt-parent','exports/o/c/attempt-parent/y.docx','CLEANUP_PENDING',NOW()+INTERVAL '1 day',NOW())`))
  report.stateConstraints = "PASS"

  await sql.query(`DROP TABLE "DocumentExportAttempt"; DROP TABLE "DocumentExportArtifact"; DROP TYPE "DocumentExportAttemptState"; DROP TYPE "DocumentExportArtifactState"; DELETE FROM "_prisma_migrations" WHERE migration_name='20260910020000_document_export_artifacts'`)
  const lock = new pg.Client({ connectionString: source.href }); await lock.connect(); await lock.query("BEGIN"); await lock.query("SELECT pg_advisory_xact_lock(hashtext('aakd_document_export_artifacts_migration'))")
  const timeoutWitness = new pg.Client({ connectionString: source.href })
  await timeoutWitness.connect()
  await timeoutWitness.query("BEGIN")
  await timeoutWitness.query("SET LOCAL lock_timeout='5s'")
  let timeoutCode: string | undefined
  try {
    await timeoutWitness.query("SELECT pg_advisory_xact_lock(hashtext('aakd_document_export_artifacts_migration'))")
  } catch (error) {
    timeoutCode = error && typeof error === "object" && "code" in error ? String(error.code) : undefined
  }
  assert.equal(timeoutCode, "55P03")
  await timeoutWitness.query("ROLLBACK")
  await timeoutWitness.end()
  let migrationFailure: unknown
  try {
    await run("pnpm", ["exec", "prisma", "migrate", "deploy"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href }, timeout: 30_000 })
  } catch (error) {
    migrationFailure = error
  }
  assert.ok(migrationFailure && typeof migrationFailure === "object")
  const migrationFailureText = `${"stderr" in migrationFailure ? String(migrationFailure.stderr) : ""}\n${"stdout" in migrationFailure ? String(migrationFailure.stdout) : ""}`
  if ("code" in migrationFailure) assert.notEqual(migrationFailure.code, 0)
  assert.equal((await sql.query(`SELECT to_regclass('"DocumentExportArtifact"') AS relation`)).rows[0].relation, null)
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM pg_type WHERE typname IN ('DocumentExportArtifactState','DocumentExportAttemptState')`)).rows[0].count, 0)
  const unfinished = await sql.query(`SELECT COUNT(*)::int count FROM "_prisma_migrations" WHERE migration_name='20260910020000_document_export_artifacts' AND finished_at IS NULL AND rolled_back_at IS NULL`)
  assert.equal(unfinished.rows[0].count, 1)
  const failedLedger = await sql.query(`SELECT logs FROM "_prisma_migrations" WHERE migration_name='20260910020000_document_export_artifacts' AND finished_at IS NULL AND rolled_back_at IS NULL`)
  const recordedFailure = `${migrationFailureText}\n${String(failedLedger.rows[0]?.logs ?? "")}`
  assert.match(recordedFailure, /current transaction is aborted|55P03|lock timeout/i)
  await lock.query("ROLLBACK"); await lock.end()
  await run("pnpm", ["exec", "prisma", "migrate", "resolve", "--rolled-back", "20260910020000_document_export_artifacts"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href }, timeout: 30_000 })
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href }, timeout: 30_000 })
  assert.equal((await sql.query(`SELECT COUNT(*)::int count FROM pg_type WHERE typname IN ('DocumentExportArtifactState','DocumentExportAttemptState')`)).rows[0].count, 2)
  assert.ok((await sql.query(`SELECT to_regclass('"DocumentExportArtifact"') AS relation`)).rows[0].relation)
  const expectedIndexes = [
    "DocumentExportArtifact_storageKey_key",
    // PostgreSQL limits identifiers to 63 bytes and truncates this explicit
    // migration index name deterministically. Its full indexed columns are
    // validated separately by the functional query and migration definition.
    "DocumentExportArtifact_organizationId_contractId_requestedByMem",
    "DocumentExportArtifact_state_expiresAt_idx",
    "DocumentExportAttempt_storageKey_key",
    "DocumentExportAttempt_artifactJobId_state_idx",
    "DocumentExportAttempt_state_leaseExpiresAt_idx",
  ]
  const indexCount = await sql.query(`SELECT COUNT(*)::int count FROM pg_indexes WHERE schemaname=current_schema() AND indexname=ANY($1::text[])`, [expectedIndexes])
  assert.equal(indexCount.rows[0].count, expectedIndexes.length)
  const ledger = await sql.query(`SELECT
    COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::int finished,
    COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int rolled_back,
    COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int unfinished
    FROM "_prisma_migrations" WHERE migration_name='20260910020000_document_export_artifacts'`)
  assert.deepEqual(ledger.rows[0], { finished: 1, rolled_back: 1, unfinished: 0 })
  report.forcedLockRollback = { directTimeoutCode: timeoutCode, prismaFailureRecorded: true, partialObjects: 0, unfinishedObserved: 1, rolledBack: 1, redeployed: true, indexes: expectedIndexes.length, finished: 1 }
  report.status = "PASS"
} catch (error) {
  probeError = error
  report.status = "FAIL"
  report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
} finally {
  await sql.end().catch(() => undefined)
  await db.$disconnect().catch(() => undefined)
}
process.stdout.write(`${JSON.stringify({ ...report, databasePreservedForInspection: true })}\n`)
if (probeError) throw probeError
