import assert from "node:assert/strict"
import { execFile, spawn, type ChildProcess } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { createServer, type Server } from "node:http"
import { promisify } from "node:util"
import { QueueEvents } from "bullmq"
import IORedis from "ioredis"
import pg from "pg"

type ChunkText = (text: string, chunkSize?: number, overlap?: number) => Array<{ index: number; text: string }>
const chunkingModule = await import("../../lib/ai/chunking") as unknown as {
  chunkText?: ChunkText
  default?: { chunkText: ChunkText }
}
const chunkText = chunkingModule.chunkText ?? chunkingModule.default?.chunkText
if (!chunkText) throw new Error("Could not load the production chunkText implementation")
const rootEnvModule = await import("./root-env") as unknown as {
  loadRootComposeEnv?: () => void
  default?: { loadRootComposeEnv: () => void }
}
const loadRootComposeEnv = rootEnvModule.loadRootComposeEnv ?? rootEnvModule.default?.loadRootComposeEnv
if (!loadRootComposeEnv) throw new Error("Could not load the root environment helper")

const run = promisify(execFile)
const redisUrl = new URL(process.env.AAKD_REINDEX_PROBE_REDIS_URL ?? "redis://127.0.0.1:6399/4")

if (process.env.AAKD_REINDEX_REVOCATION_PROBE !== "1") {
  throw new Error("Opt in with AAKD_REINDEX_REVOCATION_PROBE=1")
}
if (!["localhost", "127.0.0.1"].includes(redisUrl.hostname)
  || redisUrl.port !== "6399" || redisUrl.pathname !== "/4") {
  throw new Error("Reindex revocation probe requires isolated local Redis port 6399 database 4")
}

loadRootComposeEnv()
const source = new URL(process.env.DATABASE_URL ?? "")
if (!["localhost", "127.0.0.1"].includes(source.hostname)) {
  throw new Error("Reindex revocation probe requires local PostgreSQL")
}

const webRoot = process.cwd()
const targetDatabase = `aakd_qa_reindex_revocation_${randomBytes(6).toString("hex")}`
const adminUrl = new URL(source)
adminUrl.pathname = "/postgres"
source.pathname = `/${targetDatabase}`

const redis = new IORedis(redisUrl.href, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
})
await redis.connect()
const initialRedisKeys = await redis.dbsize()
if (initialRedisKeys !== 0) {
  await redis.quit()
  throw new Error(`Redis database 4 is not empty (${initialRedisKeys} keys); refusing to touch it`)
}

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

const db = new pg.Client({ connectionString: source.href })
await db.connect()

const ids = {
  organization: "qa-reindex-org",
  owner: "qa-reindex-owner",
  actor: "qa-reindex-actor",
  actorMember: "qa-reindex-actor-member",
  revokedContract: "qa-reindex-revoked-contract",
  revokedGrant: "qa-reindex-revoked-grant",
  controlContract: "qa-reindex-control-contract",
  controlGrant: "qa-reindex-control-grant",
} as const

const revokedText = `REVOCATION-PRIVATE-CLAUSE\n${"Confidential revoked agreement text. ".repeat(400)}`
const controlText = `CONTROL-PRIVATE-CLAUSE\n${"Authorized control agreement text. ".repeat(260)}`
assert.ok(chunkText(revokedText).length > 1, "Revocation fixture must have multiple chunks")
assert.ok(chunkText(controlText).length > 1, "Control fixture must have multiple chunks")

