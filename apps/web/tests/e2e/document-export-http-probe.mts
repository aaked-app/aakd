import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { expect, request, type APIRequestContext } from "@playwright/test"
import pg from "pg"

if (process.env.AAKD_DOCUMENT_EXPORT_HTTP_PROBE !== "1") {
  throw new Error("Opt in with AAKD_DOCUMENT_EXPORT_HTTP_PROBE=1")
}

const rootEnvLoaded = await import("./root-env") as unknown as {
  loadRootComposeEnv?: () => void
  default?: { loadRootComposeEnv: () => void }
}
const loadRootComposeEnv = rootEnvLoaded.loadRootComposeEnv ?? rootEnvLoaded.default?.loadRootComposeEnv
if (!loadRootComposeEnv) throw new Error("Could not load the root environment helper")
loadRootComposeEnv()

const baseURL = process.env.PLAYWRIGHT_BASE_URL
const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
const storageEndpoint = process.env.STORAGE_ENDPOINT
if (!baseURL || !databaseUrl || !redisUrl || !storageEndpoint) {
  throw new Error("Document export HTTP probe requires the acceptance runtime URLs")
}
const localHost = (value: string) => ["localhost", "127.0.0.1"].includes(new URL(value).hostname)
const database = new URL(databaseUrl).pathname.slice(1)
if (!localHost(baseURL) || !localHost(databaseUrl) || !localHost(redisUrl) || !localHost(storageEndpoint)
  || !/^aakd_acceptance_[a-z0-9_]+$/.test(database)) {
  throw new Error("Document export HTTP probe is restricted to a named local acceptance runtime")
}

const suffix = randomBytes(8).toString("hex")
const ownerEmail = `document-export-owner-${suffix}@example.test`
const otherEmail = `document-export-other-${suffix}@example.test`
const ownerPassword = randomBytes(32).toString("base64url")
const otherPassword = randomBytes(32).toString("base64url")
const marker = `Synthetic export acceptance ${suffix}`
const run = promisify(execFile)
const tempDirectory = await mkdtemp(join(tmpdir(), "aakd-document-export-http-"))

const ownerApi = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 30_000 })
const otherApi = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 30_000 })
const anonymousApi = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 30_000 })
const sql = new pg.Client({ connectionString: databaseUrl })
await sql.connect()

async function requireStatus(response: Awaited<ReturnType<APIRequestContext["get"]>>, expected: number, label: string) {
  if (response.status() !== expected) throw new Error(`${label}: expected ${expected}, received ${response.status()}`)
}

async function signup(client: APIRequestContext, email: string, password: string, name: string) {
  const response = await client.post("/api/auth/sign-up/email", { data: { email, password, name } })
  await requireStatus(response, 200, `${name} signup`)
}

async function startExport(client: APIRequestContext, contractId: string): Promise<string> {
  const response = await client.post(`/api/contracts/${contractId}/document/export`, {
    data: { format: "docx" },
  })
  await requireStatus(response, 202, "export enqueue")
  const body = await response.json() as { jobId?: string }
  if (!body.jobId) throw new Error("Export enqueue returned no job ID")
  return body.jobId
}

async function waitForExport(client: APIRequestContext, contractId: string, jobId: string): Promise<string> {
  let downloadUrl: string | undefined
  await expect.poll(async () => {
    const response = await client.get(`/api/contracts/${contractId}/document/export/${encodeURIComponent(jobId)}`)
    if (!response.ok()) return false
    const body = await response.json() as { status?: string; error?: string; downloadUrl?: string }
    if (body.status === "failed") throw new Error(`Export worker returned ${body.error ?? "failed"}`)
    downloadUrl = body.downloadUrl
    return body.status === "complete"
  }, { timeout: 30_000, intervals: [250], message: "Real document export worker must complete" }).toBe(true)
  if (!downloadUrl?.startsWith(`/api/contracts/${contractId}/document/export/`)) {
    throw new Error("Completed export did not return a protected same-origin path")
  }
  return downloadUrl
}

