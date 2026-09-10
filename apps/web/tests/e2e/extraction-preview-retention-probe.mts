import assert from "node:assert/strict"
import IORedis from "ioredis"

if (process.env.AAKD_PREVIEW_RETENTION_PROBE !== "1") {
  throw new Error("Opt in with AAKD_PREVIEW_RETENTION_PROBE=1")
}

const redisUrl = new URL(process.env.AAKD_PREVIEW_RETENTION_REDIS_URL ?? "redis://127.0.0.1:6399/5")
if (!['localhost', '127.0.0.1'].includes(redisUrl.hostname)
  || redisUrl.port !== "6399" || redisUrl.pathname !== "/5") {
  throw new Error("Preview retention probe requires isolated local Redis port 6399 database 5")
}

type ResultModule = typeof import("../../lib/jobs/extraction-preview-result")
const loaded = await import("../../lib/jobs/extraction-preview-result") as unknown as {
  default?: ResultModule
} & Partial<ResultModule>
const resultStore = loaded.default ?? loaded as ResultModule
const redis = new IORedis(redisUrl.href, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
})

await redis.connect()
assert.equal(await redis.dbsize(), 0, "Redis DB 5 is not empty; refusing to touch it")

const createdAt = Date.now()
const data = {
  jobId: "00000000-0000-4000-8000-000000000005",
  organizationId: "qa:org",
  requestedByUserId: "qa-user",
  requestedByMemberId: "qa:member",
  storageKey: "previews/qa%3Aorg/qa%3Amember/00000000-0000-4000-8000-000000000005/source",
  fileType: "pdf" as const,
  createdAt,
  expiresAt: createdAt + 600,
}
const result = { counterpartyName: "IDLE_REDIS_TOPSECRET", contractType: "MSA" as const, confidence: {} }
const key = resultStore.extractionPreviewResultKey(data)

try {
  await resultStore.storeExtractionPreviewResult(redis, data, result)
  const initialTtl = await redis.pttl(key)
  assert.ok(initialTtl > 0 && initialTtl <= 600, `Unexpected PXAT TTL: ${initialTtl}`)
  assert.ok((await redis.get(key))?.includes("IDLE_REDIS_TOPSECRET"), "Stored result fixture is missing")

  // No queue operation, polling request, cleanup worker, or Redis command runs during this interval.
  await new Promise((resolve) => setTimeout(resolve, 900))

  assert.equal(await redis.get(key), null, "Sensitive preview survived its absolute Redis expiry")
  assert.equal(await redis.dbsize(), 0, "Expired result key remained in the isolated Redis database")
  console.log(JSON.stringify({ status: "PASS", initialTtl, expiredWithoutQueueActivity: true }))
} finally {
  await redis.del(key)
  await redis.quit()
}