const legacyVector = `[${Array.from({ length: 1536 }, () => "0.01").join(",")}]`
await db.query("BEGIN")
try {
  await db.query(`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
    ($1, 'Synthetic Reindex Owner', 'qa-reindex-owner@example.test', true, NOW(), NOW()),
    ($2, 'Synthetic Reindex Actor', 'qa-reindex-actor@example.test', true, NOW(), NOW())`,
  [ids.owner, ids.actor])
  await db.query(`INSERT INTO "Organization" (id, name, slug, "createdAt")
    VALUES ($1, 'Synthetic Reindex Organization', $2, NOW())`,
  [ids.organization, `qa-reindex-${randomBytes(4).toString("hex")}`])
  await db.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt")
    VALUES ($1, $2, $3, 'admin', NOW())`,
  [ids.actorMember, ids.organization, ids.actor])
  await db.query(`INSERT INTO "Contract"
    (id, title, "contractType", "ownerId", "organizationId", "extractedText", "updatedAt") VALUES
    ($1, 'Synthetic Revocation Agreement', 'OTHER', $2, $3, $4, NOW()),
    ($5, 'Synthetic Control Agreement', 'OTHER', $2, $3, $6, NOW())`,
  [ids.revokedContract, ids.owner, ids.organization, revokedText, ids.controlContract, controlText])
  await db.query(`INSERT INTO "ContractAccessGrant"
    (id, "organizationId", "contractId", "memberId", "grantedById") VALUES
    ($1, $2, $3, $4, $5),
    ($6, $2, $7, $4, $5)`,
  [ids.revokedGrant, ids.organization, ids.revokedContract, ids.actorMember, ids.owner,
    ids.controlGrant, ids.controlContract])
  await db.query(`INSERT INTO "ContractFile"
    (id, "contractId", filename, "storageKey", "mimeType", "sizeBytes", "uploadedById") VALUES
    ('qa-reindex-revoked-file', $1, 'revoked-source.pdf', 'qa/reindex/revoked-source.pdf', 'application/pdf', 101, $2),
    ('qa-reindex-control-file', $3, 'control-source.pdf', 'qa/reindex/control-source.pdf', 'application/pdf', 102, $2)`,
  [ids.revokedContract, ids.owner, ids.controlContract])
  await db.query(`INSERT INTO "AIExtraction"
    (id, "contractId", field, "rawValue", confidence, "sourceText", "sourcePage", status, "updatedAt") VALUES
    ('qa-reindex-revoked-fact', $1, 'governingLaw', 'Synthetic law', 0.99, 'Exact reviewed source', 2, 'accepted', NOW()),
    ('qa-reindex-control-fact', $2, 'governingLaw', 'Control law', 0.98, 'Exact control source', 3, 'accepted', NOW())`,
  [ids.revokedContract, ids.controlContract])
  await db.query(`INSERT INTO "ContractEmbedding" (id, "contractId", embedding, model)
    VALUES ('qa-reindex-legacy-parent', $1, $2::vector, 'legacy:preserve:1536')`,
  [ids.revokedContract, legacyVector])
  await db.query(`INSERT INTO "ContractChunkEmbedding"
    (id, "contractId", "chunkIndex", text, embedding, model)
    VALUES ('qa-reindex-legacy-chunk', $1, 0, 'Legacy private chunk', $2::vector, 'legacy:preserve:1536')`,
  [ids.revokedContract, legacyVector])
  await db.query("COMMIT")
} catch (error) {
  await db.query("ROLLBACK")
  throw error
}

async function snapshotContract(contractId: string) {
  const contract = await db.query('SELECT * FROM "Contract" WHERE id = $1', [contractId])
  const files = await db.query('SELECT * FROM "ContractFile" WHERE "contractId" = $1 ORDER BY id', [contractId])
  const facts = await db.query('SELECT * FROM "AIExtraction" WHERE "contractId" = $1 ORDER BY id', [contractId])
  const parent = await db.query('SELECT id, "contractId", embedding::text, model, "createdAt", "updatedAt" FROM "ContractEmbedding" WHERE "contractId" = $1', [contractId])
  const chunks = await db.query('SELECT id, "contractId", "chunkIndex", text, embedding::text, model, "createdAt", "updatedAt" FROM "ContractChunkEmbedding" WHERE "contractId" = $1 ORDER BY "chunkIndex"', [contractId])
  const activities = await db.query('SELECT * FROM "Activity" WHERE "contractId" = $1 ORDER BY id', [contractId])
  return {
    contract: contract.rows,
    files: files.rows,
    facts: facts.rows,
    parent: parent.rows,
    chunks: chunks.rows,
    activities: activities.rows,
  }
}

const revokedBefore = await snapshotContract(ids.revokedContract)
const controlBefore = await snapshotContract(ids.controlContract)

let providerCalls = 0
let revokedDocumentCalls = 0
let revokedGrantDeleted = false
const provider = createServer(async (request, response) => {
  try {
    if (request.method !== "POST" || request.url !== "/api/embed") {
      response.writeHead(404).end()
      return
    }
    const parts: Buffer[] = []
    for await (const part of request) parts.push(Buffer.from(part))
    const body = JSON.parse(Buffer.concat(parts).toString("utf8")) as { input?: unknown }
    const input = typeof body.input === "string" ? body.input : ""
    providerCalls += 1
    if (input.includes("REVOCATION-PRIVATE-CLAUSE")) {
      revokedDocumentCalls += 1
      if (!revokedGrantDeleted) {
        const deleted = await db.query('DELETE FROM "ContractAccessGrant" WHERE id = $1', [ids.revokedGrant])
        assert.equal(deleted.rowCount, 1, "Controlled provider hook did not revoke the exact grant")
        revokedGrantDeleted = true
      }
    }
    const vector = Array.from({ length: 1536 }, (_, index) => index === 0 ? 0.5 : 0.001)
    response.writeHead(200, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ embeddings: [vector] }))
  } catch {
    response.writeHead(500, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ error: "synthetic_provider_failure" }))
  }
})

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") reject(new Error("Provider did not bind locally"))
      else resolve(address.port)
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  child.kill("SIGTERM")
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Dedicated worker did not stop gracefully")), 35_000)
    child.once("exit", () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

async function removeProbeRedisKeys() {
  let cursor = "0"
  const keys: string[] = []
  do {
    const [nextCursor, page] = await redis.scan(cursor, "COUNT", 100)
    cursor = nextCursor
    keys.push(...page)
  } while (cursor !== "0")

  const keyCount = await redis.dbsize()
  assert.equal(keys.length, keyCount, "Redis database changed while collecting owned probe keys")
  assert.ok(keys.every((key) => key.startsWith("bull:")),
    "Redis database contains a non-BullMQ key; refusing probe cleanup")
  if (keys.length > 0) await redis.unlink(...keys)
  assert.equal(await redis.dbsize(), 0, "Probe-owned Redis keys were not fully removed")
  return keys.length
}

const providerPort = await listen(provider)
const workerEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: source.href,
  DIRECT_URL: source.href,
  DATABASE_POOL_SIZE: "2",
  REDIS_URL: redisUrl.href,
  AI_PROVIDER: "ollama",
  OLLAMA_BASE_URL: `http://127.0.0.1:${providerPort}`,
  OLLAMA_EMBEDDING_MODEL: "qa-embedding-1536",
  OLLAMA_MODEL: "qa-local-model",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
  NOTIFICATION_ENCRYPTION_KEY: "11".repeat(32),
  OTEL_ENABLED: "false",
  SMTP_HOST: "",
}

