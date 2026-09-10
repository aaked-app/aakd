import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { promisify } from "node:util"
import type { Prisma } from "@prisma/client"
import pg from "pg"

if (process.env.AAKD_PERMISSION_LOCK_PROBE !== "1") {
  throw new Error("Opt in with AAKD_PERMISSION_LOCK_PROBE=1")
}

const rootEnvLoaded = await import("./root-env") as unknown as {
  loadRootComposeEnv?: () => void
  default?: { loadRootComposeEnv: () => void }
}
const loadRootComposeEnv = rootEnvLoaded.loadRootComposeEnv ?? rootEnvLoaded.default?.loadRootComposeEnv
if (!loadRootComposeEnv) throw new Error("Could not load the root environment helper")
loadRootComposeEnv()

const source = new URL(process.env.DATABASE_URL ?? "")
if (!['localhost', '127.0.0.1'].includes(source.hostname)) {
  throw new Error("Permission lock probe requires local PostgreSQL")
}

const run = promisify(execFile)
const webRoot = process.cwd()
const targetDatabase = `aakd_qa_permission_lock_${randomBytes(6).toString("hex")}`
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
const accessLoaded = await import("../../lib/auth/agreement-access") as unknown as {
  lockCurrentAgreementPermission?: typeof import("../../lib/auth/agreement-access")["lockCurrentAgreementPermission"]
  default?: typeof import("../../lib/auth/agreement-access")
}
const lockCurrentAgreementPermission = accessLoaded.lockCurrentAgreementPermission
  ?? accessLoaded.default?.lockCurrentAgreementPermission
if (!lockCurrentAgreementPermission) throw new Error("Could not load agreement permission helper")
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
  organization: "qa-lock-org",
  owner: "qa-lock-owner",
  newOwner: "qa-lock-new-owner",
  actor: "qa-lock-actor",
  ownerMember: "qa-lock-owner-member",
  newOwnerMember: "qa-lock-new-owner-member",
  actorMember: "qa-lock-actor-member",
  contract: "qa-lock-contract",
  grant: "qa-lock-actor-grant",
} as const
const ctx = {
  organizationId: ids.organization,
  userId: ids.actor,
  memberId: ids.actorMember,
}
const isolationLevel: "ReadCommitted" | "Serializable" =
  process.env.AAKD_PERMISSION_LOCK_ISOLATION === "ReadCommitted" ? "ReadCommitted" : "Serializable"

