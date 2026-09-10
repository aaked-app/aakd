import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import type { AgentProposalPreviewStore } from "../../lib/actions/agent-proposals.ts"
import type { ActionProposalPreviewInput } from "../../lib/actions/agent-proposal-schema.ts"
import type { RequestContext } from "../../lib/context.ts"

const proposalsLoaded = await import("../../lib/actions/agent-proposals.ts") as Record<string, unknown>
const proposals = (proposalsLoaded.AgentProposalError ? proposalsLoaded : proposalsLoaded.default) as typeof import("../../lib/actions/agent-proposals.ts")
const { AgentProposalError, previewActionApprovalRequest, previewActionProposal, submitActionApprovalRequest, submitActionProposal } = proposals
const sourceLoaded = await import("../../lib/contracts/source-binding.ts") as Record<string, unknown>
const { extractedTextHash, invalidateAgentActionsForSourceChange } = (sourceLoaded.extractedTextHash ? sourceLoaded : sourceLoaded.default) as typeof import("../../lib/contracts/source-binding.ts")
const contextLoaded = await import("../../lib/context.ts") as Record<string, unknown>
const { requestContext } = (contextLoaded.requestContext ? contextLoaded : contextLoaded.default) as typeof import("../../lib/context.ts")
const dbLoaded = await import("../../lib/db/client.ts") as Record<string, unknown>
const { prisma } = (dbLoaded.prisma ? dbLoaded : dbLoaded.default) as typeof import("../../lib/db/client.ts")

class MemoryPreviewStore implements AgentProposalPreviewStore {
  private readonly values = new Map<string, { value: string; expiresAt: number }>()

  async set(key: string, value: string, mode: "PXAT", expiresAt: number) {
    assert.equal(mode, "PXAT")
    this.values.set(key, { value, expiresAt })
  }

  async get(key: string) {
    const stored = this.values.get(key)
    if (!stored || Date.now() >= stored.expiresAt) {
      this.values.delete(key)
      return null
    }
    return stored.value
  }

  async del(key: string) {
    return this.values.delete(key) ? 1 : 0
  }
}

async function expectProposalError(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => error instanceof AgentProposalError && error.code === code)
}