const queueEvents = new QueueEvents("contract.embed", { connection: { url: redisUrl.href } })
await queueEvents.waitUntilReady()

const workerOutput: string[] = []
const worker = spawn("pnpm", ["exec", "tsx", "--tsconfig", "tsconfig.worker.json", "worker.ts"], {
  cwd: webRoot,
  env: workerEnv,
  stdio: ["ignore", "pipe", "pipe"],
})
for (const stream of [worker.stdout, worker.stderr]) {
  stream?.on("data", (chunk: Buffer) => {
    if (workerOutput.join("").length < 256 * 1024) workerOutput.push(chunk.toString("utf8"))
  })
}

async function waitForWorkerStart() {
  const started = Date.now()
  while (!workerOutput.join("").includes("BullMQ worker started")) {
    if (worker.exitCode !== null) throw new Error("Dedicated worker exited before startup")
    if (Date.now() - started > 30_000) throw new Error("Dedicated worker startup timed out")
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function jobId(contractId: string, extractedText: string) {
  return `operator-reindex-${createHash("sha256")
    .update(`${ids.organization}\n${contractId}\n${extractedText}`)
    .digest("hex")}`
}

function waitForJobEvent(expectedJobId: string, event: "completed" | "failed") {
  return new Promise<Record<string, string>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      queueEvents.off(event, listener)
      reject(new Error(`Timed out waiting for ${event} operator job`))
    }, 60_000)
    const listener = (payload: Record<string, string>) => {
      if (payload.jobId !== expectedJobId) return
      clearTimeout(timeout)
      queueEvents.off(event, listener)
      resolve(payload)
    }
    queueEvents.on(event, listener)
  })
}

