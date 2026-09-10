import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"

// PostgreSQL DDL recovery only. The separate upgrade probe verifies the full
// Prisma history, existing records, stored bytes and authenticated application.
async function main() {
  const source = new URL(process.env.DATABASE_URL ?? "")
  assert.equal(process.env.AAKD_INTAKE_MIGRATION_PROBE, "1", "Explicit opt-in required")
  assert.ok(["localhost", "127.0.0.1"].includes(source.hostname) && source.port === "5433", "Disposable local PostgreSQL only")
  const database = `aakd_intake_ddl_${randomBytes(6).toString("hex")}`
  source.pathname = "/postgres"
  const admin = new pg.Client({ connectionString: source.href })
  await admin.connect()
  try { await admin.query(`CREATE DATABASE "${database}"`) } finally { await admin.end() }
  source.pathname = `/${database}`
  const db = new pg.Client({ connectionString: source.href })
  await db.connect()
  try {
    await db.query('CREATE TABLE "Contract" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, title TEXT NOT NULL)')
    await db.query(`INSERT INTO "Contract" VALUES ('one', 'synthetic-org', 'Preserved one'), ('two', 'synthetic-org', 'Preserved two')`)
    const migration = await readFile(new URL("../../prisma/migrations/20260909200000_contract_intake_replay/migration.sql", import.meta.url), "utf8")
    const boundary = migration.indexOf("CREATE UNIQUE INDEX CONCURRENTLY")
    assert.ok(boundary > 0)
    const columns = migration.slice(0, boundary)
    const index = migration.slice(boundary)
    // A process stops after ALTER TABLE commits but before the concurrent index.
    await db.query(columns)
    const preserved = (await db.query('SELECT * FROM "Contract" ORDER BY id')).rows
    await db.query(index)
    assert.deepEqual((await db.query('SELECT * FROM "Contract" ORDER BY id')).rows, preserved)
    const validIndex = async () => (await db.query(`SELECT indisvalid, indisready, indisunique FROM pg_index WHERE indexrelid = to_regclass('"Contract_organizationId_intakeRequestId_key"')`)).rows[0]
    assert.deepEqual(await validIndex(), { indisvalid: true, indisready: true, indisunique: true })

    // Independently reproduce the invalid-index residue left by a failed
    // concurrent uniqueness build. Only this disposable fixture is modified.
    await db.query('DROP INDEX CONCURRENTLY "Contract_organizationId_intakeRequestId_key"')
    await db.query(`UPDATE "Contract" SET "intakeRequestId" = 'synthetic-duplicate', "intakeRequestHash" = 'hash', "intakeRequestedByMemberId" = 'member'`)
    await assert.rejects(db.query(index), (error: unknown) => (error as { code?: string }).code === "23505")
    assert.equal((await validIndex()).indisvalid, false)
    assert.equal(Number((await db.query('SELECT count(*) FROM "Contract"')).rows[0].count), 2)
    // Simulated reviewed correction of synthetic fixture identity, never an
    // automatic production duplicate-removal procedure.
    await db.query(`UPDATE "Contract" SET "intakeRequestId" = 'synthetic-distinct' WHERE id = 'two'`)
    const repairedRows = (await db.query('SELECT * FROM "Contract" ORDER BY id')).rows
    await db.query('DROP INDEX CONCURRENTLY "Contract_organizationId_intakeRequestId_key"')
    await db.query(index)
    assert.deepEqual(await validIndex(), { indisvalid: true, indisready: true, indisunique: true })
    assert.deepEqual((await db.query('SELECT * FROM "Contract" ORDER BY id')).rows, repairedRows)
    assert.deepEqual(repairedRows.map(row => [row.id, row.title]), [["one", "Preserved one"], ["two", "Preserved two"]])
    console.log(JSON.stringify({ database, columnsCommittedRecovery: "PASS", invalidConcurrentIndexRecovery: "PASS", originalRowsPreserved: "PASS", prismaResolution: "NOT_TESTED_BY_THIS_PROBE" }))
  } finally { await db.end() }
}

main().catch(error => {
  console.error("Synthetic intake migration recovery failed", { type: error instanceof Error ? error.name : "UnknownError" })
  process.exitCode = 1
})
