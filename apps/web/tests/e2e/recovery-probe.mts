import { execFileSync, spawn } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import pg from "pg"
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3"
import { request } from "@playwright/test"
const { storage } = createRequire(import.meta.url)("../../lib/storage/index.ts") as typeof import("../../lib/storage/index")

// Restore only an explicitly named, disposable acceptance database. No deletion.
const source = new URL(process.env.DATABASE_URL ?? "")
const database = source.pathname.slice(1)
const container = process.env.AAKD_RECOVERY_DB_CONTAINER
if (process.env.AAKD_RECOVERY_PROBE !== "1" || !container || !/^aakd_acceptance_[a-z0-9_]+$/.test(database)
  || !["localhost", "127.0.0.1"].includes(source.hostname)) {
  throw new Error("Recovery probe requires an explicitly authorized local aakd_acceptance_* database and container")
}
const sourceBucket = process.env.STORAGE_BUCKET
const endpoint = new URL(process.env.STORAGE_ENDPOINT ?? "")
if (!sourceBucket || !["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw new Error("Recovery probe requires local object storage")
const suffix = randomBytes(6).toString("hex")
const targetDatabase = `aakd_restore_${suffix}`
const targetBucket = `aakd-restore-${suffix}`
const directory = await mkdtemp(join(tmpdir(), "aakd-recovery-"))
const runtimeProbe = process.env.AAKD_RECOVERY_RUNTIME_PROBE === "1"
let runtimeFixture: { email: string; password: string; organizationId: string; contractId: string; pdf: Buffer } | undefined
if (runtimeProbe) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Runtime fixture requires a local PLAYWRIGHT_BASE_URL")
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
  try {
    const email = `restore-${suffix}@example.test`
    const password = randomBytes(32).toString("base64url")
    const signup = await api.post("/api/auth/sign-up/email", { data: { email, password, name: "Synthetic Restore Probe" } })
    if (!signup.ok()) throw new Error(`Restore fixture signup: ${signup.status()}`)
    const org = await api.post("/api/auth/organization/create", { data: { name: `Restore ${suffix}`, slug: `restore-${suffix}` } })
    if (!org.ok()) throw new Error(`Restore fixture organization: ${org.status()}`)
    const organizationId = (await org.json()).id
    if (!(await api.post("/api/auth/organization/set-active", { data: { organizationId } })).ok()) throw new Error("Restore fixture activation failed")
    const created = await api.post("/api/contracts", { data: { title: `Restorable synthetic agreement ${suffix}` } })
    if (created.status() !== 201) throw new Error(`Restore fixture contract: ${created.status()}`)
    const contractId = (await created.json()).id
    const { createTextPdf } = createRequire(import.meta.url)("./pdf-fixture.ts") as typeof import("./pdf-fixture")
    const pdf = createTextPdf(["Synthetic restoration acceptance agreement.", "Renewal requires 45 days written notice."])
    const uploaded = await api.post(`/api/contracts/${contractId}/upload`, { multipart: { file: { name: "restore-acceptance.pdf", mimeType: "application/pdf", buffer: pdf } } })
    if (!uploaded.ok()) throw new Error(`Restore fixture upload: ${uploaded.status()}`)
    runtimeFixture = { email, password, organizationId, contractId, pdf }
  } finally { await api.dispose() }
}
const client = new pg.Client({ connectionString: source.href })
await client.connect()
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
let files: Array<{ storageKey: string; mimeType: string }>
let expectedCounts: unknown
try {
  files = (await client.query('SELECT "storageKey", "mimeType" FROM "ContractFile" ORDER BY id')).rows
  if (!files.length) throw new Error("Upload representative synthetic contracts before the restore probe")
  expectedCounts = (await client.query('SELECT (SELECT COUNT(*) FROM "Contract") AS contracts, (SELECT COUNT(*) FROM "ContractAction") AS actions, (SELECT COUNT(*) FROM "ContractFile") AS files')).rows[0]
} finally { await client.end() }

const dump = execFileSync("docker", ["exec", container, "pg_dump", "-U", "postgres", "-Fc", "-d", database], { maxBuffer: 64 * 1024 * 1024 })
await writeFile(join(directory, "database.dump"), dump)
const manifest: Array<{ key: string; path: string; sha256: string; contentType: string }> = []
for (const [index, file] of files.entries()) {
  const object = await storage.getObject(file.storageKey)
  const path = `${index}.bin`
  await writeFile(join(directory, path), object.body)
  manifest.push({ key: file.storageKey, path, sha256: digest(object.body), contentType: object.contentType ?? file.mimeType })
}
await writeFile(join(directory, "files.json"), JSON.stringify(manifest, null, 2))

execFileSync("docker", ["exec", container, "createdb", "-U", "postgres", targetDatabase])
execFileSync("docker", ["exec", "-i", container, "pg_restore", "-U", "postgres", "--exit-on-error", "--no-owner", "-d", targetDatabase], { input: await readFile(join(directory, "database.dump")), maxBuffer: 4 * 1024 * 1024 })
const s3 = new S3Client({ region: process.env.STORAGE_REGION ?? "us-east-1", endpoint: endpoint.href, forcePathStyle: true,
  credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "", secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "" } })
