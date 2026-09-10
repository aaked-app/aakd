import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import pg from "pg"

// Real route handlers, real authentication and PostgreSQL. No HTTP/browser
// coverage is inferred from this deliberately isolated boundary probe.
if (process.env.AAKD_READ_SCOPE_PROBE !== "1") throw new Error("Opt in with AAKD_READ_SCOPE_PROBE=1")
const database = new URL(process.env.DATABASE_URL ?? "")
if (!["localhost", "127.0.0.1"].includes(database.hostname) || !/^\/aakd_acceptance_[0-9]+$/.test(database.pathname)) {
  throw new Error("Probe requires an explicitly selected local acceptance database")
}
const suffix = randomBytes(8).toString("hex")
const user = `scope-user-${suffix}`
const org = `scope-org-${suffix}`
const otherOrg = `scope-other-${suffix}`
const member = `scope-member-${suffix}`
const allowed = `scope-allowed-${suffix}`
const denied = `scope-denied-${suffix}`
const keyIds: string[] = []
const sql = new pg.Client({ connectionString: database.href })
await sql.connect()
const route = async (module: unknown) => {
  const value = module as { GET?: (req: Request) => Promise<Response>; default?: { GET?: (req: Request) => Promise<Response> } }
  const handler = value.GET ?? value.default?.GET
  assert.ok(handler, "Native route handler must exist")
  return handler
}
const activityGET = await route(await import("../../app/api/activities/route"))
const notificationsGET = await route(await import("../../app/api/notifications/route"))
const dbModule = await import("../../lib/db/client") as unknown as {
  prisma?: { $disconnect(): Promise<void> }; default?: { prisma: { $disconnect(): Promise<void> } }
}

try {
  await sql.query("BEGIN")
  await sql.query('INSERT INTO "User" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,true,NOW(),NOW())', [user, "Synthetic Scope Probe", `${suffix}@example.test`])
  for (const id of [org, otherOrg]) await sql.query('INSERT INTO "Organization" (id,name,slug,"createdAt") VALUES ($1,$2,$1,NOW())', [id, "Synthetic Scope Organization"])
  await sql.query('INSERT INTO "Member" (id,"organizationId","userId",role,"createdAt") VALUES ($1,$2,$3,\'viewer\',NOW())', [member, org, user])
  for (const id of [allowed, denied]) {
    await sql.query('INSERT INTO "Contract" (id,title,"ownerId","organizationId","updatedAt") VALUES ($1,$1,$2,$3,NOW())', [id, user, org])
    await sql.query('INSERT INTO "Activity" (id,"contractId",action,detail,metadata) VALUES ($1,$2,\'UPDATED\',$3,$4::jsonb)', [`activity-${id}`, id, `private-${id}`, JSON.stringify({ excerpt: `private-${id}` })])
  }
  await sql.query('INSERT INTO "ContractAccessGrant" (id,"organizationId","contractId","memberId","grantedById") VALUES ($1,$2,$3,$4,$5)', [`grant-${suffix}`, org, allowed, member, user])
  for (const id of [org, otherOrg]) await sql.query('INSERT INTO "Notification" (id,"userId","organizationId","eventName",title,body,"actionUrl") VALUES ($1,$2,$3,\'org.invited\',$3,\'private invitation\',\'/accept-invitation?private-token\')', [`notification-${id}`, user, id])
  await sql.query("COMMIT")

  const keys = new Map<string, string>()
  for (const scopes of [["read"], ["read", "text_read"], ["write"], ["action_propose"], ["text_read"]]) {
    const raw = `cf_live_${randomBytes(32).toString("hex")}`
    const id = `scope-key-${randomBytes(8).toString("hex")}`
    await sql.query('INSERT INTO "ApiKey" (id,name,"keyHash","lookupHash",prefix,"organizationId","createdById",scopes) VALUES ($1,\'Synthetic scope probe\',$2,$3,\'cf_live_probe\',$4,$5,$6)', [id, await bcrypt.hash(raw, 12), createHash("sha256").update(raw).digest("hex"), org, user, scopes])
    keyIds.push(id)
    keys.set(scopes.join("+"), raw)
  }
  const request = (raw: string, search = "") => new Request(`http://localhost/api/probe${search}`, { headers: { Authorization: `Bearer ${raw}` } })
  for (const capability of ["read", "read+text_read"]) {
    const raw = keys.get(capability)!
    const response = await activityGET(request(raw))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.total, 1)
    assert.deepEqual(body.activities.map((row: { contractId: string }) => row.contractId), [allowed])
    assert.equal(JSON.stringify(body).includes(denied), false)
    assert.equal(JSON.stringify(body).includes("private-"), capability === "read+text_read")
    const search = await activityGET(request(raw, `?search=${denied}`))
    assert.equal((await search.json()).total, 0)
    const notification = await notificationsGET(request(raw))
    const notificationBody = await notification.json()
    assert.equal(notificationBody.notifications.length, 1)
    assert.equal(notificationBody.notifications[0].title, org)
    assert.equal(JSON.stringify(notificationBody).includes(otherOrg), false)
    assert.equal(JSON.stringify(notificationBody).includes("private"), false)
  }
  for (const capability of ["write", "action_propose", "text_read"]) {
    assert.equal((await activityGET(request(keys.get(capability)!))).status, 401)
    assert.equal((await notificationsGET(request(keys.get(capability)!))).status, 401)
  }
  process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
  assert.equal((await (await activityGET(request(keys.get("read+text_read")!))).json()).total, 0)
  process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "false"
  await sql.query('DELETE FROM "ContractAccessGrant" WHERE id=$1 AND "memberId"=$2', [`grant-${suffix}`, member])
  assert.equal((await (await activityGET(request(keys.get("read")!))).json()).total, 0)
  console.log(JSON.stringify({ status: "PASS", database: database.pathname.slice(1), syntheticOrganization: org, exactAgreementGrants: true, crossOrgInvitationsDenied: true, metadataRedaction: true, explicitReadRequired: true, emergencyDenyAll: true, revokedGrantDenied: true, transport: "real handlers and PostgreSQL, not HTTP" }))
} finally {
  await sql.query("ROLLBACK")
  if (keyIds.length) await sql.query('UPDATE "ApiKey" SET "revokedAt"=NOW() WHERE id=ANY($1::text[]) AND "organizationId"=$2', [keyIds, org])
  await sql.end()
  await (dbModule.prisma ?? dbModule.default?.prisma)?.$disconnect()
}
