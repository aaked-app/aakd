import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer, type Server } from "node:http"
import { networkInterfaces } from "node:os"

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid")
const redisUrl = new URL(process.env.REDIS_URL ?? "redis://invalid")
if (
  process.env.AAKD_INTERACTIVE_AI_PROBE !== "1"
  || !["127.0.0.1", "localhost"].includes(databaseUrl.hostname)
  || databaseUrl.port !== "5433"
  || !databaseUrl.pathname.startsWith("/aakd_acceptance_")
  || !["127.0.0.1", "localhost"].includes(redisUrl.hostname)
  || redisUrl.port !== "6399"
  || redisUrl.pathname !== "/6"
) {
  throw new Error("Interactive AI probe requires explicit opt-in and isolated local PostgreSQL/Redis")
}
if (!process.env.NOTIFICATION_ENCRYPTION_KEY) throw new Error("Probe encryption key is required")

const providerCalls = { tags: 0, embed: 0, chat: 0 }
let blockNextPlainChat = false
let notifyBlockedChat: (() => void) | null = null
let releaseBlockedChat: (() => void) | null = null
const provider: Server = createServer((request, response) => {
  const chunks: Buffer[] = []
  request.on("data", (chunk: Buffer) => chunks.push(chunk))
  request.on("end", () => {
    response.setHeader("Content-Type", "application/json")
    if (request.url === "/api/tags") {
      providerCalls.tags += 1
      response.end(JSON.stringify({ models: [{ name: "synthetic-chat" }] }))
      return
    }
    if (request.url === "/api/embed") {
      providerCalls.embed += 1
      response.end(JSON.stringify({ embeddings: [Array.from({ length: 1536 }, () => 0.01)] }))
      return
    }
    if (request.url === "/api/chat") {
      providerCalls.chat += 1
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { messages?: Array<{ content?: string }> }
      const wantsJson = body.messages?.some((message) => message.content?.includes("JSON object"))
      void (async () => {
        if (!wantsJson && blockNextPlainChat) {
          blockNextPlainChat = false
          notifyBlockedChat?.()
          await new Promise<void>((resolve) => { releaseBlockedChat = resolve })
        }
        response.end(JSON.stringify({ message: { content: wantsJson
          ? JSON.stringify({ explanation: "Synthetic explanation", risk: "low", riskReason: "Synthetic reason" })
          : "Synthetic answer from the contract." } }))
      })()
      return
    }
    response.statusCode = 404
    response.end(JSON.stringify({ error: "not_found" }))
  })
})

function localPrivateAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) {
        return address.address
      }
    }
  }
  throw new Error("Synthetic provider requires a local RFC-1918 address")
}

async function listen(server: Server, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, () => {
      const address = server.address()
      if (!address || typeof address === "string") reject(new Error("Synthetic provider did not bind locally"))
      else resolve(address.port)
    })
  })
}

async function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

const providerAddress = localPrivateAddress()
const providerPort = await listen(provider, providerAddress)
const providerOrigin = `http://${providerAddress}:${providerPort}`
process.env.OLLAMA_PRIVATE_ORIGINS = providerOrigin
process.env.OLLAMA_EMBEDDING_MODEL = "synthetic-embedding"

const { encrypt } = await import("../../lib/notifications/crypto")
const { getWorkerPrisma } = await import("../../lib/db/worker-client")
const { prisma } = await import("../../lib/db/client")
const { createInteractiveAiWorker } = await import("../../../../worker/jobs/interactive-ai")
const {
  closeInteractiveAiClient,
  enqueueInteractiveAiRequest,
  readInteractiveAiRequest,
} = await import("../../lib/jobs/interactive-ai-client")
const { getInteractiveAiQueue } = await import("../../lib/jobs/queues")
const { interactiveAiPayloadKey, interactiveAiResultKey } = await import("../../lib/jobs/interactive-ai")

const db = getWorkerPrisma()
const suffix = randomUUID()
const ids = {
  user: `probe-user-${suffix}`,
  organization: `probe-org-${suffix}`,
  member: `probe-member-${suffix}`,
  contract: `probe-contract-${suffix}`,
}
const now = new Date()
const worker = createInteractiveAiWorker({ url: redisUrl.href })
const queue = getInteractiveAiQueue()
const jobs: Array<{ jobId: string }> = []
const jobIds = new Map<string, string>()

