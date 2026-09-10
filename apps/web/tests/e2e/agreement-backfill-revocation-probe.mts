import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pg from "pg"

const template = process.env.AAKD_BACKFILL_PROBE_TEMPLATE ?? ""
const url = new URL(process.env.DATABASE_URL ?? "")
if (process.env.AAKD_BACKFILL_PROBE !== "1" || !/^aakd_upgrade_[a-f0-9]{12}$/.test(template)
  || url.hostname !== "127.0.0.1" || url.port !== "5433") throw new Error("Requires explicit local synthetic-upgrade template")
const suffix = randomBytes(6).toString("hex")
const database = `aakd_backfill_${suffix}`
const adminUrl = new URL(url); adminUrl.pathname = "/postgres"
const admin = new pg.Client({ connectionString: adminUrl.href })
await admin.connect()
try { await admin.query(`CREATE DATABASE "${database}" TEMPLATE "${template}"`) } finally { await admin.end() }
url.pathname = `/${database}`
const env = { ...process.env, DATABASE_URL: url.href, DIRECT_URL: url.href }
const db = new pg.Client({ connectionString: url.href })
await db.connect()
const directory = await mkdtemp(join(tmpdir(), "aakd-backfill-revocation-"))

function cli(script: string, args: string[] = []) {
  return execFileSync(process.execPath, ["--import", "tsx", `scripts/${script}.ts`, ...args], { env, stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 })
}
function json(output: Buffer) { const text = output.toString(); return JSON.parse(text.slice(text.indexOf("{"))) }

try {
  const owner = (await db.query('SELECT "userId", "organizationId", id FROM "Member" WHERE role = \'owner\' ORDER BY id LIMIT 1')).rows[0]
  assert.ok(owner)
  const recipient = `recipient-${suffix}`
  const oldMember = `old-${suffix}`
  const newMember = `new-${suffix}`
  const brief = `brief-${suffix}`
  const secondOrg = `second-${suffix}`
  await db.query('INSERT INTO "User" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,\'Synthetic recipient\',$2,true,NOW(),NOW())', [recipient, `${recipient}@example.test`])
  await db.query('INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,\'member\',NOW())', [oldMember, owner.organizationId, recipient])
  await db.query('INSERT INTO "TeamBrief" (id,"organizationId",title,"publishedById","audienceUserId","audienceMemberId") VALUES ($1,$2,\'Synthetic reviewed Brief\',$3,$4,$5)', [brief, owner.organizationId, owner.userId, recipient, oldMember])
  // Only the probe-created recipient membership is removed. Its FK must revoke the Brief.
  await db.query('DELETE FROM "Member" WHERE id=$1', [oldMember])
  await db.query('INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,\'member\',NOW())', [newMember, owner.organizationId, recipient])
  assert.equal((await db.query('SELECT "audienceMemberId" FROM "TeamBrief" WHERE id=$1', [brief])).rows[0].audienceMemberId, null)
  await db.query('INSERT INTO "Organization" (id,name,slug,"createdAt") VALUES ($1,\'Synthetic second org\',$1,NOW())', [secondOrg])
  await db.query('INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,\'owner\',NOW())', [`second-owner-${suffix}`, secondOrg, recipient])
  for (const [org, user] of [[owner.organizationId, owner.userId], [secondOrg, recipient]]) {
    await db.query('INSERT INTO "Contract" (id,title,"organizationId","ownerId","updatedAt") VALUES ($1,\'Synthetic unbound agreement\',$2,$3,NOW())', [`new-contract-${org}-${suffix}`, org, user])
  }

  async function reviewedArgs(actor: string) {
    const report = json(cli("agreement-access-preflight"))
    const row = report.briefs.find((value: { briefId: string }) => value.briefId === brief)
    assert.equal(row.status, "audience_unbound")
    assert.equal(row.plannedAudienceMemberId, null)
    const mapping = join(directory, "mapping.json")
    await writeFile(mapping, JSON.stringify(report), { mode: 0o600 })
    return ["--mapping", mapping, "--approved-sha256", report.mappingSha256, "--actor-user-id", actor, "--request-id", `synthetic-${suffix}`]
  }
  const before = (await db.query('SELECT COUNT(*)::int AS count FROM "ContractAccessGrant"')).rows[0].count
  let rejected = false
  try { cli("agreement-access-backfill", await reviewedArgs(owner.userId)) } catch { rejected = true }
  assert.equal(rejected, true, "Actor missing one affected organization must fail")
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "ContractAccessGrant"')).rows[0].count, before)

  await db.query('INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,\'admin\',NOW())', [`operator-${suffix}`, secondOrg, owner.userId])
  const downgradeArgs = await reviewedArgs(owner.userId)
  await db.query('UPDATE "Member" SET role=\'member\' WHERE id=$1', [owner.id])
  rejected = false
  try { cli("agreement-access-backfill", downgradeArgs) } catch { rejected = true }
  assert.equal(rejected, true, "Actor downgrade after mapping review must fail")
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "ContractAccessGrant"')).rows[0].count, before)
  await db.query('UPDATE "Member" SET role=\'owner\' WHERE id=$1', [owner.id])
  const result = json(cli("agreement-access-backfill", await reviewedArgs(owner.userId)))
  assert.equal(result.insertedGrants, 2)
  assert.equal(result.updatedBriefs, 0)
  assert.equal((await db.query('SELECT "audienceMemberId" FROM "TeamBrief" WHERE id=$1', [brief])).rows[0].audienceMemberId, null)
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "Activity" WHERE action=\'ACCESS_GRANTED\' AND metadata->>\'requestId\'=$1', [`synthetic-${suffix}`])).rows[0].count, 2)
  const evidence = { database, template, missingOrgDenied: true, postReviewDowngradeDenied: true, rollbackNoPartialGrants: true, rejoinedBriefRemainsUnbound: true, insertedGrants: 2, auditRows: 2 }
  await writeFile(join(directory, "result.json"), JSON.stringify(evidence, null, 2), { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ ...evidence, evidenceDirectory: directory })}\n`)
} finally { await db.end() }
