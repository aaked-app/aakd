import assert from "node:assert/strict"
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { promisify } from "node:util"
import { Document, Packer, Paragraph, TextRun } from "docx"
import { Queue, type Job } from "bullmq"
import IORedis from "ioredis"
import pg from "pg"

if (process.env.AAKD_DOCUMENT_CONVERT_CLEANUP_PROBE !== "1") {
  throw new Error("Opt in with AAKD_DOCUMENT_CONVERT_CLEANUP_PROBE=1")
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
  throw new Error("Document conversion cleanup probe requires local PostgreSQL")
}

const redisUrl = "redis://127.0.0.1:6399/7"
const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null })
assert.equal(await redis.dbsize(), 0, "Redis DB 7 is not empty; refusing to share or clear it")

const run = promisify(execFile)
const webRoot = process.cwd()
const targetDatabase = `aakd_qa_document_cleanup_${randomBytes(6).toString("hex")}`
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

const sql = new pg.Client({ connectionString: source.href })
await sql.connect()

const suffix = randomBytes(4).toString("hex")
const ids = {
  organization: `qa-cleanup-org-${suffix}`,
  owner: `qa-cleanup-owner-${suffix}`,
  actor: `qa-cleanup-actor-${suffix}`,
  ownerMember: `qa-cleanup-owner-member-${suffix}`,
  actorMember: `qa-cleanup-actor-member-${suffix}`,
  contract: `qa-cleanup-contract-${suffix}`,
  grant: `qa-cleanup-grant-${suffix}`,
  file: `qa-cleanup-file-${suffix}`,
} as const

const bucket = `qa-document-cleanup-${suffix}`
const preDeniedKey = `tmp/docx-imports/${ids.contract}/${randomUUID()}.docx`
const finalDeniedKey = `tmp/docx-imports/${ids.contract}/${randomUUID()}.docx`
const controlKey = `tmp/docx-imports/${ids.contract}/${randomUUID()}.docx`
const durableKey = `orgs/${ids.organization}/contracts/${ids.contract}/durable-${suffix}.docx`

const docxBuffer = await Packer.toBuffer(new Document({
  sections: [{ children: [new Paragraph({ children: [new TextRun("Synthetic cleanup probe document") ] })] }],
}))
const durableBuffer = Buffer.from("synthetic-durable-original")
const objects = new Map<string, Buffer>([
  [preDeniedKey, docxBuffer],
  [finalDeniedKey, docxBuffer],
  [controlKey, docxBuffer],
  [durableKey, durableBuffer],
])
const requests = new Map<string, { get: number; delete: number }>()
let revokeOnGetKey: string | null = null
let finalGrantRevoked = false

function requestCount(key: string) {
  const existing = requests.get(key) ?? { get: 0, delete: 0 }
  requests.set(key, existing)
  return existing
}

const s3 = createServer(async (req, res) => {
  try {
    const rawPath = new URL(req.url ?? "/", "http://127.0.0.1").pathname
    const prefix = `/${bucket}/`
    if (!rawPath.startsWith(prefix)) {
      res.writeHead(404)
      res.end()
      return
    }
    const key = decodeURIComponent(rawPath.slice(prefix.length))
    const count = requestCount(key)
    if (req.method === "GET") {
      count.get += 1
      const value = objects.get(key)
      if (!value) {
        res.writeHead(404, { "Content-Type": "application/xml" })
        res.end("<Error><Code>NoSuchKey</Code></Error>")
        return
      }
      if (key === revokeOnGetKey && !finalGrantRevoked) {
        const deleted = await sql.query(`DELETE FROM "ContractAccessGrant" WHERE id=$1`, [ids.grant])
        assert.equal(deleted.rowCount, 1, "Final-guard revocation did not delete the exact synthetic grant")
        finalGrantRevoked = true
      }
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Length": value.byteLength,
        ETag: `"${suffix}"`,
      })
      res.end(value)
      return
    }
    if (req.method === "DELETE") {
      count.delete += 1
      objects.delete(key)
      res.writeHead(204)
      res.end()
      return
    }
    res.writeHead(405)
    res.end()
  } catch {
    res.writeHead(500)
    res.end()
  }
})

await new Promise<void>((resolve, reject) => {
  s3.once("error", reject)
  s3.listen(0, "127.0.0.1", resolve)
})
const address = s3.address()
if (!address || typeof address === "string") throw new Error("Fake S3 server did not expose a TCP port")
const storageEndpoint = `http://127.0.0.1:${address.port}`