async function enqueueOperatorJob(contractId: string) {
  await run("pnpm", [
    "exec", "tsx", "scripts/reindex-contract.ts",
    "--organization-id", ids.organization,
    "--contract-id", contractId,
    "--actor-user-id", ids.actor,
    "--actor-member-id", ids.actorMember,
    "--execute",
  ], {
    cwd: webRoot,
    env: workerEnv,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  })
}

let probeError: unknown
let report: Record<string, unknown> | undefined
let removedRedisKeys = 0
try {
  await waitForWorkerStart()

  const revokedJobId = jobId(ids.revokedContract, revokedText)
  const failedEvent = waitForJobEvent(revokedJobId, "failed")
  await enqueueOperatorJob(ids.revokedContract)
  const failed = await failedEvent

  assert.equal(failed.failedReason, "Reindex target is not authorized")
  assert.equal(revokedGrantDeleted, true, "Grant was not revoked during the first provider call")
  assert.equal(providerCalls, 1, "Provider received a document chunk after the grant was revoked")
  assert.equal(revokedDocumentCalls, 1, "Revoked contract text reached the provider after revocation")
  assert.equal(
    Number((await db.query('SELECT count(*) FROM "ContractAccessGrant" WHERE id = $1', [ids.revokedGrant])).rows[0].count),
    0,
  )
  assert.deepEqual(await snapshotContract(ids.revokedContract), revokedBefore,
    "Failed revocation job changed source, canonical facts, activities, or existing embeddings")

  const controlJobId = jobId(ids.controlContract, controlText)
  const completedEvent = waitForJobEvent(controlJobId, "completed")
  await enqueueOperatorJob(ids.controlContract)
  await completedEvent

  const controlAfter = await snapshotContract(ids.controlContract)
  assert.deepEqual(controlAfter.contract, controlBefore.contract, "Control reindex changed canonical contract data")
  assert.deepEqual(controlAfter.files, controlBefore.files, "Control reindex changed source file metadata")
  assert.deepEqual(controlAfter.facts, controlBefore.facts, "Control reindex changed reviewed facts")
  assert.deepEqual(controlAfter.activities, controlBefore.activities, "Index-only control wrote an activity")
  assert.equal(controlAfter.parent.length, 1, "Control parent embedding was not written")
  assert.equal(controlAfter.chunks.length, chunkText(controlText).length, "Control chunk index was incomplete")
  assert.ok(controlAfter.parent[0].model.startsWith("ollama:"), "Control embedding model identity is not Ollama-qualified")
  assert.ok(controlAfter.chunks.every((chunk) => chunk.model === controlAfter.parent[0].model),
    "Control parent and chunk embeddings used different model identities")

  report = {
    status: "PASS",
    targetDatabase,
    redis: { port: 6399, database: 4 },
    revocation: {
      providerCallsBeforeDenial: revokedDocumentCalls,
      providerCallsAfterRevocation: revokedDocumentCalls - 1,
      failedReason: failed.failedReason,
      priorParentRowsPreserved: revokedBefore.parent.length,
      priorChunkRowsPreserved: revokedBefore.chunks.length,
    },
    control: {
      parentRows: controlAfter.parent.length,
      chunkRows: controlAfter.chunks.length,
      providerCalls: providerCalls - revokedDocumentCalls,
    },
    postgresPreservedForInspection: true,
  }
} catch (error) {
  probeError = error
} finally {
  await stopProcess(worker).catch((error) => { probeError ??= error })
  await queueEvents.close().catch((error) => { probeError ??= error })
  await closeServer(provider).catch((error) => { probeError ??= error })
  await removeProbeRedisKeys()
    .then((removed) => { removedRedisKeys = removed })
    .catch((error) => { probeError ??= error })
  await db.end().catch((error) => { probeError ??= error })
  await redis.quit().catch((error) => { probeError ??= error })
}

if (probeError) {
  throw new Error(`Reindex revocation probe failed; inspect preserved database ${targetDatabase}`, {
    cause: probeError,
  })
}
if (!report) throw new Error(`Reindex revocation probe did not produce a report; inspect ${targetDatabase}`)
console.log(JSON.stringify({
  ...report,
  redisCleanup: { removedProbeKeys: removedRedisKeys, remainingKeys: 0 },
}))