try {
  await worker.waitUntilReady()
  await db.user.create({ data: {
    id: ids.user,
    name: "Interactive AI Probe",
    email: `${ids.user}@example.test`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  } })
  await db.organization.create({ data: {
    id: ids.organization,
    name: "Interactive AI Probe",
    slug: ids.organization,
    createdAt: now,
  } })
  await db.member.create({ data: {
    id: ids.member,
    organizationId: ids.organization,
    userId: ids.user,
    role: "owner",
    createdAt: now,
  } })
  await db.contract.create({ data: {
    id: ids.contract,
    organizationId: ids.organization,
    ownerId: ids.user,
    title: `Synthetic Renewal ${suffix}`,
    extractedText: "This agreement renews annually. Either party may terminate with thirty days written notice.",
  } })
  await db.contractAccessGrant.create({ data: {
    organizationId: ids.organization,
    contractId: ids.contract,
    memberId: ids.member,
    grantedById: ids.user,
  } })
  await db.orgAiConfig.create({ data: {
    organizationId: ids.organization,
    provider: "ollama",
    encryptedKey: encrypt(providerOrigin),
    model: "synthetic-chat",
  } })

  const ctx = {
    userId: ids.user,
    organizationId: ids.organization,
    memberId: ids.member,
    role: "owner",
    source: "session" as const,
    requestId: `probe-${suffix}`,
  }
  const cases = [
    ["config_test", null, { operation: "config_test", provider: "ollama", encryptedCredential: encrypt(providerOrigin), model: "synthetic-chat" }, 12_000],
    ["clause_explanation", ids.contract, { operation: "clause_explanation", clauseText: "Either party may terminate with thirty days written notice." }, 35_000],
    ["semantic_search", null, { operation: "semantic_search", query: `Synthetic Renewal ${suffix}`, limit: 10, threshold: 0.3 }, 35_000],
    ["contract_question", ids.contract, { operation: "contract_question", question: "What is the termination notice?" }, 35_000],
  ] as const

  const outputs: Record<string, unknown> = {}
  for (const [operation, contractId, payload, waitMs] of cases) {
    const result = await enqueueInteractiveAiRequest(ctx, operation, contractId, payload, waitMs)
    assert.equal(result.state, "completed", `${operation} did not complete through the native worker`)
    if (result.state !== "completed") continue
    jobs.push({ jobId: result.jobId })
    jobIds.set(operation, result.jobId)
    assert.equal(result.response.status, 200, `${operation} response status`)
    outputs[operation] = result.response.body

    const job = await queue.getJob(result.jobId)
    assert.ok(job, `${operation} BullMQ job was not retained for metadata inspection`)
    const serializedJob = JSON.stringify(job.data)
    assert.ok(!serializedJob.includes(providerOrigin), `${operation} leaked provider credentials into BullMQ`)
    assert.ok(!serializedJob.includes("termination notice"), `${operation} leaked private input into BullMQ`)
    assert.equal(await (await queue.client).get(interactiveAiPayloadKey(job.data)), null, `${operation} payload was not deleted`)
    const resultTtl = await (await queue.client).pttl(interactiveAiResultKey(job.data))
    assert.ok(resultTtl > 0 && resultTtl <= 300_000, `${operation} result did not retain the bounded TTL`)
  }

  assert.equal((outputs.config_test as { valid?: boolean }).valid, true)
  assert.equal((outputs.clause_explanation as { explanation?: string }).explanation, "Synthetic explanation")
  assert.equal((outputs.semantic_search as { mode?: string }).mode, "keyword")
  assert.equal((outputs.contract_question as { answer?: string }).answer, "Synthetic answer from the contract.")
  assert.deepEqual(providerCalls, { tags: 1, embed: 2, chat: 2 })

  const completedAskId = jobIds.get("contract_question")
  assert.ok(completedAskId)
  const completedAskJob = await queue.getJob(completedAskId)
  assert.ok(completedAskJob)
  await db.contractAccessGrant.delete({ where: { contractId_memberId: { contractId: ids.contract, memberId: ids.member } } })
  const revokedCachedPoll = await readInteractiveAiRequest(ctx, completedAskId)
  assert.deepEqual(revokedCachedPoll, { state: "failed", jobId: completedAskId })
  assert.equal(await (await queue.client).get(interactiveAiResultKey(completedAskJob.data)), null, "Revoked cached answer was not purged")
  await db.contractAccessGrant.create({ data: {
    organizationId: ids.organization,
    contractId: ids.contract,
    memberId: ids.member,
    grantedById: ids.user,
  } })

  let blockedChatReached!: () => void
  const blockedChat = new Promise<void>((resolve) => { blockedChatReached = resolve })
  notifyBlockedChat = blockedChatReached
  blockNextPlainChat = true
  const revokedDuringResponse = enqueueInteractiveAiRequest(ctx, "contract_question", ids.contract, {
    operation: "contract_question",
    question: "What is the termination notice during revocation?",
  }, 35_000)
  await blockedChat
  await db.contractAccessGrant.delete({ where: { contractId_memberId: { contractId: ids.contract, memberId: ids.member } } })
  releaseBlockedChat?.()
  const revokedSubmission = await revokedDuringResponse
  assert.equal(revokedSubmission.state, "failed", "Worker returned a model response after grant revocation")
  jobs.push({ jobId: revokedSubmission.jobId })
  const revokedJob = await queue.getJob(revokedSubmission.jobId)
  assert.ok(revokedJob)
  assert.equal(await (await queue.client).get(interactiveAiResultKey(revokedJob.data)), null, "Revoked in-flight response reached Redis")

  const first = jobs[0]
  assert.ok(first)
  const crossOrganization = await readInteractiveAiRequest({ ...ctx, organizationId: `other-${suffix}` }, first.jobId)
  assert.equal(crossOrganization, null, "Cross-organization polling exposed a result")

  console.log(JSON.stringify({
    nativeWorkerOperations: Object.keys(outputs),
    syntheticProviderCalls: providerCalls,
    bullMqPrivateInput: false,
    boundedRedisRetention: true,
    crossOrganizationPollDenied: true,
    cachedRevocationPurged: true,
    inFlightRevocationDenied: true,
  }))
} finally {
  for (const { jobId } of jobs) await (await queue.getJob(jobId))?.remove().catch(() => {})
  await db.organization.delete({ where: { id: ids.organization } }).catch(() => {})
  await db.user.delete({ where: { id: ids.user } }).catch(() => {})
  await closeInteractiveAiClient().catch(() => {})
  await worker.close().catch(() => {})
  await queue.close().catch(() => {})
  await prisma.$disconnect().catch(() => {})
  await db.$disconnect().catch(() => {})
  await closeServer(provider).catch(() => {})
}
