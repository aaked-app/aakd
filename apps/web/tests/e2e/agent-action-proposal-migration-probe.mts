import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"

const migrationUrl = new URL("../../prisma/migrations/20260910010000_agent_action_proposals/migration.sql", import.meta.url)

async function createDatabase(adminUrl: URL, prefix: string): Promise<{ name: string; url: URL }> {
  const name = `${prefix}_${randomBytes(6).toString("hex")}`
  const admin = new pg.Client({ connectionString: adminUrl.href })
  await admin.connect()
  try { await admin.query(`CREATE DATABASE "${name}"`) } finally { await admin.end() }
  const url = new URL(adminUrl.href)
  url.pathname = `/${name}`
  return { name, url }
}

async function dropDatabase(adminUrl: URL, name: string): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl.href })
  await admin.connect()
  try {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name])
    await admin.query(`DROP DATABASE "${name}"`)
  } finally { await admin.end() }
}

async function createBaseTables(db: pg.Client): Promise<void> {
  await db.query(`
    CREATE TABLE "Contract" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "extractedText" TEXT);
    CREATE TABLE "ContractAction" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "sourceHash" TEXT);
    CREATE TABLE "Approval" (id TEXT PRIMARY KEY, "contractId" TEXT NOT NULL);
  `)
}

async function rejectsCheck(db: pg.Client, sql: string, values: unknown[]): Promise<void> {
  await assert.rejects(db.query(sql, values), (error: unknown) => (error as { code?: string }).code === "23514")
}