await s3.send(new CreateBucketCommand({ Bucket: targetBucket }))
process.env.STORAGE_BUCKET = targetBucket
for (const file of manifest) {
  const body = await readFile(join(directory, file.path))
  if (digest(body) !== file.sha256) throw new Error("Backup file digest mismatch")
  await storage.upload(file.key, body, file.contentType)
  if (digest((await storage.getObject(file.key)).body) !== file.sha256) throw new Error("Restored object digest mismatch")
}
source.pathname = `/${targetDatabase}`
const restored = new pg.Client({ connectionString: source.href })
await restored.connect()
try {
  const counts = (await restored.query('SELECT (SELECT COUNT(*) FROM "Contract") AS contracts, (SELECT COUNT(*) FROM "ContractAction") AS actions, (SELECT COUNT(*) FROM "ContractFile") AS files')).rows[0]
  if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) throw new Error("Restored database count mismatch")
  console.log(JSON.stringify({ status: "PASS", counts, objectsVerified: manifest.length, databaseDumpSha256: digest(dump), directory, targetDatabase, targetBucket, sourcePreserved: true }))
} finally { await restored.end(); s3.destroy() }

if (runtimeFixture) {
  // Run a separate application instance against restored DB AND restored bucket.
  // No worker starts here, and no source runtime/database is reconfigured.
  const net = await import("node:net")
  const probe = net.createServer()
  // A fixed port can reach an unrelated wildcard-bound tunnel before the
  // child is ready and retain that HTTP connection throughout polling.
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve) })
  const port = (probe.address() as import("node:net").AddressInfo).port
  const baseURL = `http://127.0.0.1:${port}`
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()))
  // Exercise the same compiled application as the candidate, not a second dev
  // compiler with independent generated routes and potentially different code.
  const distDirectory = process.env.NEXT_DIST_DIR ?? ".next"
  if (!/^\.next(?:-[a-zA-Z0-9-]+)?$/.test(distDirectory)) throw new Error("Use a local candidate build directory")
  const server = join(process.cwd(), distDirectory, "standalone/apps/web/server.js")
  await access(server)
  const child = spawn(process.execPath, [server], {
    cwd: process.cwd(), stdio: "ignore",
    env: { ...process.env, DATABASE_URL: source.href, DIRECT_URL: source.href, STORAGE_BUCKET: targetBucket,
      HOSTNAME: "127.0.0.1", PORT: String(port), RUNTIME_NODE_ENV: "development",
      BETTER_AUTH_URL: baseURL, NEXT_PUBLIC_APP_URL: baseURL, INTERNAL_APP_URL: baseURL },
  })
  let spawnError: Error | undefined
  child.on("error", error => { spawnError = error })
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 60_000 })
  try {
    const deadline = Date.now() + 120_000
    let ready = false
    let readinessStatus: number | null = null
    let readinessError: string | null = null
    let reportedStatus: number | null = null
    while (Date.now() < deadline && !spawnError && child.exitCode === null) {
      try {
        const response = await api.get("/api/auth/get-session", { timeout: 30_000 })
        readinessStatus = response.status()
        if (readinessStatus !== reportedStatus) {
          console.log(JSON.stringify({ step: "restored_runtime_readiness", status: readinessStatus, origin: new URL(response.url()).origin, path: new URL(response.url()).pathname, appDirectory: process.cwd() }))
          reportedStatus = readinessStatus
        }
        ready = response.ok()
      } catch (error) { readinessError = error instanceof Error ? error.name : "UnknownError" }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (!ready) throw new Error(`Restored application readiness failed (status=${readinessStatus}, error=${readinessError}, exit=${child.exitCode})`)
    const login = await api.post("/api/auth/sign-in/email", { data: { email: runtimeFixture.email, password: runtimeFixture.password } })
    if (!login.ok()) throw new Error(`Restored login: ${login.status()}`)
    if (!(await api.post("/api/auth/organization/set-active", { data: { organizationId: runtimeFixture.organizationId } })).ok()) throw new Error("Restored organization activation failed")
    const detail = await api.get(`/api/contracts/${runtimeFixture.contractId}`)
    if (!detail.ok()) throw new Error(`Restored contract detail: ${detail.status()}`)
    const fileId = (await detail.json()).files?.[0]?.id
    if (!fileId) throw new Error("Restored contract has no original file")
    const file = await api.get(`/api/contracts/${runtimeFixture.contractId}/upload?fileId=${encodeURIComponent(fileId)}&stream=1&inline=1`)
    if (!file.ok() || !file.headers()["content-type"]?.includes("application/pdf") || digest(await file.body()) !== digest(runtimeFixture.pdf)) throw new Error("Restored original-file preview does not match the uploaded document")
    console.log(JSON.stringify({ step: "restored_runtime", status: "PASS", login: true, contractDetail: true, originalFileSha256: true, sourceRuntimePreserved: true }))
  } finally {
    await api.dispose()
    if (child.exitCode === null) child.kill("SIGTERM")
    await Promise.race([new Promise(resolve => child.once("close", resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
  }
}
