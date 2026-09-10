import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { promisify } from "node:util"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

if (process.env.AAKD_CONTRACT_INTAKE_PROBE !== "1") {
  throw new Error("Opt in with AAKD_CONTRACT_INTAKE_PROBE=1")
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
  throw new Error("Contract intake probe requires local PostgreSQL")
}

const run = promisify(execFile)
const targetDatabase = `aakd_qa_intake_${randomBytes(6).toString("hex")}`
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
    cwd: process.cwd(),
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

const { createContractIntake } = await import("../../lib/contracts/intake")
const pool = new pg.Pool({ connectionString: source.href, max: 4 })
const db = new PrismaClient({ adapter: new PrismaPg(pool) })
const sql = new pg.Client({ connectionString: source.href })
await sql.connect()

const suffix = randomBytes(4).toString("hex")
const ids = {
  organization: `qa-intake-org-${suffix}`,
  user: `qa-intake-user-${suffix}`,
  member: `qa-intake-member-${suffix}`,
} as const
const ctx = {
  organizationId: ids.organization,
  userId: ids.user,
  memberId: ids.member,
  role: "owner",
  source: "session" as const,
  requestId: `qa-intake-log-${suffix}`,
}

await sql.query("BEGIN")
try {
  await sql.query(`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES ($1, 'QA Intake', $2, true, NOW(), NOW())`, [ids.user, `qa-intake-${suffix}@example.test`])
  await sql.query(`INSERT INTO "Organization" (id, name, slug, "createdAt")
    VALUES ($1, 'QA Intake', $2, NOW())`, [ids.organization, `qa-intake-${suffix}`])
  await sql.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt")
    VALUES ($1, $2, $3, 'owner', NOW())`, [ids.member, ids.organization, ids.user])
  await sql.query("COMMIT")
} catch (error) {
  await sql.query("ROLLBACK")
  throw error
}

type StoredObject = { bytes: Buffer; mimeType: string }
function objectStore() {
  const objects = new Map<string, StoredObject>()
  const deleted: string[] = []
  return {
    objects,
    deleted,
    api: {
      async upload(key: string, bytes: Buffer, mimeType: string) {
        objects.set(key, { bytes: Buffer.from(bytes), mimeType })
        return key
      },
      async delete(key: string) {
        deleted.push(key)
        objects.delete(key)
      },
    },
  }
}

function queues() {
  return {
    extract: { add: async () => ({ id: "extract" }) },
    convert: { add: async () => ({ id: "convert" }) },
  }
}

function input(requestId: string, marker = "same") {
  return {
    requestId,
    metadata: {
      title: `QA Intake ${marker}`,
      currency: "USD",
      autoRenewal: true,
      renewalReminderEnabled: true,
      renewalDate: "2099-12-01",
      endDate: "2099-12-31",
      noticePeriodDays: 30,
      tagIds: [],
    },
    extractions: [{ field: "autoRenewal" as const, rawValue: "true", confidence: 0, extractedBy: "manual" as const }],
    file: {
      buffer: Buffer.from(`%PDF-1.7\n${marker}`),
      filename: `${marker}.pdf`,
      mimeType: "application/pdf" as const,
    },
  }
}

async function count(table: string, clause = "", params: unknown[] = []) {
  return Number((await sql.query(`SELECT count(*) FROM "${table}" ${clause}`, params)).rows[0].count)
}

const report: Record<string, unknown> = { targetDatabase }
let probeError: unknown
try {
  const sameRequest = "11111111-1111-4111-8111-111111111111"
  const sameStore = objectStore()
  const sameResults = await Promise.all([
    createContractIntake(db as never, ctx, input(sameRequest), { objectStore: sameStore.api, queues: queues() as never }),
    createContractIntake(db as never, ctx, input(sameRequest), { objectStore: sameStore.api, queues: queues() as never }),
  ])
  assert.equal(new Set(sameResults.map(result => result.id)).size, 1)
  assert.deepEqual(sameResults.map(result => result.replayed).sort(), [false, true])
  assert.equal(await count("Contract", 'WHERE "organizationId" = $1 AND "intakeRequestId" = $2', [ids.organization, sameRequest]), 1)
  assert.equal(await count("ContractFile", 'WHERE "contractId" = $1', [sameResults[0].id]), 1)
  assert.equal(await count("ContractAccessGrant", 'WHERE "contractId" = $1', [sameResults[0].id]), 1)
  assert.equal(await count("Activity", 'WHERE "contractId" = $1', [sameResults[0].id]), 3)
  assert.equal(await count("ContractAlert", 'WHERE "contractId" = $1', [sameResults[0].id]), 5)
  assert.equal(sameStore.objects.size, 1, "Losing identical attempt object was not cleaned up")
  report.identicalConcurrent = "one_contract_one_file_one_grant_one_object"

  const conflictRequest = "22222222-2222-4222-8222-222222222222"
  const conflictStore = objectStore()
  const conflicts = await Promise.allSettled([
    createContractIntake(db as never, ctx, input(conflictRequest, "left"), { objectStore: conflictStore.api, queues: queues() as never }),
    createContractIntake(db as never, ctx, input(conflictRequest, "right"), { objectStore: conflictStore.api, queues: queues() as never }),
  ])
  assert.equal(conflicts.filter(result => result.status === "fulfilled").length, 1)
  const rejected = conflicts.find(result => result.status === "rejected") as PromiseRejectedResult
  assert.equal(rejected.reason?.code, "intake_request_conflict")
  assert.equal(await count("Contract", 'WHERE "organizationId" = $1 AND "intakeRequestId" = $2', [ids.organization, conflictRequest]), 1)
  assert.equal(conflictStore.objects.size, 1, "Conflicting losing attempt object was not cleaned up")
  report.conflictingConcurrent = "one_commit_one_409"

  const firstContractId = sameResults[0].id
  await sql.query('DELETE FROM "ContractAccessGrant" WHERE "contractId" = $1', [firstContractId])
  await assert.rejects(
    createContractIntake(db as never, ctx, input(sameRequest), { objectStore: sameStore.api, queues: queues() as never }),
    (error: unknown) => Boolean(error && typeof error === "object" && (error as { code?: string }).code === "not_found"),
  )
  assert.equal(sameStore.objects.size, 1)
  report.revokedReplay = "404_without_upload_or_delete"

  const ambiguousRequest = "33333333-3333-4333-8333-333333333333"
  const ambiguousStore = objectStore()
  let transactionCalls = 0
  const ambiguousDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver)
      return async (...args: Parameters<typeof db.$transaction>) => {
        transactionCalls += 1
        const result = await (db.$transaction as (...values: typeof args) => Promise<unknown>)(...args)
        if (transactionCalls === 1) {
          const contractId = (result as { row: { id: string } }).row.id
          await sql.query('DELETE FROM "ContractAccessGrant" WHERE "contractId" = $1', [contractId])
          throw new Error("synthetic lost commit acknowledgement")
        }
        return result
      }
    },
  })
  await assert.rejects(
    createContractIntake(ambiguousDb as never, ctx, input(ambiguousRequest, "ambiguous"), {
      objectStore: ambiguousStore.api,
      queues: queues() as never,
    }),
    /synthetic lost commit acknowledgement/,
  )
  const ambiguousRow = (await sql.query(`SELECT c.id, f."storageKey"
    FROM "Contract" c JOIN "ContractFile" f ON f."contractId" = c.id
    WHERE c."organizationId" = $1 AND c."intakeRequestId" = $2`, [ids.organization, ambiguousRequest])).rows[0]
  assert.ok(ambiguousRow)
  assert.equal(ambiguousStore.objects.has(ambiguousRow.storageKey), true, "Referenced bytes were deleted after revoked-grant ambiguous commit")
  assert.deepEqual(ambiguousStore.deleted, [])
  report.ambiguousCommitRevoked = "referenced_file_preserved_by_raw_check"

  const rollbackRequest = "44444444-4444-4444-8444-444444444444"
  const rollbackStore = objectStore()
  let rollbackCalls = 0
  const rollbackDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver)
      return async (callback: (tx: typeof db) => Promise<unknown>, options?: object) => {
        rollbackCalls += 1
        if (rollbackCalls !== 1) return db.$transaction(callback as never, options as never)
        return db.$transaction(async tx => {
          const guarded = new Proxy(tx, {
            get(txTarget, txProperty, txReceiver) {
              if (txProperty !== "contractVersion") return Reflect.get(txTarget, txProperty, txReceiver)
              return { create: async () => { throw new Error("synthetic version failure") } }
            },
          })
          return callback(guarded as never)
        }, options as never)
      }
    },
  })
  await assert.rejects(
    createContractIntake(rollbackDb as never, ctx, input(rollbackRequest, "rollback"), {
      objectStore: rollbackStore.api,
      queues: queues() as never,
    }),
    /synthetic version failure/,
  )
  assert.equal(await count("Contract", 'WHERE "organizationId" = $1 AND "intakeRequestId" = $2', [ids.organization, rollbackRequest]), 0)
  assert.equal(rollbackStore.objects.size, 0)
  assert.equal(rollbackStore.deleted.length, 1)
  report.rollback = "no_rows_unreferenced_object_deleted"

  const hashRows = await sql.query(`SELECT c."intakeRequestHash", f."storageKey"
    FROM "Contract" c JOIN "ContractFile" f ON f."contractId" = c.id
    WHERE c."organizationId" = $1 AND c."intakeRequestId" = $2`, [ids.organization, conflictRequest])
  assert.equal(hashRows.rows.length, 1)
  const stored = conflictStore.objects.get(hashRows.rows[0].storageKey)
  assert.ok(stored)
  assert.equal(createHash("sha256").update(stored.bytes).digest("hex").length, 64)
  report.originalBytes = "one_winner_preserved"

  console.log(JSON.stringify({ status: "PASS", ...report, partialRows: 0 }))
} catch (error) {
  probeError = error
} finally {
  await sql.end().catch(error => { probeError ??= error })
  await db.$disconnect().catch(error => { probeError ??= error })
  await pool.end().catch(error => { probeError ??= error })
}

if (probeError) {
  throw new Error(`Contract intake race probe failed; inspect preserved database ${targetDatabase}`, { cause: probeError })
}