async function verifyConstraints(db: pg.Client): Promise<void> {
  const hash = "a".repeat(64)
  await db.query('INSERT INTO "Contract" (id, "organizationId", "extractedText") VALUES ($1, $2, $3)', ["legacy", "org", "legacy text"])
  await db.query('INSERT INTO "Contract" (id, "organizationId", "extractedText", "extractedSourceFileId", "extractedSourceFileVersion", "extractedSourceHash") VALUES ($1,$2,$3,$4,$5,$6)', ["bound", "org", "text", "file", 1, hash])
  const contractFields = ["extractedSourceFileId", "extractedSourceFileVersion", "extractedSourceHash"]
  const contractValues: Record<string, unknown> = { extractedSourceFileId: "file", extractedSourceFileVersion: 1, extractedSourceHash: hash }
  for (const missing of contractFields) {
    const values = contractFields.map(field => field === missing ? null : contractValues[field])
    await rejectsCheck(db, 'INSERT INTO "Contract" (id,"organizationId","extractedSourceFileId","extractedSourceFileVersion","extractedSourceHash") VALUES ($1,$2,$3,$4,$5)', [`contract-missing-${missing}`, "org", ...values])
  }
  for (const only of contractFields) {
    const values = contractFields.map(field => field === only ? contractValues[field] : null)
    await rejectsCheck(db, 'INSERT INTO "Contract" (id,"organizationId","extractedSourceFileId","extractedSourceFileVersion","extractedSourceHash") VALUES ($1,$2,$3,$4,$5)', [`contract-only-${only}`, "org", ...values])
  }
  await rejectsCheck(db, 'INSERT INTO "Contract" (id,"organizationId","extractedSourceFileId","extractedSourceFileVersion","extractedSourceHash") VALUES ($1,$2,$3,$4,$5)', ["contract-zero-version", "org", "file", 0, hash])
  await rejectsCheck(db, 'INSERT INTO "Contract" (id,"organizationId","extractedSourceFileId","extractedSourceFileVersion","extractedSourceHash") VALUES ($1,$2,$3,$4,$5)', ["contract-bad-hash", "org", "file", 1, "bad"])

  const actionFields = ["proposedByPrincipalType", "proposedByPrincipalId", "proposalDigest", "sourceFileId", "sourceFileVersion", "sourceHash"]
  const actionValues: Record<string, unknown> = { proposedByPrincipalType: "api_key", proposedByPrincipalId: "key", proposalDigest: hash, sourceFileId: "file", sourceFileVersion: 1, sourceHash: hash }
  await db.query('INSERT INTO "ContractAction" (id,"organizationId","sourceHash","sourceFileId","sourceFileVersion","proposedByPrincipalType","proposedByPrincipalId","proposalDigest") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ["valid-action", "org", hash, "file", 1, "api_key", "key", hash])
  for (const missing of actionFields) {
    const values = actionFields.map(field => field === missing ? null : actionValues[field])
    await rejectsCheck(db, 'INSERT INTO "ContractAction" (id,"organizationId","proposedByPrincipalType","proposedByPrincipalId","proposalDigest","sourceFileId","sourceFileVersion","sourceHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [`action-missing-${missing}`, "org", ...values])
  }
  for (const only of actionFields.filter(field => field !== "sourceHash")) {
    const values = actionFields.map(field => field === only ? actionValues[field] : null)
    await rejectsCheck(db, 'INSERT INTO "ContractAction" (id,"organizationId","proposedByPrincipalType","proposedByPrincipalId","proposalDigest","sourceFileId","sourceFileVersion","sourceHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [`action-only-${only}`, "org", ...values])
  }
  await rejectsCheck(db, 'INSERT INTO "ContractAction" (id,"organizationId","sourceHash","sourceFileId","sourceFileVersion","proposedByPrincipalType","proposedByPrincipalId","proposalDigest") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ["action-unknown-type", "org", hash, "file", 1, "robot", "key", hash])
  await rejectsCheck(db, 'INSERT INTO "ContractAction" (id,"organizationId","sourceHash","sourceFileId","sourceFileVersion","proposedByPrincipalType","proposedByPrincipalId","proposalDigest") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ["action-bad-digest", "org", hash, "file", 1, "api_key", "key", "bad"])
  await rejectsCheck(db, 'INSERT INTO "ContractAction" (id,"organizationId","sourceHash","sourceFileId","sourceFileVersion","proposedByPrincipalType","proposedByPrincipalId","proposalDigest") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ["action-bad-source-hash", "org", "bad", "file", 1, "api_key", "key", hash])
  await rejectsCheck(db, 'INSERT INTO "ContractAction" (id,"organizationId","sourceHash","sourceFileId","sourceFileVersion","proposedByPrincipalType","proposedByPrincipalId","proposalDigest") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ["action-zero-source-version", "org", hash, "file", 0, "api_key", "key", hash])

  const approvalFields = ["requestPrincipalType", "requestPrincipalId", "requestIdempotencyHash", "requestDigest"]
  const approvalValues: Record<string, unknown> = { requestPrincipalType: "api_key", requestPrincipalId: "key", requestIdempotencyHash: hash, requestDigest: hash }
  await db.query('INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', ["valid-approval", "contract", "api_key", "key", hash, hash])
  for (const missing of approvalFields) {
    const values = approvalFields.map(field => field === missing ? null : approvalValues[field])
    await rejectsCheck(db, 'INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', [`approval-missing-${missing}`, "contract", ...values])
  }
  for (const only of approvalFields) {
    const values = approvalFields.map(field => field === only ? approvalValues[field] : null)
    await rejectsCheck(db, 'INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', [`approval-only-${only}`, "contract", ...values])
  }
  await rejectsCheck(db, 'INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', ["approval-unknown-type", "contract", "robot", "key", hash, hash])
  await rejectsCheck(db, 'INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', ["approval-bad-idempotency-hash", "contract", "api_key", "key", "bad", hash])
  await rejectsCheck(db, 'INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', ["approval-bad-digest", "contract", "api_key", "key", hash, "bad"])
  await assert.rejects(db.query('INSERT INTO "Approval" (id,"contractId","requestPrincipalType","requestPrincipalId","requestIdempotencyHash","requestDigest") VALUES ($1,$2,$3,$4,$5,$6)', ["duplicate-approval", "contract", "api_key", "key", hash, hash]), (error: unknown) => (error as { code?: string }).code === "23505")
}

async function main() {
  assert.equal(process.env.AAKD_AGENT_PROPOSAL_MIGRATION_PROBE, "1", "Explicit opt-in required")
  const source = new URL(process.env.DATABASE_URL ?? "")
  assert.ok(["localhost", "127.0.0.1"].includes(source.hostname) && source.port === "5433", "Disposable local PostgreSQL only")
  source.pathname = "/postgres"
  const migration = await readFile(migrationUrl, "utf8")
  const happy = await createDatabase(source, "aakd_agent_proposal_probe")
  const locked = await createDatabase(source, "aakd_agent_proposal_lock_probe")
  try {
    const happyDb = new pg.Client({ connectionString: happy.url.href })
    await happyDb.connect()
    try {
      await createBaseTables(happyDb)
      await happyDb.query(migration)
      await verifyConstraints(happyDb)
    } finally { await happyDb.end() }

    const locker = new pg.Client({ connectionString: locked.url.href })
    const migrator = new pg.Client({ connectionString: locked.url.href })
    await locker.connect()
    await migrator.connect()
    try {
      await createBaseTables(locker)
      await locker.query("BEGIN")
      await locker.query('LOCK TABLE "Contract" IN ACCESS EXCLUSIVE MODE')
      await assert.rejects(migrator.query(migration), (error: unknown) => (error as { code?: string }).code === "55P03")
      await migrator.query("ROLLBACK")
      await locker.query("ROLLBACK")
      const columns = await migrator.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('extractedSourceFileId','sourceFileId','requestPrincipalType')")
      const indexes = await migrator.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('Contract_extractedSourceFileId_idx','ContractAction_proposedByPrincipal_idx','Approval_agent_request_replay_key')")
      assert.deepEqual(columns.rows, [])
      assert.deepEqual(indexes.rows, [])
    } finally {
      await locker.end()
      await migrator.end()
    }
    console.log(JSON.stringify({ checks: "PASS", partialPermutations: "PASS", replayUniqueness: "PASS", forcedLockRollback: "PASS" }))
  } finally {
    await dropDatabase(source, happy.name)
    await dropDatabase(source, locked.name)
  }
}

main().catch(error => {
  console.error("Synthetic agent-proposal migration probe failed", { type: error instanceof Error ? error.name : "UnknownError" })
  process.exitCode = 1
})