await sql.query("BEGIN")
try {
  await sql.query(`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
    ($1, 'QA Cleanup Owner', $2, true, NOW(), NOW()),
    ($3, 'QA Cleanup Actor', $4, true, NOW(), NOW())`,
  [ids.owner, `${ids.owner}@example.test`, ids.actor, `${ids.actor}@example.test`])
  await sql.query(`INSERT INTO "Organization" (id, name, slug, "createdAt")
    VALUES ($1, 'QA Document Cleanup', $2, NOW())`, [ids.organization, `qa-document-cleanup-${suffix}`])
  await sql.query(`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt") VALUES
    ($1, $2, $3, 'owner', NOW()),
    ($4, $2, $5, 'member', NOW())`,
  [ids.ownerMember, ids.organization, ids.owner, ids.actorMember, ids.actor])
  await sql.query(`INSERT INTO "Contract"
    (id, title, "contractType", status, "ownerId", "organizationId", "updatedAt")
    VALUES ($1, 'QA Cleanup Contract', 'OTHER', 'DRAFT', $2, $3, NOW())`,
  [ids.contract, ids.owner, ids.organization])
  await sql.query(`INSERT INTO "ContractFile"
    (id, "contractId", filename, "storageKey", "mimeType", "sizeBytes", "isLatest", version, "uploadedById", "createdAt")
    VALUES ($1, $2, 'durable.docx', $3, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', $4, true, 1, $5, NOW())`,
  [ids.file, ids.contract, durableKey, durableBuffer.byteLength, ids.actor])
  await sql.query("COMMIT")
} catch (error) {
  await sql.query("ROLLBACK")
  throw error
}

const workerEnv: NodeJS.ProcessEnv = {
  ...process.env,
  AAKD_E2E_USE_PROCESS_ENV: "1",
  DATABASE_URL: source.href,
  DIRECT_URL: source.href,
  DATABASE_POOL_SIZE: "4",
  REDIS_URL: redisUrl,
  STORAGE_ENDPOINT: storageEndpoint,
  STORAGE_BUCKET: bucket,
  STORAGE_REGION: "us-east-1",
  STORAGE_ACCESS_KEY: "qa-access-key",
  STORAGE_SECRET_KEY: "qa-secret-key",
  NOTIFICATION_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  AI_PROVIDER: "",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
  OLLAMA_BASE_URL: "",
  SMTP_HOST: "",
  DOCUSEAL_URL: "",
  DOCUSEAL_API_KEY: "",
}

let worker: ChildProcessWithoutNullStreams | null = null
const workerOutput: string[] = []
const queue = new Queue("document.convert", { connection: { url: redisUrl, maxRetriesPerRequest: null } })

