import assert from "node:assert/strict"
import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { access, cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import net from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3"
import { request, type APIRequestContext } from "@playwright/test"
import { hashPassword } from "better-auth/crypto"
import pg from "pg"

const require = createRequire(import.meta.url)
const { storage } = require("../../lib/storage/index.ts") as typeof import("../../lib/storage/index")
const { createTextPdf } = require("./pdf-fixture.ts") as typeof import("./pdf-fixture")
const { loadRootComposeEnv } = require("./root-env.ts") as typeof import("./root-env")

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")

function parseCliJson<T>(stdout: Buffer, label: string): T {
  const text = stdout.toString("utf8")
  const start = text.indexOf("{")
  if (start < 0) throw new Error(`${label} did not return JSON`)
  return JSON.parse(text.slice(start)) as T
}

function runOperatorCli<T>(script: string, args: string[], env: NodeJS.ProcessEnv, label: string): T {
  try {
    return parseCliJson<T>(execFileSync(process.execPath, ["--import", "tsx", script, ...args], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    }), label)
  } catch {
    // Operator output may contain connection metadata. Keep the probe failure sanitized.
    throw new Error(`${label} failed for the disposable upgrade database`)
  }
}

async function reserveEphemeralPort(): Promise<number> {
  const probe = net.createServer()
  await new Promise<void>((resolvePromise, reject) => {
    probe.once("error", reject)
    probe.listen(0, "127.0.0.1", resolvePromise)
  })
  const port = (probe.address() as net.AddressInfo).port
  await new Promise<void>((resolvePromise, reject) => probe.close(error => error ? reject(error) : resolvePromise()))
  return port
}

async function waitForRuntime(api: APIRequestContext, child: ChildProcess, spawnError: () => Error | undefined) {
  const deadline = Date.now() + 120_000
  let status: number | null = null
  let errorName: string | null = null
  while (Date.now() < deadline && child.exitCode === null && !spawnError()) {
    try {
      const response = await api.get("/api/auth/get-session", { timeout: 30_000 })
      status = response.status()
      if (response.ok()) return
    } catch (error) {
      errorName = error instanceof Error ? error.name : "UnknownError"
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500))
  }
  throw new Error(`Upgraded application readiness failed (status=${status}, error=${errorName}, exit=${child.exitCode})`)
}

async function stopRuntime(child: ChildProcess) {
  if (child.exitCode === null) child.kill("SIGTERM")
  await Promise.race([
    new Promise(resolvePromise => child.once("close", resolvePromise)),
    new Promise(resolvePromise => setTimeout(resolvePromise, 5_000)),
  ])
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}