async function main() {
  assert.equal(process.env.AAKD_AGENT_PROPOSAL_NATIVE_PROBE, "1", "Explicit opt-in required")
  const database = new URL(process.env.DATABASE_URL ?? "")
  assert.ok(["localhost", "127.0.0.1"].includes(database.hostname) && database.port === "5433", "Local PostgreSQL only")

  const suffix = randomUUID()
  const organizationId = `agent-probe-org-${suffix}`
  const authorId = `agent-probe-author-${suffix}`
  const reviewerId = `agent-probe-reviewer-${suffix}`
  const authorMemberId = `agent-probe-member-${suffix}`
  const reviewerMemberId = `agent-probe-reviewer-member-${suffix}`
  const apiKeyId = `agent-probe-key-${suffix}`
  const contractId = `agent-probe-contract-${suffix}`
  const fileId = `agent-probe-file-${suffix}`
  const fullText = "Service commitments\fThe supplier shall deliver the quarterly service report by October 1."
  const excerpt = "The supplier shall deliver the quarterly service report by October 1."
  const sourceHash = extractedTextHash(fullText)
  const store = new MemoryPreviewStore()
  const ctx: RequestContext = {
    userId: authorId,
    organizationId,
    memberId: authorMemberId,
    role: "member",
    source: "api_key",
    apiKeyId,
    scopes: ["read", "text_read", "action_propose"],
    requestId: `agent-probe-request-${suffix}`,
  }

  const proposalInput = (idempotencyKey = randomUUID(), title = "Deliver quarterly service report"): ActionProposalPreviewInput => ({
    contractId,
    kind: "OBLIGATION",
    title,
    dueDate: "2026-10-01T00:00:00.000Z",
    evidenceRequired: "delivery_receipt",
    source: { fileId, fileVersion: 1, page: 2, excerpt, excerptHash: extractedTextHash(excerpt) },
    idempotencyKey,
  })

  const run = <T>(context: RequestContext, operation: () => Promise<T>) => requestContext.run(context, operation)

  try {
    const now = new Date()
    await prisma.organization.create({ data: { id: organizationId, name: "Agent proposal probe", slug: organizationId, createdAt: now } })
    await prisma.user.createMany({ data: [
      { id: authorId, name: "Proposal author", email: `${authorId}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now },
      { id: reviewerId, name: "Proposal reviewer", email: `${reviewerId}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now },
    ] })
    await prisma.member.createMany({ data: [
      { id: authorMemberId, organizationId, userId: authorId, role: "member", createdAt: now },
      { id: reviewerMemberId, organizationId, userId: reviewerId, role: "member", createdAt: now },
    ] })
    await prisma.apiKey.create({ data: {
      id: apiKeyId,
      name: "Synthetic proposal key",
      keyHash: `synthetic-key-hash-${suffix}`,
      lookupHash: extractedTextHash(`synthetic-lookup-${suffix}`),
      prefix: "cf_live_synthetic",
      organizationId,
      createdById: authorId,
      scopes: ctx.scopes,
    } })
    await prisma.contract.create({ data: {
      id: contractId,
      title: "Synthetic service agreement",
      ownerId: authorId,
      organizationId,
      extractedText: fullText,
      extractedSourceFileId: fileId,
      extractedSourceFileVersion: 1,
      extractedSourceHash: sourceHash,
    } })
    await prisma.contractFile.create({ data: {
      id: fileId,
      contractId,
      filename: "synthetic.pdf",
      storageKey: `synthetic/${suffix}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      isLatest: true,
      version: 1,
      uploadedById: authorId,
    } })
    await prisma.contractAccessGrant.createMany({ data: [
      { organizationId, contractId, memberId: authorMemberId, grantedById: authorId },
      { organizationId, contractId, memberId: reviewerMemberId, grantedById: authorId },
    ] })

    const beforePreview = await prisma.contractAction.count({ where: { organizationId } })
    const principalIsolationInput = proposalInput()
    const isolatedPreview = await run(ctx, () => previewActionProposal(ctx, principalIsolationInput, store))
    assert.equal(await prisma.contractAction.count({ where: { organizationId } }), beforePreview)
    await expectProposalError(
      () => run({ ...ctx, apiKeyId: `different-${apiKeyId}` }, () => submitActionProposal(
        { ...ctx, apiKeyId: `different-${apiKeyId}` },
        { previewId: isolatedPreview.previewId, contractId, idempotencyKey: principalIsolationInput.idempotencyKey, sourceFileId: fileId, sourceFileVersion: 1, sourceHash },
        store,
      )),
      "proposal_not_found",
    )

    for (const revokedBoundary of ["grant", "key_scope", "member_role", "stale_source", "legacy_unbound"] as const) {
      const input = proposalInput()
      const preview = await run(ctx, () => previewActionProposal(ctx, input, store))
      if (revokedBoundary === "grant") await prisma.contractAccessGrant.delete({ where: { contractId_memberId: { contractId, memberId: authorMemberId } } })
      if (revokedBoundary === "key_scope") await prisma.apiKey.update({ where: { id: apiKeyId }, data: { scopes: ["read", "text_read"] } })
      if (revokedBoundary === "member_role") await prisma.member.update({ where: { id: authorMemberId }, data: { role: "viewer" } })
      if (revokedBoundary === "stale_source") await prisma.contract.update({ where: { id: contractId }, data: { extractedSourceHash: "b".repeat(64) } })
      if (revokedBoundary === "legacy_unbound") await prisma.contract.update({ where: { id: contractId }, data: { extractedSourceFileId: null, extractedSourceFileVersion: null, extractedSourceHash: null } })

      await expectProposalError(
        () => run(ctx, () => submitActionProposal(ctx, { previewId: preview.previewId, contractId, idempotencyKey: input.idempotencyKey, sourceFileId: fileId, sourceFileVersion: 1, sourceHash }, store)),
        revokedBoundary === "stale_source" || revokedBoundary === "legacy_unbound" ? "proposal_source_stale" : "proposal_not_found",
      )
      await prisma.contractAccessGrant.upsert({
        where: { contractId_memberId: { contractId, memberId: authorMemberId } },
        create: { organizationId, contractId, memberId: authorMemberId, grantedById: authorId },
        update: {},
      })
      await prisma.apiKey.update({ where: { id: apiKeyId }, data: { scopes: ctx.scopes } })
      await prisma.member.update({ where: { id: authorMemberId }, data: { role: "member" } })
      await prisma.contract.update({ where: { id: contractId }, data: { extractedSourceFileId: fileId, extractedSourceFileVersion: 1, extractedSourceHash: sourceHash } })
    }
    assert.equal(await prisma.contractAction.count({ where: { organizationId } }), beforePreview)

    const proposalIdempotencyKey = randomUUID()
    const proposal = proposalInput(proposalIdempotencyKey)
    const proposalPreview = await run(ctx, () => previewActionProposal(ctx, proposal, store))
    assert.equal(proposalPreview.sourceFreshness, "current")
    assert.equal(proposalPreview.policy, "human_review_required")
    assert.equal(proposalPreview.provenance.fileVersion, 1)
    assert.equal(proposalPreview.provenance.citationHash, extractedTextHash(excerpt))
    assert.notEqual(proposalPreview.provenance.citationHash, proposalPreview.sourceHash)
    assert.equal(JSON.stringify(proposalPreview).includes(proposalIdempotencyKey), false)
    const proposalSubmit = { previewId: proposalPreview.previewId, contractId, idempotencyKey: proposalIdempotencyKey, sourceFileId: fileId, sourceFileVersion: 1, sourceHash }
    const proposalResults = await Promise.all([
      run(ctx, () => submitActionProposal(ctx, proposalSubmit, store)),
      run(ctx, () => submitActionProposal(ctx, proposalSubmit, store)),
    ])
    assert.equal(new Set(proposalResults.map(result => result.action.id)).size, 1)
    assert.deepEqual(proposalResults.map(result => result.deduplicated).sort(), [false, true])
    assert.equal(proposalResults.every(result => result.sourceFreshness === "current"), true)
    assert.equal(proposalResults.every(result => result.disclosure.sensitivity === "not_classified"), true)
    const actionId = proposalResults[0].action.id
    const created = await prisma.contractAction.findUniqueOrThrow({ where: { id: actionId } })
    assert.equal(created.status, "PENDING_REVIEW")
    assert.equal(created.reviewStatus, "pending")
    assert.equal(created.assigneeId, null)
    assert.equal(created.sourceFileId, fileId)
    assert.equal(created.sourceFileVersion, 1)
    assert.equal(created.proposedByPrincipalId, apiKeyId)
    assert.equal(await prisma.activity.count({ where: { contractActionId: actionId } }), 1)
    const proposalAudit = await prisma.activity.findFirstOrThrow({ where: { contractActionId: actionId, action: "ACTION_PROPOSED" } })
    assert.deepEqual(Object.keys(proposalAudit.metadata as object).sort(), [
      "operation", "policy", "principalReferenceHash", "principalType", "proposalDigest", "requestIdempotencyHash", "sourceFileVersion", "sourceHash",
    ])
    assert.equal(JSON.stringify(proposalAudit.metadata).includes(apiKeyId), false)

    const changedPreview = await run(ctx, () => previewActionProposal(ctx, proposalInput(proposalIdempotencyKey, "Changed action intent"), store))
    await expectProposalError(
      () => run(ctx, () => submitActionProposal(ctx, { ...proposalSubmit, previewId: changedPreview.previewId }, store)),
      "proposal_idempotency_conflict",
    )
    await expectProposalError(
      () => run(ctx, () => previewActionApprovalRequest(ctx, { actionId, assignedToId: reviewerId, expectedVersion: created.version, idempotencyKey: randomUUID() }, store)),
      "action_not_ready_for_approval",
    )

    const reviewed = await prisma.contractAction.update({
      where: { id: actionId },
      data: { status: "PROPOSED", reviewStatus: "reviewed", version: { increment: 1 } },
    })
    await prisma.contractAction.update({ where: { id: actionId }, data: { sourceText: null } })
    await expectProposalError(
      () => run(ctx, () => previewActionApprovalRequest(ctx, {
        actionId,
        assignedToId: reviewerId,
        expectedVersion: reviewed.version,
        idempotencyKey: randomUUID(),
      }, store)),
      "proposal_source_stale",
    )
    await prisma.contractAction.update({ where: { id: actionId }, data: { sourceText: excerpt } })
    const approvalIdempotencyKey = randomUUID()
    const approvalInput = { actionId, assignedToId: reviewerId, expectedVersion: reviewed.version, comment: "Please verify this obligation.", idempotencyKey: approvalIdempotencyKey }
    const approvalPreview = await run(ctx, () => previewActionApprovalRequest(ctx, approvalInput, store))
    assert.equal(approvalPreview.sourceFreshness, "current")
    assert.equal(approvalPreview.provenance.sourcePage, 2)
    assert.equal(approvalPreview.provenance.citationHash, extractedTextHash(excerpt))
    assert.notEqual(approvalPreview.provenance.citationHash, sourceHash)
    assert.equal(JSON.stringify(approvalPreview).includes(approvalIdempotencyKey), false)
    const changedApprovalPreview = await run(ctx, () => previewActionApprovalRequest(ctx, { ...approvalInput, comment: "Changed request intent." }, store))

    await prisma.contractAccessGrant.delete({ where: { contractId_memberId: { contractId, memberId: reviewerMemberId } } })
    await expectProposalError(
      () => run(ctx, () => submitActionApprovalRequest(ctx, { previewId: approvalPreview.previewId, actionId, expectedVersion: reviewed.version, idempotencyKey: approvalIdempotencyKey }, store)),
      "action_recipient_access_required",
    )
    await prisma.contractAccessGrant.create({ data: { organizationId, contractId, memberId: reviewerMemberId, grantedById: authorId } })

    const approvalSubmit = { previewId: approvalPreview.previewId, actionId, expectedVersion: reviewed.version, idempotencyKey: approvalIdempotencyKey }
    const approvalResults = await Promise.all([
      run(ctx, () => submitActionApprovalRequest(ctx, approvalSubmit, store)),
      run(ctx, () => submitActionApprovalRequest(ctx, approvalSubmit, store)),
    ])
    assert.equal(new Set(approvalResults.map(result => result.approval.id)).size, 1)
    assert.deepEqual(approvalResults.map(result => result.deduplicated).sort(), [false, true])
    assert.equal(approvalResults.every(result => result.policy === "human_decision_required"), true)
    assert.equal(approvalResults.every(result => result.provenance.citationHash === extractedTextHash(excerpt)), true)
    assert.equal(await prisma.approval.count({ where: { actionId } }), 1)
    const approvalAudit = await prisma.activity.findFirstOrThrow({ where: { contractActionId: actionId, action: "APPROVAL_REQUESTED" } })
    assert.deepEqual(Object.keys(approvalAudit.metadata as object).sort(), [
      "approvalId", "expectedActionVersion", "operation", "policy", "principalReferenceHash", "principalType", "requestDigest", "requestIdempotencyHash", "resultingActionVersion", "reviewerReferenceHash", "sourceFileVersion",
    ])
    assert.equal(JSON.stringify(approvalAudit.metadata).includes(apiKeyId), false)
    assert.equal(JSON.stringify(approvalAudit.metadata).includes(reviewerId), false)

    await prisma.contractAccessGrant.delete({ where: { contractId_memberId: { contractId, memberId: reviewerMemberId } } })
    await expectProposalError(
      () => run(ctx, () => submitActionApprovalRequest(ctx, approvalSubmit, store)),
      "action_recipient_access_required",
    )
    await prisma.member.delete({ where: { id: reviewerMemberId } })
    await expectProposalError(
      () => run(ctx, () => submitActionApprovalRequest(ctx, approvalSubmit, store)),
      "action_recipient_access_required",
    )
    await prisma.member.create({ data: { id: reviewerMemberId, organizationId, userId: reviewerId, role: "member", createdAt: new Date() } })
    await prisma.contractAccessGrant.create({ data: { organizationId, contractId, memberId: reviewerMemberId, grantedById: authorId } })
    await expectProposalError(
      () => run(ctx, () => submitActionApprovalRequest(ctx, { ...approvalSubmit, previewId: changedApprovalPreview.previewId }, store)),
      "proposal_idempotency_conflict",
    )

    const currentAction = await prisma.contractAction.findUniqueOrThrow({ where: { id: actionId } })
    const revokedKeyIdempotency = randomUUID()
    const revokedKeyPreview = await run(ctx, () => previewActionApprovalRequest(ctx, { actionId, assignedToId: reviewerId, expectedVersion: currentAction.version, idempotencyKey: revokedKeyIdempotency }, store))
    await prisma.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } })
    await expectProposalError(
      () => run(ctx, () => submitActionApprovalRequest(ctx, { previewId: revokedKeyPreview.previewId, actionId, expectedVersion: currentAction.version, idempotencyKey: revokedKeyIdempotency }, store)),
      "proposal_not_found",
    )
    assert.equal(await prisma.approval.count({ where: { actionId } }), 1)

    const versionBeforeSourceChange = currentAction.version
    const reparsedText = `${fullText}\nParser correction.`
    await prisma.$transaction(async tx => {
      await tx.contract.update({
        where: { id: contractId },
        data: { extractedText: reparsedText, extractedSourceHash: extractedTextHash(reparsedText) },
      })
      await invalidateAgentActionsForSourceChange(tx, organizationId, contractId)
    })
    const staleAction = await prisma.contractAction.findUniqueOrThrow({ where: { id: actionId } })
    const pendingApproval = await prisma.approval.findFirstOrThrow({ where: { actionId } })
    assert.equal(staleAction.status, "STALE")
    assert.equal(staleAction.version, versionBeforeSourceChange + 1)
    assert.notEqual(pendingApproval.actionVersion, staleAction.version)

    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "1"
    await expectProposalError(() => run(ctx, () => previewActionProposal(ctx, proposalInput(), store)), "action_propose_forbidden")
    delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL

    console.log(JSON.stringify({
      checks: "PASS",
      previewNoMutation: "PASS",
      principalIsolation: "PASS",
      postPreviewAuthorization: "PASS",
      sourceFreshness: "PASS",
      concurrentProposalReplay: "PASS",
      humanReviewBoundary: "PASS",
      concurrentApprovalReplay: "PASS",
      pendingApprovalSourceInvalidation: "PASS",
      emergencyDenyAll: "PASS",
    }))
  } finally {
    delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { id: { in: [authorId, reviewerId] } } }).catch(() => undefined)
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error("Synthetic action-proposal concurrency probe failed", { type: error instanceof Error ? error.name : "UnknownError" })
  process.exitCode = 1
})