function startWorker() {
  worker = spawn("pnpm", ["exec", "tsx", "--tsconfig", "tsconfig.worker.json", "worker.ts"], {
    cwd: webRoot,
    env: workerEnv,
    stdio: ["ignore", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams
  const capture = (chunk: Buffer) => {
    workerOutput.push(chunk.toString())
    if (workerOutput.join("").length > 32_768) workerOutput.splice(0, workerOutput.length - 8)
  }
  worker.stdout.on("data", capture)
  worker.stderr.on("data", capture)
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Worker did not become ready within 30 seconds")), 30_000)
    const inspect = () => {
      if (workerOutput.join("").includes("ClauseFlow BullMQ worker started")) {
        clearTimeout(timeout)
        resolve()
      }
    }
    worker!.stdout.on("data", inspect)
    worker!.stderr.on("data", inspect)
    worker!.once("exit", (code) => {
      clearTimeout(timeout)
      reject(new Error(`Worker exited before ready with code ${code}`))
    })
  })
}

async function waitForState(job: Job, expected: "completed" | "failed") {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const state = await job.getState()
    if (state === expected) return
    if (state === "completed" || state === "failed") {
      throw new Error(`Job ${job.id} reached ${state}, expected ${expected}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Job ${job.id} did not reach ${expected} within 30 seconds`)
}

function explicitData(storageKey: string) {
  return {
    contractId: ids.contract,
    organizationId: ids.organization,
    requestedByMemberId: ids.actorMember,
    storageKey,
    requestedById: ids.actor,
    expectedDocumentVersion: null,
    jobId: `qa-${suffix}`,
    fileType: "docx" as const,
    deleteSource: true,
  }
}

let probeError: unknown
const report: Record<string, unknown> = {
  targetDatabase,
  redis: { port: 6399, database: 7, initialKeys: 0 },
}
try {
  await startWorker()

  const preDenied = await queue.add("convert", explicitData(preDeniedKey), {
    jobId: `qa-pre-denied-${suffix}`,
  })
  await waitForState(preDenied, "failed")
  assert.equal(objects.has(preDeniedKey), false, "Pre-read denied temporary source was retained")
  assert.deepEqual(requestCount(preDeniedKey), { get: 0, delete: 1 })

  const durableDenied = await queue.add("convert", {
    ...explicitData(durableKey),
    sourceFileId: ids.file,
    expectedDocumentVersion: undefined,
    deleteSource: false,
  }, { jobId: `qa-durable-denied-${suffix}` })
  await waitForState(durableDenied, "failed")
  assert.deepEqual(objects.get(durableKey), durableBuffer, "Denied durable original was deleted or changed")
  assert.deepEqual(requestCount(durableKey), { get: 0, delete: 0 })

  await sql.query(`INSERT INTO "ContractAccessGrant"
    (id, "organizationId", "contractId", "memberId", "grantedById") VALUES ($1, $2, $3, $4, $5)`,
  [ids.grant, ids.organization, ids.contract, ids.actorMember, ids.owner])
  revokeOnGetKey = finalDeniedKey
  const finalDenied = await queue.add("convert", explicitData(finalDeniedKey), {
    jobId: `qa-final-denied-${suffix}`,
  })
  await waitForState(finalDenied, "failed")
  assert.equal(finalGrantRevoked, true, "Controlled storage read did not trigger mid-job revocation")
  assert.equal(objects.has(finalDeniedKey), false, "Final-guard denied temporary source was retained")
  assert.deepEqual(requestCount(finalDeniedKey), { get: 1, delete: 1 })
  assert.equal(Number((await sql.query(`SELECT COUNT(*)::int AS count FROM "ContractDocument" WHERE "contractId"=$1`, [ids.contract])).rows[0].count), 0)
  assert.equal(Number((await sql.query(`SELECT COUNT(*)::int AS count FROM "Activity" WHERE "contractId"=$1 AND action='DOCUMENT_IMPORTED'`, [ids.contract])).rows[0].count), 0)

  await sql.query(`INSERT INTO "ContractAccessGrant"
    (id, "organizationId", "contractId", "memberId", "grantedById") VALUES ($1, $2, $3, $4, $5)`,
  [ids.grant, ids.organization, ids.contract, ids.actorMember, ids.owner])
  revokeOnGetKey = null
  const control = await queue.add("convert", explicitData(controlKey), {
    jobId: `qa-control-${suffix}`,
  })
  await waitForState(control, "completed")
  assert.equal(objects.has(controlKey), false, "Successful explicit import retained its temporary source")
  assert.deepEqual(requestCount(controlKey), { get: 1, delete: 1 })
  assert.deepEqual(objects.get(durableKey), durableBuffer, "Control conversion changed the durable original")
  assert.equal(Number((await sql.query(`SELECT COUNT(*)::int AS count FROM "ContractDocument" WHERE "contractId"=$1 AND version=1`, [ids.contract])).rows[0].count), 1)
  assert.equal(Number((await sql.query(`SELECT COUNT(*)::int AS count FROM "Activity" WHERE "contractId"=$1 AND action='DOCUMENT_IMPORTED'`, [ids.contract])).rows[0].count), 1)

  report.preReadDenial = { temporaryDeleted: true, sourceReads: 0, deleteCalls: 1 }
  report.finalGuardDenial = { temporaryDeleted: true, sourceReads: 1, deleteCalls: 1, documentWrites: 0, activityWrites: 0 }
  report.durableOriginal = { preserved: true, sourceReads: 0, deleteCalls: 0 }
  report.validControl = { completed: true, temporaryDeleted: true, documentVersion: 1, activityWrites: 1 }
  report.status = "PASS"
} catch (error) {
  probeError = error
  report.status = "FAIL"
  report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
} finally {
  if (worker && worker.exitCode === null) {
    worker.kill("SIGTERM")
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (worker?.exitCode === null) worker.kill("SIGKILL")
        resolve()
      }, 35_000)
      worker!.once("exit", () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }
  await queue.close()
  await redis.quit()
  await sql.end()
  await new Promise<void>((resolve) => s3.close(() => resolve()))
}

process.stdout.write(`${JSON.stringify({ ...report, postgresPreservedForInspection: true })}\n`)
if (probeError) throw probeError
