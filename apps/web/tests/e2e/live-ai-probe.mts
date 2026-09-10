import { randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { expect, request, type APIResponse } from "@playwright/test"

const require = createRequire(import.meta.url)
const { createTextPdf } = require("./pdf-fixture.ts")
const baseURL = process.env.PLAYWRIGHT_BASE_URL
const apiKey = process.env.AAKD_PROBE_OPENAI_KEY
if (process.env.AAKD_LIVE_AI_PROBE !== "1" || !baseURL || !apiKey
  || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
  throw new Error("Opt in with AAKD_LIVE_AI_PROBE=1, local PLAYWRIGHT_BASE_URL and AAKD_PROBE_OPENAI_KEY")
}

const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL }, timeout: 120_000 })
async function settleInteractive(initial: APIResponse): Promise<APIResponse> {
  let response = initial
  let jobId: string | undefined
  const deadline = Date.now() + 270_000
  while (response.status() === 202) {
    const pending = await response.json()
    if (typeof pending.jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(pending.jobId)
      || (jobId !== undefined && jobId !== pending.jobId)) {
      throw new Error("Interactive job returned an invalid or changed continuation identity")
    }
    jobId = pending.jobId
    if (Date.now() >= deadline) throw new Error("Interactive provider job did not finish within its retention window")
    // Continue the same job. Never repeat the paid provider submission.
    response = await api.get(`/api/ai-requests/${encodeURIComponent(jobId!)}`, { timeout: 40_000 })
  }
  return response
}
let configured = false
try {
  const suffix = randomBytes(8).toString("hex")
  const signup = await api.post("/api/auth/sign-up/email", { data: {
    name: "Synthetic AI Probe", email: `ai-probe-${suffix}@example.test`, password: randomBytes(32).toString("base64url"),
  } })
  if (!signup.ok()) throw new Error(`Signup status ${signup.status()}`)
  const org = await api.post("/api/auth/organization/create", { data: { name: `AI probe ${suffix}`, slug: `ai-probe-${suffix}` } })
  if (!org.ok()) throw new Error(`Organization status ${org.status()}`)
  const active = await api.post("/api/auth/organization/set-active", { data: { organizationId: (await org.json()).id } })
  if (!active.ok()) throw new Error(`Organization activation status ${active.status()}`)
  const config = { provider: "openai", model: "gpt-4o-mini", apiKey }
  const tested = await settleInteractive(await api.post("/api/org/ai-config/test", { data: config }))
  const testResult = await tested.json()
  // Log only fixed fields, never provider responses, headers or credentials.
  console.log(JSON.stringify({ step: "provider_test", status: tested.status(), valid: testResult.valid === true }))
  if (!tested.ok() || testResult.valid !== true) throw new Error("Configured provider did not pass the usability test")
  const saved = await api.post("/api/org/ai-config", { data: config })
  if (!saved.ok()) throw new Error(`Credential save status ${saved.status()}`)
  configured = true
  const summary = await (await api.get("/api/org/ai-config")).json()
  if (!summary.hasKey || summary.provider !== "openai" || "apiKey" in summary || "encryptedKey" in summary) {
    throw new Error("Saved provider configuration did not return a minimized confirmation")
  }
  const file = {
    name: "synthetic-ai-acceptance.pdf", mimeType: "application/pdf", buffer: createTextPdf([
      "MASTER SERVICES AGREEMENT",
      "Customer: Synthetic Orchard Labs. Provider: Synthetic River Services.",
      "Effective Date: January 1, 2026. End Date: December 31, 2026.",
      "The customer pays EUR 12000 annually within 30 days of invoice.",
      "This agreement automatically renews unless either party gives 45 days written notice.",
      "Provider shall deliver a monthly service report.",
      "Governing Law: France.",
    ]),
  }
  const preview = await api.post("/api/contracts/extract-preview", { multipart: { file } })
  const accepted = await preview.json() as { jobId?: string }
  if (preview.status() !== 202 || !accepted.jobId) {
    throw new Error(`Extraction preview enqueue status ${preview.status()}`)
  }
  let result: Record<string, unknown> | null = null
  await expect.poll(async () => {
    const poll = await api.get(`/api/contracts/extract-preview?jobId=${encodeURIComponent(accepted.jobId!)}`)
    if (!poll.ok()) return false
    const body = await poll.json() as { status?: string; result?: Record<string, unknown> }
    if (body.status === "failed" || body.status === "expired") {
      throw new Error(`Extraction preview reached ${body.status}`)
    }
    if (body.status === "completed" && body.result) {
      result = body.result
      return true
    }
    return false
  }, { timeout: 90_000, intervals: [1000], message: "Queued extraction preview must complete" }).toBe(true)
  const pass = result !== null && !result.error && result.contractType === "MSA"
    && result.value === 12000 && result.currency === "EUR" && result.noticePeriodDays === 45
  console.log(JSON.stringify({ step: "saved_key_pdf_preview", status: preview.status(), pass,
    hasProviderError: Boolean(result?.error), hasConfidence: Object.keys(result?.confidence ?? {}).length > 0 }))
  if (!pass) throw new Error("Live AI extraction did not satisfy the synthetic acceptance assertions")

  const created = await api.post("/api/contracts", { data: { title: `Synthetic live AI ${suffix}` } })
  if (created.status() !== 201) throw new Error(`Contract creation status ${created.status()}`)
  const contractId = (await created.json()).id
  const uploaded = await api.post(`/api/contracts/${contractId}/upload`, { multipart: { file } })
  if (!uploaded.ok()) throw new Error(`Contract upload status ${uploaded.status()}`)
  await expect.poll(async () => {
    const extracted = await api.get(`/api/contracts/${contractId}/extractions`)
    if (!extracted.ok()) return false
    const rows = (await extracted.json()).extractions as Array<{ field: string; rawValue: string; sourceText: string | null; sourcePage: number | null; extractedBy: string; status: string }>
    const value = rows.find(row => row.field === "value")
    return value?.rawValue === "12000" && Boolean(value.sourceText?.includes("12000"))
      && value.sourcePage === 1 && value.extractedBy === "ai" && value.status === "pending"
  }, { timeout: 90_000, intervals: [1000], message: "Worker must persist a cited pending AI value from the saved organization key" }).toBe(true)
  console.log(JSON.stringify({ step: "saved_key_worker_extraction", pass: true, contractId }))

  const question = await settleInteractive(await api.post(`/api/contracts/${contractId}/ask`, { data: { question: "How many days written notice are required to stop automatic renewal?" } }))
  const answer = await question.json()
  const answerHasNotice = typeof answer.answer === "string" && answer.answer.includes("45")
  const citationHasNotice = Array.isArray(answer.citations) && answer.citations.some(
    (citation: { text?: string }) => citation.text?.replace(/\s+/g, " ").includes("45 days written notice"),
  )
  console.log(JSON.stringify({ step: "saved_key_cited_question_check", status: question.status(), answerHasNotice, citationHasNotice }))
  if (!question.ok() || !answerHasNotice || !citationHasNotice) {
    throw new Error(`Cited saved-provider question failed: ${question.status()}`)
  }
  console.log(JSON.stringify({ step: "saved_key_cited_question", pass: true }))

  const explanation = await settleInteractive(await api.post(`/api/contracts/${contractId}/clause-explain`, { data: { text: "This agreement automatically renews unless either party gives 45 days written notice." } }))
  const explained = await explanation.json()
  if (!explanation.ok() || typeof explained.explanation !== "string" || !explained.explanation.trim()
    || !["low", "medium", "high", "unknown"].includes(explained.risk)) {
    throw new Error(`Structured clause explanation failed: ${explanation.status()}`)
  }
  console.log(JSON.stringify({ step: "saved_key_clause_explanation", pass: true, limitation: "Workflow and response shape, not legal accuracy" }))

  const risk = await api.post(`/api/contracts/${contractId}/risk-score`)
  const riskJob = await risk.json()
  if (risk.status() !== 202 || typeof riskJob.jobId !== "string") throw new Error(`Risk enqueue failed: ${risk.status()}`)
  await expect.poll(async () => {
    const polled = await api.get(`/api/contracts/${contractId}/risk-score?jobId=${encodeURIComponent(riskJob.jobId)}`)
    if (!polled.ok()) throw new Error(`Risk polling failed: ${polled.status()}`)
    const state = await polled.json()
    if (state.state === "failed") throw new Error("Saved-provider risk job failed")
    return state.state === "completed" && ["LOW", "MEDIUM", "HIGH"].includes(state.riskScore)
  }, { timeout: 90_000, intervals: [1000], message: "Saved-provider risk job must complete" }).toBe(true)
  const persistedRisk = await (await api.get(`/api/contracts/${contractId}/risk-score`)).json()
  if (!persistedRisk.riskScoredAt || !persistedRisk.riskDetails?.categories) throw new Error("Risk result was not persisted")
  console.log(JSON.stringify({ step: "saved_key_worker_risk", pass: true, limitation: "Workflow and persistence, not risk benchmark validation" }))
} finally {
  if (configured) {
    const removed = await api.delete("/api/org/ai-config")
    if (removed.status() !== 204) throw new Error(`Disposable credential cleanup status ${removed.status()}`)
    console.log("Disposable organization provider credential removed")
  }
  await api.dispose()
}
