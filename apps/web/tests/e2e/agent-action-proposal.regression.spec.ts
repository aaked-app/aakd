import { createHash, randomBytes, randomUUID } from "node:crypto"
import { expect, request, test, type APIRequestContext } from "@playwright/test"
import pg from "pg"
import { Queue } from "bullmq"
import { createTextPdf } from "./pdf-fixture"

test.skip(process.env.AAKD_AGENT_ACTION_HTTP_PROBE !== "1", "Opt-in acceptance probe requires the isolated local stack")

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

async function requireStatus(response: Awaited<ReturnType<APIRequestContext["get"]>>, expected: number, label: string) {
  if (response.status() !== expected) throw new Error(`${label}: expected ${expected}, received ${response.status()}`)
}

async function mcpCall(api: APIRequestContext, id: number, name: string, args: Record<string, unknown>) {
  const response = await api.post("/api/mcp", {
    data: { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
  })
  await requireStatus(response, 200, `MCP ${name}`)
  const envelope = await response.json() as {
    result?: { isError?: boolean; content?: Array<{ type?: string; text?: string }> }
  }
  const text = envelope.result?.content?.[0]?.text
  if (typeof text !== "string") throw new Error(`MCP ${name} returned no text result`)
  return { isError: envelope.result?.isError === true, text, data: envelope.result?.isError ? null : JSON.parse(text) as Record<string, unknown> }
}

test("MCP proposal reaches named human approval without crossing the human decision boundary", async ({ page, browser }, testInfo) => {
  test.slow()
  const baseURL = testInfo.project.use.baseURL
  const databaseUrl = process.env.DATABASE_URL
  if (!baseURL || !databaseUrl) throw new Error("Acceptance probe requires PLAYWRIGHT_BASE_URL and DATABASE_URL")
  const database = new URL(databaseUrl)
  const redisUrl = process.env.REDIS_URL
  if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
    || !["localhost", "127.0.0.1"].includes(database.hostname)
    || !redisUrl || !["localhost", "127.0.0.1"].includes(new URL(redisUrl).hostname)
    || !/^aakd_acceptance_[a-z0-9_]+$/.test(database.pathname.slice(1))) {
    throw new Error("Agent proposal acceptance is restricted to a named local acceptance database")
  }

  const suffix = randomBytes(8).toString("hex")
  const password = randomBytes(32).toString("base64url")
  const ownerEmail = `agent-owner-${suffix}@example.test`
  const reviewerEmail = `agent-reviewer-${suffix}@example.test`
  const sourceText = "Provider shall deliver the monthly service report by the fifth business day."
  const excerpt = "Provider shall deliver the monthly service report"
  const proposalIdempotencyKey = randomUUID()
  const approvalIdempotencyKey = randomUUID()
  const staleIdempotencyKey = randomUUID()

  const localAuthClientIp = testInfo.project.use.extraHTTPHeaders?.["X-Forwarded-For"]
  await page.context().setExtraHTTPHeaders({
    Origin: baseURL,
    ...(localAuthClientIp ? { "X-Forwarded-For": localAuthClientIp } : {}),
  })
  const reviewerContext = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, ...(localAuthClientIp ? { "X-Forwarded-For": localAuthClientIp } : {}) },
  })
  const sql = new pg.Client({ connectionString: databaseUrl })
  await sql.connect()
  const preparationQueue = new Queue("contract.extract", { connection: { url: redisUrl } })
  let organizationId: string | undefined
  let keyId: string | undefined
  let keyApi: APIRequestContext | undefined

  try {
    await requireStatus(await page.request.post("/api/auth/sign-up/email", {
      data: { name: "Agent Proposal Owner", email: ownerEmail, password },
    }), 200, "owner signup")
    const organization = await page.request.post("/api/auth/organization/create", {
      data: { name: `Agent proposal ${suffix}`, slug: `agent-proposal-${suffix}` },
    })
    await requireStatus(organization, 200, "organization creation")
    organizationId = (await organization.json() as { id: string }).id
    await requireStatus(await page.request.post("/api/auth/organization/set-active", {
      data: { organizationId },
    }), 200, "owner organization activation")

    await requireStatus(await reviewerContext.request.post("/api/auth/sign-up/email", {
      data: { name: "Named Human Reviewer", email: reviewerEmail, password },
    }), 200, "reviewer signup")
    const invitation = await page.request.post("/api/org/members/invite", {
      data: { email: reviewerEmail, role: "member" },
    })
    await requireStatus(invitation, 201, "reviewer invitation")
    const invitationId = (await invitation.json() as { id: string }).id
    const accepted = await reviewerContext.request.post(`/api/org/invitations/${invitationId}/accept`)
    await requireStatus(accepted, 200, "reviewer invitation acceptance")
    await requireStatus(await reviewerContext.request.post("/api/auth/organization/set-active", {
      data: { organizationId },
    }), 200, "reviewer organization activation")

    const identities = await sql.query<{ id: string; email: string }>(
      `SELECT id, email FROM "User" WHERE email = ANY($1::text[])`,
      [[ownerEmail, reviewerEmail]],
    )
    const ownerId = identities.rows.find(row => row.email === ownerEmail)?.id
    const reviewerId = identities.rows.find(row => row.email === reviewerEmail)?.id
    if (!ownerId || !reviewerId) throw new Error("Acceptance users were not persisted")
    const reviewerMember = await sql.query<{ id: string }>(
      `SELECT id FROM "Member" WHERE "organizationId"=$1 AND "userId"=$2`,
      [organizationId, reviewerId],
    )
    if (!reviewerMember.rows[0]?.id) throw new Error("Reviewer membership was not persisted")

    const contractResponse = await page.request.post("/api/contracts", {
      data: { title: `Agent source agreement ${suffix}` },
    })
    await requireStatus(contractResponse, 201, "contract creation")
    const contractId = (await contractResponse.json() as { id: string }).id
    const upload = await page.request.post(`/api/contracts/${contractId}/upload`, {
      multipart: { file: { name: "agent-source.pdf", mimeType: "application/pdf", buffer: createTextPdf([sourceText]) } },
    })
    await requireStatus(upload, 201, "source PDF upload")
    expect(await upload.json()).toMatchObject({ extractionQueued: true })
    let boundSource: { extractedText: string; fileId: string; fileVersion: number; sourceHash: string } | undefined
    await expect.poll(async () => {
      const result = await sql.query<{ extractedText: string | null; fileId: string | null; fileVersion: number | null; sourceHash: string | null }>(
        `SELECT "extractedText", "extractedSourceFileId" AS "fileId", "extractedSourceFileVersion" AS "fileVersion", "extractedSourceHash" AS "sourceHash" FROM "Contract" WHERE id=$1`,
        [contractId],
      )
      const row = result.rows[0]
      if (!row?.extractedText || !row.fileId || !row.fileVersion || !row.sourceHash) return false
      boundSource = { extractedText: row.extractedText, fileId: row.fileId, fileVersion: row.fileVersion, sourceHash: row.sourceHash }
      return row.extractedText.includes(excerpt) && row.sourceHash === sha256(row.extractedText)
    }, { timeout: 30_000, intervals: [250], message: "worker must bind extracted text to the uploaded PDF" }).toBe(true)
    if (!boundSource) throw new Error("Worker did not persist a canonical source binding")
    const { fileId: sourceFileId, fileVersion: sourceFileVersion, sourceHash } = boundSource
    const boundPages = boundSource.extractedText.split("\f")
    expect(boundPages).toHaveLength(2)
    expect(boundPages[0]).toContain(excerpt)
    expect(boundPages[1]).toBe("")

    // A completed BullMQ job can outlive extracted text after an interrupted
    // recovery. The actual Actions button must replace that terminal job.
    const file = await sql.query<{ storageKey: string }>(`SELECT "storageKey" FROM "ContractFile" WHERE id=$1 AND "contractId"=$2`, [sourceFileId, contractId])
    const preparationId = `contract-text-${sourceFileId}`
    await preparationQueue.add("extract", {
      contractId, organizationId, fileId: sourceFileId,
      storageKey: file.rows[0].storageKey, preserveUserFields: true,
    }, { jobId: preparationId, removeOnComplete: false })
    await expect.poll(async () => (await preparationQueue.getJob(preparationId))?.getState(), { timeout: 30_000 }).toBe("completed")
    await sql.query(`DELETE FROM "ContractObligationSuggestion" WHERE "contractId"=$1`, [contractId])
    await sql.query(`UPDATE "Contract" SET "extractedText"=NULL, "extractedSourceFileId"=NULL, "extractedSourceFileVersion"=NULL, "extractedSourceHash"=NULL WHERE id=$1`, [contractId])
    await page.goto(`/contracts/${contractId}`)
    const welcome = page.getByRole("dialog", { name: "Welcome to Aakd" })
    await welcome.getByRole("button", { name: "Skip", exact: true }).click()
    await expect(welcome).not.toBeVisible()
    await page.getByRole("tab", { name: /^Actions\b/ }).click()
    const prepared = page.waitForResponse(response => response.url().endsWith(`/api/contracts/${contractId}/obligations/extract`) && response.request().method() === "POST")
    await page.getByRole("button", { name: "Prepare document", exact: true }).click()
    expect((await prepared).status()).toBe(202)
    await expect(page.getByText(/Found \d+ suggestion/)).toBeVisible({ timeout: 60_000 })
    await expect.poll(async () => {
      const row = await sql.query(`SELECT "extractedSourceHash" FROM "Contract" WHERE id=$1`, [contractId])
      return row.rows[0]?.extractedSourceHash
    }).toBe(sourceHash)

    // Simulate an upgraded legacy row with text but no provenance, then prove
    // the public rerun route repairs it through the real file worker.
    await sql.query(
      `UPDATE "Contract" SET "extractedSourceFileId"=NULL, "extractedSourceFileVersion"=NULL, "extractedSourceHash"=NULL WHERE id=$1`,
      [contractId],
    )
    const reextract = await page.request.post(`/api/contracts/${contractId}/extractions/rerun`)
    await requireStatus(reextract, 202, "legacy source re-extraction")
    await expect.poll(async () => {
      const result = await sql.query<{ fileId: string | null; fileVersion: number | null; sourceHash: string | null }>(
        `SELECT "extractedSourceFileId" AS "fileId", "extractedSourceFileVersion" AS "fileVersion", "extractedSourceHash" AS "sourceHash" FROM "Contract" WHERE id=$1`,
        [contractId],
      )
      return result.rows[0]?.fileId === sourceFileId
        && result.rows[0]?.fileVersion === sourceFileVersion
        && result.rows[0]?.sourceHash === sourceHash
    }, { timeout: 30_000, intervals: [250], message: "rerun must restore the exact file source binding" }).toBe(true)
    await requireStatus(await page.request.post(`/api/contracts/${contractId}/access`, {
      data: { memberId: reviewerMember.rows[0].id },
    }), 201, "reviewer agreement grant")

    const keyResponse = await page.request.post("/api/org/api-keys", {
      data: { name: `Agent proposal acceptance ${suffix}`, scopes: ["read", "text_read", "action_propose"] },
    })
    await requireStatus(keyResponse, 201, "proposal key creation")
    const keyPayload = await keyResponse.json() as { rawKey?: string; apiKey?: { id?: string } }
    if (!keyPayload.rawKey || !keyPayload.apiKey?.id) throw new Error("Proposal key response was incomplete")
    keyId = keyPayload.apiKey.id
    keyApi = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL, Authorization: `Bearer ${keyPayload.rawKey}` },
    })

    const proposalIntent = {
      contractId,
      kind: "RENEWAL_NOTICE",
      title: "Deliver the monthly service report",
      description: "Track the recurring delivery commitment.",
      evidenceRequired: "completion_note",
      noticeDate: "2026-11-01T00:00:00.000Z",
      source: { fileId: sourceFileId, fileVersion: sourceFileVersion, page: null, excerpt, excerptHash: sha256(excerpt) },
      idempotencyKey: proposalIdempotencyKey,
    }
    const preview = await mcpCall(keyApi, 1, "preview_action_proposal", proposalIntent)
    expect(preview.isError).toBe(false)
    const previewId = preview.data?.previewId as string
    expect(preview.data).toMatchObject({
      policy: "human_review_required",
      sourceFreshness: "current",
      sourceHash,
      provenance: { principalType: "api_key", fileVersion: sourceFileVersion, sourcePage: 1, citationHash: sha256(excerpt) },
      disclosure: { sensitivity: "not_classified", sourceExcerptIncluded: true, rawPrincipalId: false, rawApiKey: false },
    })
    expect(JSON.stringify(preview.data)).not.toContain(proposalIdempotencyKey)
    const submitArgs = { previewId, contractId, idempotencyKey: proposalIdempotencyKey, sourceFileId, sourceFileVersion, sourceHash }
    const submitted = await mcpCall(keyApi, 2, "propose_action", submitArgs)
    const replayed = await mcpCall(keyApi, 3, "propose_action", submitArgs)
    expect(submitted.data).toMatchObject({ deduplicated: false })
    expect(replayed.data).toMatchObject({ deduplicated: true })
    const actionId = (submitted.data?.action as { id?: string })?.id
    if (!actionId) throw new Error("Proposal submission returned no action ID")

    await page.addInitScript(() => localStorage.setItem("cf_onboarding_done", "1"))
    await page.goto(`/actions/${actionId}`)
    await expect(page.getByText(/Proposed by an API agent: Agent proposal acceptance/)).toBeVisible()
    await expect(page.getByText("Source version 1", { exact: false })).toBeVisible()
    const reviewKind = page.getByLabel("Action type", { exact: true })
    await expect(reviewKind).toHaveValue("RENEWAL_NOTICE")
    await expect(page.getByLabel("Notice date", { exact: true })).toHaveValue("2026-11-01")
    const reviewCondition = page.getByLabel("Condition", { exact: true })
    const validateButton = page.getByRole("button", { name: "Review and validate" })
    await expect(validateButton).toBeDisabled()
    await reviewKind.selectOption("OBLIGATION")
    await expect(page.getByLabel("Notice date", { exact: true })).toHaveCount(0)
    await reviewCondition.fill("When the monthly reporting period closes")
    await expect(validateButton).toBeEnabled()
    const validation = page.waitForResponse(response => response.url().endsWith(`/api/actions/${actionId}`) && response.request().method() === "PATCH")
    await validateButton.click()
    expect((await validation).status()).toBe(200)
    await expect(page.getByText("Proposed", { exact: true }).first()).toBeVisible()

    const reviewedResponse = await page.request.get(`/api/actions/${actionId}`)
    await requireStatus(reviewedResponse, 200, "reviewed action read")
    const reviewedAction = await reviewedResponse.json() as { version: number; reviewStatus: string }
    expect(reviewedAction.reviewStatus).toBe("reviewed")
    const approvalIntent = {
      actionId,
      assignedToId: reviewerId,
      expectedVersion: reviewedAction.version,
      comment: "Please make the final human decision.",
      idempotencyKey: approvalIdempotencyKey,
    }
    const approvalPreview = await mcpCall(keyApi, 4, "preview_action_approval_request", approvalIntent)
    expect(approvalPreview.data).toMatchObject({
      policy: "human_decision_required",
      sourceFreshness: "current",
      provenance: { principalType: "api_key", fileVersion: sourceFileVersion, citationHash: sha256(excerpt) },
      disclosure: { sensitivity: "not_classified", sourceExcerptIncluded: false, rawPrincipalId: false, rawApiKey: false },
    })
    expect(JSON.stringify(approvalPreview.data)).not.toContain(approvalIdempotencyKey)
    const approvalArgs = { previewId: approvalPreview.data?.previewId, actionId, expectedVersion: reviewedAction.version, idempotencyKey: approvalIdempotencyKey }
    const approvalSubmitted = await mcpCall(keyApi, 5, "request_action_approval", approvalArgs)
    const approvalReplay = await mcpCall(keyApi, 6, "request_action_approval", approvalArgs)
    expect(approvalSubmitted.data).toMatchObject({ deduplicated: false })
    expect(approvalReplay.data).toMatchObject({ deduplicated: true })

    const reviewerPage = await reviewerContext.newPage()
    await reviewerPage.addInitScript(() => localStorage.setItem("cf_onboarding_done", "1"))
    await reviewerPage.goto(`/contracts/${contractId}`)
    await reviewerPage.getByRole("tab", { name: "Approvals" }).click()
    await expect(reviewerPage.getByText("Named Human Reviewer", { exact: true }).first()).toBeVisible()
    await reviewerPage.getByRole("button", { name: "Approve", exact: true }).click()
    const decision = reviewerPage.waitForResponse(response => response.url().includes("/approvals/") && response.request().method() === "PATCH")
    await reviewerPage.getByRole("button", { name: "Confirm Approve", exact: true }).click()
    expect((await decision).status()).toBe(200)
    await expect(reviewerPage.getByText("Approved", { exact: true }).first()).toBeVisible()

    const durable = await sql.query<{ action_status: string; action_kind: string; notice_date: Date | null; approval_status: string; actions: number; approvals: number }>(
      `SELECT a.status AS action_status, a.kind AS action_kind, a."noticeDate" AS notice_date, p.status AS approval_status,
        (SELECT COUNT(*)::int FROM "ContractAction" WHERE "contractId"=$1) AS actions,
        (SELECT COUNT(*)::int FROM "Approval" WHERE "actionId"=$2) AS approvals
       FROM "ContractAction" a JOIN "Approval" p ON p."actionId"=a.id WHERE a.id=$2`,
      [contractId, actionId],
    )
    expect(durable.rows[0]).toMatchObject({ action_kind: "OBLIGATION", notice_date: null, approval_status: "approved", actions: 1, approvals: 1 })

    const staleIntent = { ...proposalIntent, title: "Second source-bound proposal", idempotencyKey: staleIdempotencyKey }
    const stalePreview = await mcpCall(keyApi, 7, "preview_action_proposal", staleIntent)
    expect(stalePreview.isError).toBe(false)
    const replacementUpload = await page.request.post(`/api/contracts/${contractId}/upload`, {
      multipart: { file: { name: "replacement-source.pdf", mimeType: "application/pdf", buffer: createTextPdf(["A replacement agreement source."]) } },
    })
    await requireStatus(replacementUpload, 201, "source-changing replacement upload")
    const replacementFile = await replacementUpload.json() as { id: string; version: number; extractionQueued: boolean }
    expect(replacementFile.extractionQueued).toBe(true)
    const staleSubmit = await mcpCall(keyApi, 8, "propose_action", {
      previewId: stalePreview.data?.previewId,
      contractId,
      idempotencyKey: staleIdempotencyKey,
      sourceFileId,
      sourceFileVersion,
      sourceHash,
    })
    expect(staleSubmit.isError).toBe(true)
    expect(staleSubmit.text).toContain("proposal_source_stale")
    const finalCounts = await sql.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM "ContractAction" WHERE "contractId"=$1`, [contractId])
    expect(finalCounts.rows[0].count).toBe(1)
    await expect.poll(async () => {
      const result = await sql.query<{ fileId: string | null; fileVersion: number | null; sourceHash: string | null; extractedText: string | null }>(
        `SELECT "extractedSourceFileId" AS "fileId", "extractedSourceFileVersion" AS "fileVersion", "extractedSourceHash" AS "sourceHash", "extractedText" FROM "Contract" WHERE id=$1`,
        [contractId],
      )
      const row = result.rows[0]
      return row?.fileId === replacementFile.id
        && row.fileVersion === replacementFile.version
        && typeof row.extractedText === "string"
        && row.sourceHash === sha256(row.extractedText)
    }, { timeout: 30_000, intervals: [250], message: "replacement extraction must reach a durable, quiescent source binding" }).toBe(true)

    await testInfo.attach("named-human-agent-action-approval", {
      body: await reviewerPage.screenshot({ fullPage: true }),
      contentType: "image/png",
    })
  } finally {
    await preparationQueue.close()
    if (keyApi) await keyApi.dispose()
    if (keyId) await page.request.delete(`/api/org/api-keys/${keyId}`).catch(() => undefined)
    await reviewerContext.close()
    if (organizationId) await sql.query(`DELETE FROM "Organization" WHERE id=$1`, [organizationId]).catch(() => undefined)
    await sql.query(`DELETE FROM "User" WHERE email = ANY($1::text[])`, [[ownerEmail, reviewerEmail]]).catch(() => undefined)
    await sql.end()
  }
})
