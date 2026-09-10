import { randomBytes } from "node:crypto"
import { chromium, expect, request } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL
const redisUrl = process.env.REDIS_URL
if (
  process.env.AAKD_EXTRACTION_PREVIEW_PROBE !== "1"
  || !baseURL
  || !redisUrl
  || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
) {
  throw new Error("Opt in with AAKD_EXTRACTION_PREVIEW_PROBE=1 and isolated local runtime variables")
}

const { createTextPdf } = await import("./pdf-fixture")
const { Worker } = await import("bullmq")
const { processExtractionPreview } = await import("../../lib/jobs/extraction-preview-processor")
const { getExtractionPreviewQueue } = await import("../../lib/jobs/queues")
const { storage } = await import("../../lib/storage")

const worker = new Worker(
  "contract.extraction_preview",
  (job) => processExtractionPreview(job.data),
  { connection: { url: redisUrl }, concurrency: 1 },
)
const queue = getExtractionPreviewQueue()
const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 30_000 })
const otherApi = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 30_000 })
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

async function createWorkspace(client: typeof api, label: string) {
  const suffix = randomBytes(8).toString("hex")
  const signup = await client.post("/api/auth/sign-up/email", { data: {
    name: `Preview ${label}`,
    email: `preview-${label}-${suffix}@example.test`,
    password: randomBytes(32).toString("base64url"),
  } })
  if (!signup.ok()) throw new Error(`Signup status ${signup.status()}`)
  const org = await client.post("/api/auth/organization/create", {
    data: { name: `Preview ${label} ${suffix}`, slug: `preview-${label}-${suffix}` },
  })
  if (!org.ok()) throw new Error(`Organization status ${org.status()}`)
  const organizationId = (await org.json() as { id: string }).id
  const active = await client.post("/api/auth/organization/set-active", { data: { organizationId } })
  if (!active.ok()) throw new Error(`Organization activation status ${active.status()}`)
  return organizationId
}

try {
  const organizationId = await createWorkspace(api, "owner")
  await createWorkspace(otherApi, "other")
  const file = {
    name: "synthetic-preview.pdf",
    mimeType: "application/pdf",
    buffer: createTextPdf(["MASTER SERVICES AGREEMENT. This agreement may renew with written consent."]),
  }

  const startedAt = Date.now()
  const accepted = await api.post("/api/contracts/extract-preview", { multipart: { file } })
  const elapsedMs = Date.now() - startedAt
  const acceptedBody = await accepted.json() as { jobId?: string; status?: string }
  if (accepted.status() !== 202 || acceptedBody.status !== "pending" || !acceptedBody.jobId) {
    throw new Error(`Preview enqueue status ${accepted.status()}`)
  }
  if (elapsedMs >= 5_000) throw new Error(`Preview enqueue was not asynchronous (${elapsedMs}ms)`)

  const internalJob = await queue.getJob(acceptedBody.jobId)
  if (!internalJob || internalJob.data.organizationId !== organizationId) {
    throw new Error("Queued preview ownership did not match the requester")
  }
  const storageKey = internalJob.data.storageKey

  const crossOrg = await otherApi.get(
    `/api/contracts/extract-preview?jobId=${encodeURIComponent(acceptedBody.jobId)}`,
  )
  if (crossOrg.status() !== 404) throw new Error(`Cross-organization poll status ${crossOrg.status()}`)

  let result: { error?: string; partial?: boolean } | undefined
  await expect.poll(async () => {
    const poll = await api.get(
      `/api/contracts/extract-preview?jobId=${encodeURIComponent(acceptedBody.jobId!)}`,
    )
    if (!poll.ok()) return false
    const body = await poll.json() as { status?: string; result?: typeof result }
    if (body.status === "failed" || body.status === "expired") {
      throw new Error(`Preview reached ${body.status}`)
    }
    result = body.result
    return body.status === "completed"
  }, { timeout: 30_000, intervals: [250], message: "Dedicated preview worker must complete" }).toBe(true)
  if (result?.error !== "ai_unavailable" || result.partial !== true) {
    throw new Error("No-key preview did not return the expected minimized partial result")
  }
  await expect(storage.getObject(storageKey)).rejects.toBeTruthy()

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL, storageState: await api.storageState() })
  const page = await context.newPage()
  await page.goto("/contracts/new")
  const onboarding = page.getByRole("dialog")
  await onboarding.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {})
  if (await onboarding.isVisible()) {
    await onboarding.locator("button", { hasText: "Skip" }).click()
    await expect(onboarding).toBeHidden()
  }
  await page.locator('input[type="file"]').setInputFiles(file)
  const selectedFile = page.getByText(file.name)
  await expect(selectedFile).toBeVisible()
  await page.locator("button", { hasText: "Continue to review" }).click()
  await expect(page.getByRole("status")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel(/Contract title/)).toHaveValue("Synthetic Preview")
  await context.close()

  const ownJobs = (await queue.getJobs(["completed", "failed", "waiting", "active"]))
    .filter((job) => job.data.organizationId === organizationId)
  for (const job of ownJobs) {
    await expect(storage.getObject(job.data.storageKey)).rejects.toBeTruthy()
    await job.remove().catch(() => {})
  }
  console.log(JSON.stringify({
    asyncPost: true,
    elapsedMs,
    workerCompleted: true,
    crossOrganizationDenied: true,
    sourceCleanup: true,
    browserPollingFallback: true,
  }))
} finally {
  await browser?.close().catch(() => {})
  await worker.close()
  await queue.close()
  await api.dispose()
  await otherApi.dispose()
}