async function main() {
  loadRootComposeEnv()
  // The acceptance services intentionally use probe-only ports rather than
  // the stale development defaults in the root environment file.
  process.env.STORAGE_ENDPOINT = "http://127.0.0.1:9010"
  process.env.REDIS_URL = "redis://127.0.0.1:6399"

  // Only a new, randomly named local database and bucket are mutated. Preserve both for review.
  const source = new URL(process.env.DATABASE_URL ?? "")
  const endpoint = new URL(process.env.STORAGE_ENDPOINT ?? "")
  if (process.env.AAKD_UPGRADE_PROBE !== "1"
    || !["localhost", "127.0.0.1"].includes(source.hostname)
    || source.port !== "5433"
    || !["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
    throw new Error("Upgrade probe requires explicit opt-in, local PostgreSQL port 5433, and local object storage")
  }

  const baseline = "v1.3.1"
  const root = resolve(process.cwd(), "../..")
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, maxBuffer: 8 * 1024 * 1024 })
  const baselineCommit = git("rev-parse", `${baseline}^{commit}`).toString().trim()
  const candidateCommit = git("rev-parse", "HEAD").toString().trim()
  const suffix = randomBytes(6).toString("hex")
  const targetDatabase = `aakd_upgrade_${suffix}`
  const targetBucket = `aakd-upgrade-${suffix}`
  const directory = await mkdtemp(join(tmpdir(), "aakd-upgrade-"))
  const oldDirectory = join(directory, "baseline")
  const newDirectory = join(directory, "candidate")
  const distDirectory = process.env.NEXT_DIST_DIR ?? ".next"
  assert.match(distDirectory, /^\.next(?:-[a-zA-Z0-9-]+)?$/, "Use a local candidate build directory")
  const standaloneServer = join(process.cwd(), distDirectory, "standalone/apps/web/server.js")
  const standaloneBuildIdPath = join(process.cwd(), distDirectory, "standalone/apps/web", distDirectory, "BUILD_ID")
  const preflightCliPath = join(process.cwd(), "scripts/agreement-access-preflight.ts")
  const backfillCliPath = join(process.cwd(), "scripts/agreement-access-backfill.ts")
  await Promise.all([access(standaloneServer), access(standaloneBuildIdPath)])
  const standaloneBuildId = (await readFile(standaloneBuildIdPath, "utf8")).trim()
  const standaloneServerSha256 = sha256(await readFile(standaloneServer))
  const preflightCliSha256 = sha256(await readFile(preflightCliPath))
  const backfillCliSha256 = sha256(await readFile(backfillCliPath))

  for (const path of git("ls-tree", "-r", "--name-only", baseline, "--", "apps/web/prisma").toString().trim().split("\n")) {
    if (path !== "apps/web/prisma/schema.prisma" && !path.startsWith("apps/web/prisma/migrations/")) continue
    const target = join(oldDirectory, path.slice("apps/web/prisma/".length))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, git("show", `${baseline}:${path}`))
  }
  await mkdir(newDirectory, { recursive: true })
  await cp(join(root, "apps/web/prisma/schema.prisma"), join(newDirectory, "schema.prisma"))
  await cp(join(root, "apps/web/prisma/migrations"), join(newDirectory, "migrations"), { recursive: true })
  const expectedMigrationNames = (await readdir(join(newDirectory, "migrations"), { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  const schemaDigest = createHash("sha256")
  for (const path of (await readdir(newDirectory, { recursive: true })).sort()) {
    if (!path.endsWith(".sql") && !path.endsWith(".prisma") && !path.endsWith(".toml")) continue
    schemaDigest.update(path).update(await readFile(join(newDirectory, path)))
  }
  const candidateSchemaSha256 = schemaDigest.digest("hex")

  const adminUrl = new URL(source)
  adminUrl.pathname = "/postgres"
  const admin = new pg.Client({ connectionString: adminUrl.href })
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE "${targetDatabase}"`)
  } finally {
    await admin.end()
  }
  source.pathname = `/${targetDatabase}`

  async function deploy(path: string) {
    const config = join(path, "prisma.config.ts")
    await writeFile(config, 'export default { schema: "./schema.prisma", datasource: { url: process.env.DATABASE_URL } }\n')
    try {
      execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy", "--config", config], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href },
        stdio: "pipe",
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      })
    } catch {
      throw new Error(`Upgrade migration failed for ${path === oldDirectory ? "baseline" : "candidate"}; inspect ${targetDatabase}`)
    }
  }

  await deploy(oldDirectory)

  const s3 = new S3Client({
    region: process.env.STORAGE_REGION ?? "us-east-1",
    endpoint: endpoint.href,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
    },
  })
  await s3.send(new CreateBucketCommand({ Bucket: targetBucket }))
  process.env.STORAGE_BUCKET = targetBucket

  const userId = `upgrade-user-${suffix}`
  const accountId = `upgrade-account-${suffix}`
  const organizationId = `upgrade-org-${suffix}`
  const memberId = `upgrade-member-${suffix}`
  const contractId = `upgrade-contract-${suffix}`
  const fileId = `upgrade-file-${suffix}`
  const extractionId = `upgrade-fact-${suffix}`
  const actionId = `upgrade-action-${suffix}`
  const evidenceId = `upgrade-evidence-${suffix}`
  const email = `upgrade-${suffix}@example.test`
  const password = randomBytes(32).toString("base64url")
  const passwordHash = await hashPassword(password)
  const pdf = createTextPdf([
    "Synthetic upgrade agreement.",
    "Give 45 days written notice before renewal.",
  ])
  const originalFileSha256 = sha256(pdf)
  const storageKey = storage.storageKey(organizationId, contractId, "synthetic-upgrade.pdf")
  await storage.upload(storageKey, pdf, "application/pdf")
  assert.equal(sha256((await storage.getObject(storageKey)).body), originalFileSha256, "Stored original file hash changed before migration")

  const db = new pg.Client({ connectionString: source.href })
  let child: ChildProcess | undefined
  let api: APIRequestContext | undefined
  await db.connect()
  try {
    await db.query("BEGIN")
    try {
      await db.query(`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        VALUES ($1, 'Synthetic Upgrade', $2, true, NOW(), NOW())`, [userId, email])
      await db.query(`INSERT INTO "Account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`, [accountId, userId, passwordHash])
      await db.query(`INSERT INTO "Organization" (id, name, slug, "createdAt")
        VALUES ($1, 'Synthetic Upgrade', $2, NOW())`, [organizationId, `synthetic-upgrade-${suffix}`])
      await db.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt")
        VALUES ($1, $2, $3, 'owner', NOW())`, [memberId, organizationId, userId])
      await db.query(`INSERT INTO "Contract" (id, title, "ownerId", "organizationId", "autoRenewal", "renewalReminderEnabled", "noticePeriodDays", "extractedText", "updatedAt")
        VALUES ($1, 'Synthetic renewal agreement', $2, $3, true, false, 45, 'Give 45 days written notice before renewal.', NOW())`, [contractId, userId, organizationId])
      await db.query(`INSERT INTO "ContractFile" (id, "contractId", filename, "storageKey", "mimeType", "sizeBytes", "uploadedById")
        VALUES ($1, $2, 'synthetic-upgrade.pdf', $3, 'application/pdf', $4, $5)`, [fileId, contractId, storageKey, pdf.byteLength, userId])
      await db.query(`INSERT INTO "AIExtraction" (id, "contractId", field, "rawValue", confidence, "sourceText", "sourcePage", status, "updatedAt")
        VALUES ($1, $2, 'noticePeriodDays', '45', 0.95, 'Give 45 days written notice before renewal.', 1, 'accepted', NOW())`, [extractionId, contractId])
      await db.query(`INSERT INTO "ContractAction" (id, "organizationId", "contractId", "sourceKey", kind, title, "assigneeId", "sourceText", "sourcePage", "reviewStatus", status, "updatedAt")
        VALUES ($1, $2, $3, 'synthetic-notice', 'RENEWAL_NOTICE', 'Review renewal notice', $4, 'Give 45 days written notice before renewal.', 1, 'accepted', 'IN_PROGRESS', NOW())`, [actionId, organizationId, contractId, userId])
      await db.query(`INSERT INTO "ContractActionEvidence" (id, "actionId", kind, note, "recordedById")
        VALUES ($1, $2, 'note', 'Synthetic evidence retained', $3)`, [evidenceId, actionId, userId])
      await db.query("COMMIT")
    } catch (error) {
      await db.query("ROLLBACK")
      throw error
    }

    const tables = ["User", "Account", "Organization", "Member", "Contract", "ContractFile", "AIExtraction", "ContractAction", "ContractActionEvidence"]
    const before = new Map<string, Record<string, unknown>>()
    for (const table of tables) before.set(table, (await db.query(`SELECT * FROM "${table}"`)).rows[0])
    const baselineMigrations = Number((await db.query('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).rows[0].count)
    assert.equal(baselineMigrations, 33, "Unexpected v1.3.1 migration count")

    await deploy(newDirectory)
    for (const table of tables) {
      const rows = (await db.query(`SELECT * FROM "${table}"`)).rows
      assert.equal(rows.length, 1, `${table} record count changed`)
      for (const [field, value] of Object.entries(before.get(table)!)) {
        assert.deepEqual(rows[0][field], value, `${table}.${field} changed`)
      }
    }
    assert.equal(Number((await db.query('SELECT count(*) FROM "ContractAccessGrant"')).rows[0].count), 0, "Migration silently granted existing agreements")
    const currentMigrations = Number((await db.query('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).rows[0].count)
    assert.equal(currentMigrations, expectedMigrationNames.length, "Unexpected candidate migration count")
    const appliedMigrationNames = (await db.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows.map(row => row.migration_name)
    assert.deepEqual(appliedMigrationNames, expectedMigrationNames, "Candidate migration identities differ from the tested manifest")
    assert.equal(Number((await db.query('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')).rows[0].count), 0, "Unfinished migration")
    assert.equal(sha256((await storage.getObject(storageKey)).body), originalFileSha256, "Original object bytes changed during migration")

    const port = await reserveEphemeralPort()
    const baseURL = `http://127.0.0.1:${port}`
    let spawnError: Error | undefined
    child = spawn(process.execPath, [standaloneServer], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: {
        ...process.env,
        DATABASE_URL: source.href,
        DIRECT_URL: source.href,
        STORAGE_BUCKET: targetBucket,
        HOSTNAME: "127.0.0.1",
        PORT: String(port),
        RUNTIME_NODE_ENV: "development",
        BETTER_AUTH_URL: baseURL,
        NEXT_PUBLIC_APP_URL: baseURL,
        INTERNAL_APP_URL: baseURL,
      },
    })
    child.on("error", error => { spawnError = error })
    api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 60_000 })
    await waitForRuntime(api, child, () => spawnError)

    const login = await api.post("/api/auth/sign-in/email", { data: { email, password } })
    assert.equal(login.status(), 200, "Upgraded credential login failed")
    const activate = await api.post("/api/auth/organization/set-active", { data: { organizationId } })
    assert.equal(activate.status(), 200, "Upgraded organization activation failed")

    const preContract = await api.get(`/api/contracts/${contractId}`)
    const preFacts = await api.get(`/api/contracts/${contractId}/extractions`)
    const preActions = await api.get(`/api/actions?contractId=${encodeURIComponent(contractId)}`)
    const preFile = await api.get(`/api/contracts/${contractId}/upload?fileId=${encodeURIComponent(fileId)}&stream=1&inline=1`)
    assert.equal(preContract.status(), 404, "Contract was readable before reviewed grant backfill")
    assert.equal(preFacts.status(), 404, "Reviewed facts were readable before grant backfill")
    assert.equal(preFile.status(), 404, "Original file was readable before grant backfill")
    assert.equal(preActions.status(), 200, "Action metadata endpoint failed before backfill")
    assert.deepEqual(await preActions.json(), { actions: [], total: 0, page: 1, limit: 50 }, "Action metadata leaked before grant backfill")

    const operatorEnv = { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href }
    type PreflightReport = {
      schema: { hasGrantTable: boolean; hasBriefAudienceMemberId: boolean }
      counts: Record<string, number>
      contracts: Array<Record<string, unknown>>
      briefs: Array<Record<string, unknown>>
      readyForReviewedBackfill: boolean
      mappingSha256: string
    }
    const preflight = runOperatorCli<PreflightReport>("scripts/agreement-access-preflight.ts", [], operatorEnv, "Agreement-access preflight")
    assert.match(preflight.mappingSha256, /^[a-f0-9]{64}$/, "Preflight digest is not SHA-256")
    assert.deepEqual({ ...preflight, mappingSha256: "<reviewed>" }, {
      schema: { hasGrantTable: true, hasBriefAudienceMemberId: true },
      counts: {
        contracts: 1,
        ownerMissing: 0,
        ownerDuplicate: 0,
        ownerGrantsToInsert: 1,
        briefs: 0,
        briefAudienceMissing: 0,
        briefAudienceDuplicate: 0,
        briefAudienceUnbound: 0,
        briefAudienceBindingInvalid: 0,
        briefBindingsToChange: 0,
      },
      contracts: [{
        contractId,
        organizationId,
        ownerUserId: userId,
        ownerMemberIds: [memberId],
        status: "ready",
        ownerGrantExists: false,
      }],
      briefs: [],
      readyForReviewedBackfill: true,
      mappingSha256: "<reviewed>",
    }, "Preflight did not produce exactly one known synthetic owner mapping")

    const mappingPath = join(directory, "reviewed-agreement-access-mapping.json")
    await writeFile(mappingPath, JSON.stringify(preflight, null, 2), { mode: 0o600 })
    const requestId = `upgrade-probe-${suffix}`
    const backfill = runOperatorCli<{
      approvedSha256: string
      insertedGrants: number
      updatedBriefs: number
      requestId: string
    }>("scripts/agreement-access-backfill.ts", [
      "--mapping", mappingPath,
      "--approved-sha256", preflight.mappingSha256,
      "--actor-user-id", userId,
      "--request-id", requestId,
    ], operatorEnv, "Agreement-access reviewed backfill")
    assert.deepEqual(backfill, {
      approvedSha256: preflight.mappingSha256,
      insertedGrants: 1,
      updatedBriefs: 0,
      requestId,
    }, "Reviewed backfill result differs from approved mapping")

    const grants = (await db.query<{
      id: string
      organizationId: string
      contractId: string
      memberId: string
      grantedById: string
    }>('SELECT id, "organizationId", "contractId", "memberId", "grantedById" FROM "ContractAccessGrant"')).rows
    assert.equal(grants.length, 1, "Backfill did not create exactly one grant")
    assert.deepEqual({
      organizationId: grants[0]?.organizationId,
      contractId: grants[0]?.contractId,
      memberId: grants[0]?.memberId,
      grantedById: grants[0]?.grantedById,
    }, { organizationId, contractId, memberId, grantedById: userId }, "Backfill grant differs from reviewed mapping")
    const activities = (await db.query<{
      contractId: string
      userId: string
      actorLabel: string
      action: string
      detail: string
      metadata: Record<string, unknown>
    }>('SELECT "contractId", "userId", "actorLabel", action::text, detail, metadata FROM "Activity" WHERE action = \'ACCESS_GRANTED\'')).rows
    assert.deepEqual(activities, [{
      contractId,
      userId,
      actorLabel: "Migration operator",
      action: "ACCESS_GRANTED",
      detail: "Owner access backfilled",
      metadata: {
        requestId,
        targetMemberId: memberId,
        grantId: grants[0]?.id,
        source: "agreement_access_backfill",
      },
    }], "Reviewed backfill audit evidence is incomplete")

    const postflight = runOperatorCli<PreflightReport>("scripts/agreement-access-preflight.ts", [], operatorEnv, "Agreement-access postflight")
    assert.equal(postflight.counts.ownerGrantsToInsert, 0, "Postflight still requires an owner grant")
    assert.deepEqual(postflight.contracts, [{
      contractId,
      organizationId,
      ownerUserId: userId,
      ownerMemberIds: [memberId],
      status: "ready",
      ownerGrantExists: true,
    }], "Postflight does not report the exact reviewed owner grant")

    const detail = await api.get(`/api/contracts/${contractId}`)
    assert.equal(detail.status(), 200, "Contract remained unreadable after reviewed backfill")
    const detailBody = await detail.json()
    assert.equal(detailBody.id, contractId)
    assert.equal(detailBody.title, "Synthetic renewal agreement")
    assert.equal(detailBody.noticePeriodDays, 45)
    assert.equal(detailBody.autoRenewal, true)
    assert.equal(detailBody.renewalReminderEnabled, false)
    assert.equal(detailBody.hasExtractedText, true)
    assert.deepEqual(detailBody.files.map((file: Record<string, unknown>) => ({
      id: file.id,
      filename: file.filename,
      sizeBytes: file.sizeBytes,
      mimeType: file.mimeType,
    })), [{ id: fileId, filename: "synthetic-upgrade.pdf", sizeBytes: pdf.byteLength, mimeType: "application/pdf" }])

    const facts = await api.get(`/api/contracts/${contractId}/extractions`)
    assert.equal(facts.status(), 200, "Reviewed fact route failed after backfill")
    const factsBody = await facts.json()
    assert.equal(factsBody.extractions.length, 1)
    assert.deepEqual({
      id: factsBody.extractions[0]?.id,
      contractId: factsBody.extractions[0]?.contractId,
      field: factsBody.extractions[0]?.field,
      rawValue: factsBody.extractions[0]?.rawValue,
      sourceText: factsBody.extractions[0]?.sourceText,
      sourcePage: factsBody.extractions[0]?.sourcePage,
      status: factsBody.extractions[0]?.status,
    }, {
      id: extractionId,
      contractId,
      field: "noticePeriodDays",
      rawValue: "45",
      sourceText: "Give 45 days written notice before renewal.",
      sourcePage: 1,
      status: "accepted",
    })

    const actions = await api.get(`/api/actions?contractId=${encodeURIComponent(contractId)}`)
    assert.equal(actions.status(), 200, "Reviewed action route failed after backfill")
    const actionsBody = await actions.json()
    assert.equal(actionsBody.total, 1)
    assert.equal(actionsBody.actions.length, 1)
    assert.deepEqual({
      id: actionsBody.actions[0]?.id,
      contractId: actionsBody.actions[0]?.contractId,
      kind: actionsBody.actions[0]?.kind,
      title: actionsBody.actions[0]?.title,
      assigneeId: actionsBody.actions[0]?.assigneeId,
      sourcePage: actionsBody.actions[0]?.sourcePage,
      hasCitation: actionsBody.actions[0]?.hasCitation,
      hasSourceText: actionsBody.actions[0]?.hasSourceText,
      reviewStatus: actionsBody.actions[0]?.reviewStatus,
      status: actionsBody.actions[0]?.status,
    }, {
      id: actionId,
      contractId,
      kind: "RENEWAL_NOTICE",
      title: "Review renewal notice",
      assigneeId: userId,
      sourcePage: 1,
      hasCitation: true,
      hasSourceText: true,
      reviewStatus: "accepted",
      status: "IN_PROGRESS",
    })

    const file = await api.get(`/api/contracts/${contractId}/upload?fileId=${encodeURIComponent(fileId)}&stream=1&inline=1`)
    assert.equal(file.status(), 200, "Original file route failed after backfill")
    assert.match(file.headers()["content-type"] ?? "", /^application\/pdf\b/)
    assert.equal(sha256(await file.body()), originalFileSha256, "Application replay changed original file bytes")

    const result = {
      status: "PASS",
      scope: "disposable v1.3.1 migration, reviewed agreement-access backfill, and compiled application replay",
      baseline,
      baselineCommit,
      candidateCommit,
      candidateSchemaSha256,
      standaloneBuildId,
      standaloneServerSha256,
      preflightCliSha256,
      backfillCliSha256,
      localEndpoints: { postgresPort: 5433, storagePort: 9010, redisPort: 6399 },
      baselineMigrations,
      currentMigrations,
      recordsVerified: tables.length,
      originalFileSha256,
      preBackfill: { contract: 404, facts: 404, file: 404, actions: 0 },
      reviewedMappingSha256: preflight.mappingSha256,
      backfill: { insertedGrants: 1, updatedBriefs: 0, audited: true },
      applicationReplay: { credentialLogin: true, contract: true, fact: true, action: true, originalFileByteHash: true },
      targetDatabase,
      targetBucket,
      directory,
      sourcePreserved: true,
      limitations: [
        "Synthetic single-owner fixture only; ambiguous or missing mappings are not auto-approved.",
        "No worker, AI provider, external provider, Docker image, production database, or existing bucket is exercised.",
        "Evidence is revision-bound to the recorded candidate commit, schema digest, standalone build ID/server hash, and exact operator CLI hashes.",
      ],
    }
    await writeFile(join(directory, "result.json"), JSON.stringify(result, null, 2), { mode: 0o600 })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } finally {
    if (api) await api.dispose()
    if (child) await stopRuntime(child)
    await db.end()
    s3.destroy()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Upgrade application replay failed: ${error instanceof Error ? error.message : "Unknown error"}\n`)
  process.exitCode = 1
})