async function downloadAndValidate(client: APIRequestContext, downloadUrl: string, label: string) {
  const response = await client.get(downloadUrl)
  await requireStatus(response, 200, `${label} download`)
  assert.match(response.headers()["content-type"] ?? "", /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/)
  const cacheControl = response.headers()["cache-control"] ?? ""
  const cacheDirectives = cacheControl.split(",").map((directive) => directive.trim().toLowerCase())
  assert.ok(cacheDirectives.includes("no-store"), `${label} download must not be stored by caches`)
  assert.ok(!cacheDirectives.includes("public"), `${label} download must not be publicly cacheable`)
  assert.ok(!cacheDirectives.some((directive) => directive.startsWith("s-maxage=")), `${label} download must not enable shared-cache storage`)
  const bytes = await response.body()
  assert.equal(bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), true, "DOCX ZIP magic missing")
  const path = join(tempDirectory, `${label}.docx`)
  await writeFile(path, bytes)
  await run("unzip", ["-t", path], { timeout: 30_000, maxBuffer: 1024 * 1024 })
  const { stdout } = await run("unzip", ["-p", path, "word/document.xml"], {
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  })
  assert.match(stdout, new RegExp(marker))
}

async function assertOneAudit(contractId: string, jobId: string) {
  const result = await sql.query(`SELECT COUNT(*)::int AS count FROM "Activity"
    WHERE "contractId"=$1 AND action='DOCUMENT_EXPORTED' AND metadata->>'jobId'=$2`, [contractId, jobId])
  assert.equal(Number(result.rows[0].count), 1, `Expected exactly one export audit for ${jobId}`)
}