await sql.query("BEGIN")
try {
  await sql.query(`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
    ($1, 'QA Owner', 'qa-lock-owner@example.test', true, NOW(), NOW()),
    ($2, 'QA New Owner', 'qa-lock-new-owner@example.test', true, NOW(), NOW()),
    ($3, 'QA Actor', 'qa-lock-actor@example.test', true, NOW(), NOW())`,
  [ids.owner, ids.newOwner, ids.actor])
  await sql.query(`INSERT INTO "Organization" (id, name, slug, "createdAt")
    VALUES ($1, 'QA Permission Lock', $2, NOW())`,
  [ids.organization, `qa-permission-lock-${randomBytes(4).toString("hex")}`])
  await sql.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt") VALUES
    ($1, $2, $3, 'owner', NOW()),
    ($4, $2, $5, 'owner', NOW()),
    ($6, $2, $7, 'admin', NOW())`,
  [ids.ownerMember, ids.organization, ids.owner, ids.newOwnerMember, ids.newOwner, ids.actorMember, ids.actor])
  await sql.query(`INSERT INTO "Contract"
    (id, title, "contractType", "ownerId", "organizationId", notes, "updatedAt")
    VALUES ($1, 'QA Permission Lock Contract', 'OTHER', $2, $3, 'baseline', NOW())`,
  [ids.contract, ids.owner, ids.organization])
  await sql.query(`INSERT INTO "ContractAccessGrant"
    (id, "organizationId", "contractId", "memberId", "grantedById") VALUES ($1, $2, $3, $4, $5)`,
  [ids.grant, ids.organization, ids.contract, ids.actorMember, ids.owner])
  await sql.query("COMMIT")
} catch (error) {
  await sql.query("ROLLBACK")
  throw error
}

async function currentPermission() {
  return runPermissionTransaction((tx) => lockCurrentAgreementPermission(tx, ctx, ids.contract))
}

async function runPermissionTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return withTransactionRetry(() => db.$transaction(operation, {
    isolationLevel,
    maxWait: 5_000,
    timeout: 10_000,
  }))
}

async function mutateIfAdmin(note: string, gate?: Promise<void>, onAttempt?: () => void) {
  return runPermissionTransaction(async (tx) => {
    onAttempt?.()
    const current = await lockCurrentAgreementPermission(tx, ctx, ids.contract)
    const allowed = Boolean(current && (current.role === "owner" || current.role === "admin"))
    if (!allowed) return { applied: false, current }
    await tx.contract.update({ where: { id: ids.contract }, data: { notes: note } })
    if (gate) await gate
    return { applied: true, current }
  })
}

async function expectBlocked<T>(promise: Promise<T>, label: string) {
  let settled = false
  void promise.then(() => { settled = true }, () => { settled = true })
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.equal(settled, false, `${label} did not serialize on the expected row lock`)
}

async function note() {
  return (await sql.query('SELECT notes FROM "Contract" WHERE id = $1', [ids.contract])).rows[0].notes as string
}

async function insertActorGrant() {
  await sql.query(`INSERT INTO "ContractAccessGrant"
    (id, "organizationId", "contractId", "memberId", "grantedById") VALUES ($1, $2, $3, $4, $5)`,
  [ids.grant, ids.organization, ids.contract, ids.actorMember, ids.owner])
}

const report: Record<string, unknown> = { targetDatabase }
let probeError: unknown
try {
  assert.deepEqual(await currentPermission(), { contractOwnerId: ids.owner, role: "admin" })

  await sql.query('DELETE FROM "ContractAccessGrant" WHERE id = $1', [ids.grant])
  assert.equal(await currentPermission(), null, "Missing exact grant remained authorized")
  await insertActorGrant()

  await sql.query('DELETE FROM "ContractAccessGrant" WHERE id = $1', [ids.grant])
  await sql.query('DELETE FROM "Member" WHERE id = $1', [ids.actorMember])
  assert.equal(await currentPermission(), null, "Removed membership remained authorized")
  await sql.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt")
    VALUES ($1, $2, $3, 'admin', NOW())`, [ids.actorMember, ids.organization, ids.actor])
  await insertActorGrant()

  await sql.query(`UPDATE "Member" SET role = 'member' WHERE id = $1`, [ids.actorMember])
  const downgraded = await mutateIfAdmin("must-not-apply")
  assert.deepEqual(downgraded.current, { contractOwnerId: ids.owner, role: "member" })
  assert.equal(downgraded.applied, false)
  assert.equal(await note(), "baseline")
  await sql.query(`UPDATE "Member" SET role = 'admin' WHERE id = $1`, [ids.actorMember])

  await sql.query('UPDATE "Contract" SET "ownerId" = $1 WHERE id = $2', [ids.newOwner, ids.contract])
  assert.deepEqual(await currentPermission(), { contractOwnerId: ids.newOwner, role: "admin" })
  await sql.query('UPDATE "Contract" SET "ownerId" = $1 WHERE id = $2', [ids.owner, ids.contract])

  const revokeFirst = new pg.Client({ connectionString: source.href })
  await revokeFirst.connect()
  await revokeFirst.query("BEGIN")
  await revokeFirst.query('DELETE FROM "ContractAccessGrant" WHERE id = $1', [ids.grant])
  let revocationFirstAttempts = 0
  const blockedMutation = mutateIfAdmin(
    "revocation-first-must-not-apply",
    undefined,
    () => { revocationFirstAttempts += 1 },
  )
  await expectBlocked(blockedMutation, "permission mutation behind uncommitted revocation")
  await revokeFirst.query("COMMIT")
  await revokeFirst.end()
  const deniedAfterCommit = await blockedMutation
  assert.equal(deniedAfterCommit.applied, false)
  assert.equal(deniedAfterCommit.current, null)
  assert.equal(revocationFirstAttempts, isolationLevel === "Serializable" ? 2 : 1)
  assert.equal(await note(), "baseline")
  report.revocationFirst = "denied_without_mutation"

  await insertActorGrant()
  let releaseMutation!: () => void
  const holdMutation = new Promise<void>((resolve) => { releaseMutation = resolve })
  let mutationAuthorized!: () => void
  const authorized = new Promise<void>((resolve) => { mutationAuthorized = resolve })
  const mutationFirst = runPermissionTransaction(async (tx) => {
    const current = await lockCurrentAgreementPermission(tx, ctx, ids.contract)
    assert.deepEqual(current, { contractOwnerId: ids.owner, role: "admin" })
    await tx.contract.update({ where: { id: ids.contract }, data: { notes: "mutation-first-applied" } })
    mutationAuthorized()
    await holdMutation
    return current
  })
  await authorized

  const revokeSecond = new pg.Client({ connectionString: source.href })
  await revokeSecond.connect()
  await revokeSecond.query("BEGIN")
  const delayedDelete = revokeSecond.query('DELETE FROM "ContractAccessGrant" WHERE id = $1', [ids.grant])
  await expectBlocked(delayedDelete, "revocation behind authorized permission mutation")
  releaseMutation()
  await mutationFirst
  assert.equal((await delayedDelete).rowCount, 1)
  await revokeSecond.query("COMMIT")
  await revokeSecond.end()
  assert.equal(await note(), "mutation-first-applied")
  assert.equal(Number((await sql.query('SELECT count(*) FROM "ContractAccessGrant" WHERE id = $1', [ids.grant])).rows[0].count), 0)
  report.mutationFirst = "committed_then_revoked"

  await insertActorGrant()
  await sql.query(`UPDATE "Contract" SET notes = 'baseline' WHERE id = $1`, [ids.contract])
  const downgradeFirst = new pg.Client({ connectionString: source.href })
  await downgradeFirst.connect()
  await downgradeFirst.query("BEGIN")
  await downgradeFirst.query(`UPDATE "Member" SET role = 'member' WHERE id = $1`, [ids.actorMember])
  const blockedByDowngrade = mutateIfAdmin("downgrade-first-must-not-apply")
  await expectBlocked(blockedByDowngrade, "permission mutation behind role downgrade")
  await downgradeFirst.query("COMMIT")
  await downgradeFirst.end()
  const deniedByRole = await blockedByDowngrade
  assert.equal(deniedByRole.applied, false)
  assert.deepEqual(deniedByRole.current, { contractOwnerId: ids.owner, role: "member" })
  assert.equal(await note(), "baseline")
  report.downgradeFirst = "current_role_observed_without_mutation"

  await sql.query(`UPDATE "Member" SET role = 'admin' WHERE id = $1`, [ids.actorMember])
  const transferFirst = new pg.Client({ connectionString: source.href })
  await transferFirst.connect()
  await transferFirst.query("BEGIN")
  await transferFirst.query('UPDATE "Contract" SET "ownerId" = $1 WHERE id = $2', [ids.newOwner, ids.contract])
  const blockedByTransfer = currentPermission()
  await expectBlocked(blockedByTransfer, "permission read behind owner transfer")
  await transferFirst.query("COMMIT")
  await transferFirst.end()
  assert.deepEqual(await blockedByTransfer, { contractOwnerId: ids.newOwner, role: "admin" })
  report.ownerTransferFirst = "current_owner_observed"

  const membershipDeleteFirst = new pg.Client({ connectionString: source.href })
  await membershipDeleteFirst.connect()
  await membershipDeleteFirst.query("BEGIN")
  await membershipDeleteFirst.query('DELETE FROM "ContractAccessGrant" WHERE id = $1', [ids.grant])
  await membershipDeleteFirst.query('DELETE FROM "Member" WHERE id = $1', [ids.actorMember])
  const blockedByMembershipDelete = mutateIfAdmin("membership-delete-first-must-not-apply")
  await expectBlocked(blockedByMembershipDelete, "permission mutation behind uncommitted membership deletion")
  await membershipDeleteFirst.query("COMMIT")
  await membershipDeleteFirst.end()
  const deniedByMembershipDelete = await blockedByMembershipDelete
  assert.equal(deniedByMembershipDelete.applied, false)
  assert.equal(deniedByMembershipDelete.current, null)
  assert.equal(await note(), "baseline")
  report.membershipDeleteFirst = "denied_without_mutation"

  console.log(JSON.stringify({ status: "PASS", isolationLevel, ...report, deadlocks: 0, partialMutations: 0 }))
} catch (error) {
  probeError = error
} finally {
  await sql.end().catch((error) => { probeError ??= error })
  await db.$disconnect().catch((error) => { probeError ??= error })
}

if (probeError) {
  throw new Error(`Agreement permission lock probe failed; inspect preserved database ${targetDatabase}`, {
    cause: probeError,
  })
}