const report: Record<string, unknown> = { database, syntheticSuffix: suffix }
let generatedApiKeyId: string | undefined
let generatedApiKeyOrganizationId: string | undefined
try {
  await signup(ownerApi, ownerEmail, ownerPassword, "Synthetic Export Owner")
  await signup(otherApi, otherEmail, otherPassword, "Synthetic Export Other Member")

  const organization = await ownerApi.post("/api/auth/organization/create", {
    data: { name: `Document export acceptance ${suffix}`, slug: `document-export-${suffix}` },
  })
  await requireStatus(organization, 200, "organization creation")
  const organizationId = (await organization.json() as { id: string }).id
  await requireStatus(
    await ownerApi.post("/api/auth/organization/set-active", { data: { organizationId } }),
    200,
    "owner organization activation",
  )

  const users = await sql.query(`SELECT id, email FROM "User" WHERE email = ANY($1::text[])`, [[ownerEmail, otherEmail]])
  const ownerId = users.rows.find((row) => row.email === ownerEmail)?.id as string | undefined
  const otherId = users.rows.find((row) => row.email === otherEmail)?.id as string | undefined
  if (!ownerId || !otherId) throw new Error("Synthetic users were not persisted")
  const otherMemberId = `document-export-member-${suffix}`
  await sql.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt")
    VALUES ($1, $2, $3, 'member', NOW())`, [otherMemberId, organizationId, otherId])
  await requireStatus(
    await otherApi.post("/api/auth/organization/set-active", { data: { organizationId } }),
    200,
    "other-member organization activation",
  )

  const contract = await ownerApi.post("/api/contracts", { data: { title: `Document export ${suffix}` } })
  await requireStatus(contract, 201, "contract creation")
  const contractId = (await contract.json() as { id: string }).id
  const documentContent = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: marker }] }],
  }
  await requireStatus(await ownerApi.put(`/api/contracts/${contractId}/document`, {
    data: { content: documentContent, wordCount: 3, clientVersion: 0 },
  }), 200, "initial document save")

  const grantState = await sql.query(`SELECT m.id, m."userId", COUNT(g.id)::int AS grants
    FROM "Member" m LEFT JOIN "ContractAccessGrant" g
      ON g."memberId"=m.id AND g."contractId"=$1 AND g."organizationId"=$2
    WHERE m."organizationId"=$2 AND m."userId" = ANY($3::text[])
    GROUP BY m.id, m."userId"`, [contractId, organizationId, [ownerId, otherId]])
  assert.equal(Number(grantState.rows.find((row) => row.userId === ownerId)?.grants), 1)
  assert.equal(Number(grantState.rows.find((row) => row.userId === otherId)?.grants), 0)
  const ownerMemberId = grantState.rows.find((row) => row.userId === ownerId)?.id as string

  const apiKeyResponse = await ownerApi.post("/api/org/api-keys", {
    data: { name: `Document export acceptance ${suffix}`, scopes: ["read", "text_read"] },
  })
  await requireStatus(apiKeyResponse, 201, "API key creation")
  const apiKeyBody = await apiKeyResponse.json() as { rawKey?: string; apiKey?: { id?: string } }
  const rawKey = apiKeyBody.rawKey
  if (!rawKey) throw new Error("API key response returned no key")
  if (!apiKeyBody.apiKey?.id) throw new Error("API key response returned no key ID")
  generatedApiKeyId = apiKeyBody.apiKey.id
  generatedApiKeyOrganizationId = organizationId
  const keyApi = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, Authorization: `Bearer ${rawKey}` },
    timeout: 30_000,
  })
  try {
    await requireStatus(await anonymousApi.post(`/api/contracts/${contractId}/document/export`, {
      data: { format: "docx" },
    }), 401, "anonymous export enqueue denial")
    await requireStatus(await keyApi.post(`/api/contracts/${contractId}/document/export`, {
      data: { format: "docx" },
    }), 403, "API-key export enqueue denial")

    const sourceChangeJobId = await startExport(ownerApi, contractId)
    const sourceChangeDownload = await waitForExport(ownerApi, contractId, sourceChangeJobId)
    await requireStatus(
      await otherApi.get(`/api/contracts/${contractId}/document/export/${encodeURIComponent(sourceChangeJobId)}`),
      404,
      "ungranted same-organization member poll denial",
    )
    await requireStatus(await anonymousApi.get(sourceChangeDownload), 401, "anonymous download denial")
    await requireStatus(await keyApi.get(sourceChangeDownload), 403, "API-key download denial")
    await downloadAndValidate(ownerApi, sourceChangeDownload, "source-change-control")
    await assertOneAudit(contractId, sourceChangeJobId)

    await requireStatus(await ownerApi.put(`/api/contracts/${contractId}/document`, {
      data: {
        content: { ...documentContent, content: [{ type: "paragraph", content: [{ type: "text", text: `${marker} changed` }] }] },
        wordCount: 4,
        clientVersion: 1,
      },
    }), 200, "source-changing document save")
    await requireStatus(await ownerApi.get(sourceChangeDownload), 404, "stale completed export denial")

    const revocationJobId = await startExport(ownerApi, contractId)
    const revocationDownload = await waitForExport(ownerApi, contractId, revocationJobId)
    await downloadAndValidate(ownerApi, revocationDownload, "revocation-control")
    await assertOneAudit(contractId, revocationJobId)
    const removed = await sql.query(`DELETE FROM "ContractAccessGrant"
      WHERE "organizationId"=$1 AND "contractId"=$2 AND "memberId"=$3`,
    [organizationId, contractId, ownerMemberId])
    assert.equal(removed.rowCount, 1)
    await requireStatus(await ownerApi.get(revocationDownload), 404, "revoked completed export denial")

    report.status = "PASS"
    report.http = true
    report.bullmqWorker = true
    report.postgres = true
    report.objectStorage = true
    report.realDocx = true
    report.auditExactlyOnce = true
    report.sourceChangeDenied = true
    report.revocationDenied = true
    report.anonymousDenied = true
    report.apiKeyDenied = true
    report.otherMemberDenied = true
  } finally {
    await keyApi.dispose()
  }
} finally {
  await Promise.all([ownerApi.dispose(), otherApi.dispose(), anonymousApi.dispose()])
  if (generatedApiKeyId && generatedApiKeyOrganizationId) {
    const revoked = await sql.query(`UPDATE "ApiKey" SET "revokedAt"=NOW()
      WHERE id=$1 AND "organizationId"=$2 AND "revokedAt" IS NULL`, [generatedApiKeyId, generatedApiKeyOrganizationId])
    assert.equal(revoked.rowCount, 1, "the exact synthetic API key must be revoked")
  }
  await sql.end()
  await rm(tempDirectory, { recursive: true, force: true })
}

process.stdout.write(`${JSON.stringify({ ...report, syntheticRowsPreservedForInspection: true })}\n`)
if (report.status !== "PASS") throw new Error("Document export HTTP probe did not complete")
