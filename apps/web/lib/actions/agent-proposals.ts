import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"

import { verifyCitation } from "@/lib/ai/verified-citation"
import { agreementRelationWhere, isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import {
  actionProposalPrincipal,
  canProposeWithSourceText,
  lockCurrentActionProposalPermission,
} from "@/lib/auth/action-propose"
import type { RequestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { withTransactionRetry } from "@/lib/db/transaction-retry"
import { INTERACTIVE_AI_TTL_MS } from "@/lib/jobs/interactive-ai"
import { extractedTextHash, hasCurrentAgentActionSource, hasExactExtractedSourceBinding } from "@/lib/contracts/source-binding"
import {
  actionApprovalRequestDigest,
  actionProposalDigest,
  actionProposalIdempotencyHash,
  ActionApprovalRequestPreviewInputSchema,
  ActionProposalPreviewInputSchema,
  type ActionApprovalRequestPreviewInput,
  type ActionApprovalRequestSubmitInput,
  type ActionProposalPreviewInput,
  type ActionProposalSubmitInput,
} from "@/lib/actions/agent-proposal-schema"

export class AgentProposalError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = "AgentProposalError"
  }
}

export interface AgentProposalPreviewStore {
  set(key: string, value: string, mode: "PXAT", expiresAt: number): Promise<unknown>
  get(key: string): Promise<string | null>
  del(key: string): Promise<unknown>
}

const PrincipalSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  memberId: z.string(),
  source: z.enum(["session", "api_key"]),
  apiKeyId: z.string().nullable(),
}).strict()

const ProposalPreviewRecordSchema = z.object({
  kind: z.literal("action_proposal"),
  previewId: z.string().uuid(),
  principal: PrincipalSchema,
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyHash: z.string().regex(/^[0-9a-f]{64}$/),
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
  input: ActionProposalPreviewInputSchema,
}).strict()

const ApprovalPreviewRecordSchema = z.object({
  kind: z.literal("approval_request"),
  previewId: z.string().uuid(),
  principal: PrincipalSchema,
  contractId: z.string(),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyHash: z.string().regex(/^[0-9a-f]{64}$/),
  input: ActionApprovalRequestPreviewInputSchema,
}).strict()

type ProposalPreviewRecord = z.infer<typeof ProposalPreviewRecordSchema> & { input: ActionProposalPreviewInput }
type ApprovalPreviewRecord = z.infer<typeof ApprovalPreviewRecordSchema> & { input: ActionApprovalRequestPreviewInput }

function principalSnapshot(ctx: RequestContext) {
  if (!ctx.memberId) throw new AgentProposalError("action_propose_forbidden")
  return {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    memberId: ctx.memberId,
    source: ctx.source,
    apiKeyId: ctx.apiKeyId ?? null,
  }
}

function opaqueReference(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function publicProposalIntent(input: ActionProposalPreviewInput) {
  const { idempotencyKey: _idempotencyKey, ...intent } = input
  return intent
}

function previewKey(ctx: RequestContext, previewId: string): string {
  return `aakd:agent-action-preview:${encodeURIComponent(ctx.organizationId)}:${encodeURIComponent(ctx.memberId ?? "denied")}:${encodeURIComponent(ctx.source)}:${encodeURIComponent(ctx.apiKeyId ?? "session")}:${encodeURIComponent(previewId)}`
}

function principalMatches(record: { principal: z.infer<typeof PrincipalSchema> }, ctx: RequestContext): boolean {
  return record.principal.organizationId === ctx.organizationId
    && record.principal.userId === ctx.userId
    && record.principal.memberId === ctx.memberId
    && record.principal.source === ctx.source
    && record.principal.apiKeyId === (ctx.apiKeyId ?? null)
}

async function storePreview(store: AgentProposalPreviewStore, ctx: RequestContext, record: ProposalPreviewRecord | ApprovalPreviewRecord) {
  await store.set(previewKey(ctx, record.previewId), JSON.stringify(record), "PXAT", record.expiresAt)
}

async function readPreview<T extends ProposalPreviewRecord | ApprovalPreviewRecord>(
  store: AgentProposalPreviewStore,
  ctx: RequestContext,
  previewId: string,
  schema: typeof ProposalPreviewRecordSchema | typeof ApprovalPreviewRecordSchema,
): Promise<T> {
  const key = previewKey(ctx, previewId)
  if (isAgreementAccessEmergencyDenyAll()) {
    await store.del(key).catch(() => {})
    throw new AgentProposalError("proposal_not_found")
  }
  const raw = await store.get(key)
  if (!raw) throw new AgentProposalError("proposal_not_found")
  let parsed: z.infer<typeof schema>
  try {
    parsed = schema.parse(JSON.parse(raw))
  } catch {
    await store.del(key).catch(() => {})
    throw new AgentProposalError("proposal_not_found")
  }
  if (!principalMatches(parsed, ctx)) throw new AgentProposalError("proposal_not_found")
  if (Date.now() >= parsed.expiresAt) {
    await store.del(key).catch(() => {})
    throw new AgentProposalError("proposal_expired")
  }
  return parsed as T
}

function requireProposalContext(ctx: RequestContext) {
  if (!canProposeWithSourceText(ctx) || !actionProposalPrincipal(ctx) || isAgreementAccessEmergencyDenyAll()) {
    throw new AgentProposalError("action_propose_forbidden")
  }
}

async function reviewerHasAccess(organizationId: string, contractId: string, userId: string) {
  return prisma.member.findFirst({
    where: {
      organizationId,
      userId,
      accessGrants: { some: { organizationId, contractId } },
    },
    select: { userId: true, role: true },
  })
}

export async function previewActionProposal(
  ctx: RequestContext,
  input: ActionProposalPreviewInput,
  store: AgentProposalPreviewStore,
) {
  requireProposalContext(ctx)
  if (extractedTextHash(input.source.excerpt) !== input.source.excerptHash) {
    throw new AgentProposalError("proposal_source_mismatch")
  }
  const contract = await prisma.contract.findFirst({
    where: { id: input.contractId, organizationId: ctx.organizationId, ...agreementRelationWhere(ctx) },
    select: {
      id: true,
      extractedText: true,
      extractedSourceFileId: true,
      extractedSourceFileVersion: true,
      extractedSourceHash: true,
      files: { where: { id: input.source.fileId, isLatest: true }, select: { id: true, version: true }, take: 1 },
    },
  })
  const file = contract?.files[0]
  if (!contract || !file) throw new AgentProposalError("proposal_source_unavailable")
  if (!hasExactExtractedSourceBinding(contract, file)
    || file.id !== input.source.fileId
    || file.version !== input.source.fileVersion) {
    throw new AgentProposalError("proposal_source_stale")
  }
  const citation = verifyCitation(contract.extractedText!, input.source.excerpt)
  if (!citation || (input.source.page != null && input.source.page !== citation.sourcePage)) {
    throw new AgentProposalError("proposal_source_mismatch")
  }
  const previewId = randomUUID()
  const createdAt = Date.now()
  const digest = actionProposalDigest(input)
  const record: ProposalPreviewRecord = {
    kind: "action_proposal",
    previewId,
    principal: principalSnapshot(ctx),
    createdAt,
    expiresAt: createdAt + INTERACTIVE_AI_TTL_MS,
    digest,
    idempotencyHash: actionProposalIdempotencyHash(input.idempotencyKey),
    sourceHash: contract.extractedSourceHash!,
    input: { ...input, source: { ...input.source, page: citation.sourcePage } },
  }
  await storePreview(store, ctx, record)
  const proposalPrincipal = actionProposalPrincipal(ctx)!
  return {
    previewId,
    digest,
    expiresAt: record.expiresAt,
    policy: "human_review_required" as const,
    proposal: publicProposalIntent(record.input),
    sourceHash: record.sourceHash,
    sourceFreshness: "current" as const,
    provenance: {
      principalType: proposalPrincipal.type,
      principalReference: opaqueReference(proposalPrincipal.id),
      fileVersion: record.input.source.fileVersion,
      sourcePage: record.input.source.page ?? null,
      citationHash: record.input.source.excerptHash,
    },
    disclosure: { sensitivity: "not_classified" as const, sourceExcerptIncluded: true, rawPrincipalId: false, rawApiKey: false },
  }
}

export async function submitActionProposal(
  ctx: RequestContext,
  input: ActionProposalSubmitInput,
  store: AgentProposalPreviewStore,
) {
  requireProposalContext(ctx)
  const record = await readPreview<ProposalPreviewRecord>(store, ctx, input.previewId, ProposalPreviewRecordSchema)
  if (record.kind !== "action_proposal"
    || record.input.contractId !== input.contractId
    || record.input.idempotencyKey !== input.idempotencyKey
    || record.input.source.fileId !== input.sourceFileId
    || record.input.source.fileVersion !== input.sourceFileVersion
    || record.sourceHash !== input.sourceHash) {
    throw new AgentProposalError("proposal_preview_conflict")
  }
  const principal = actionProposalPrincipal(ctx)!
  const sourceKey = `agent:${principal.type}:${principal.id}:${record.idempotencyHash}`

  return withTransactionRetry(() => prisma.$transaction(async tx => {
    if (!(await lockCurrentActionProposalPermission(tx, ctx, input.contractId))) {
      throw new AgentProposalError("proposal_not_found")
    }
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, organizationId: ctx.organizationId, ...agreementRelationWhere(ctx) },
      select: {
        extractedText: true,
        extractedSourceFileId: true,
        extractedSourceFileVersion: true,
        extractedSourceHash: true,
        files: { where: { id: input.sourceFileId, isLatest: true }, select: { id: true, version: true }, take: 1 },
      },
    })
    const file = contract?.files[0]
    if (!contract || !file || !hasExactExtractedSourceBinding(contract, file)
      || contract.extractedSourceHash !== record.sourceHash
      || !verifyCitation(contract.extractedText!, record.input.source.excerpt)) {
      throw new AgentProposalError("proposal_source_stale")
    }
    const existing = await tx.contractAction.findUnique({
      where: { organizationId_sourceKey: { organizationId: ctx.organizationId, sourceKey } },
      select: { id: true, contractId: true, proposalDigest: true, status: true, version: true },
    })
    if (existing) {
      if (existing.contractId !== input.contractId || existing.proposalDigest !== record.digest) {
        throw new AgentProposalError("proposal_idempotency_conflict")
      }
      return {
        action: existing,
        deduplicated: true,
        policy: "human_review_required" as const,
        sourceFreshness: "current" as const,
        provenance: {
          principalType: principal.type,
          principalReference: opaqueReference(principal.id),
          fileVersion: record.input.source.fileVersion,
          sourcePage: record.input.source.page ?? null,
          citationHash: record.input.source.excerptHash,
        },
        disclosure: { sensitivity: "not_classified" as const, sourceExcerptIncluded: false, rawPrincipalId: false, rawApiKey: false },
      }
    }
    const action = await tx.contractAction.create({
      data: {
        organizationId: ctx.organizationId,
        contractId: input.contractId,
        sourceKey,
        kind: record.input.kind,
        title: record.input.title,
        description: record.input.description ?? null,
        condition: record.input.condition ?? null,
        dueDate: record.input.dueDate ? new Date(record.input.dueDate) : null,
        noticeDate: record.input.noticeDate ? new Date(record.input.noticeDate) : null,
        assigneeId: null,
        sourceText: record.input.source.excerpt,
        sourcePage: record.input.source.page ?? null,
        sourceHash: record.sourceHash,
        sourceFileId: record.input.source.fileId,
        sourceFileVersion: record.input.source.fileVersion,
        proposedByPrincipalType: principal.type,
        proposedByPrincipalId: principal.id,
        proposalDigest: record.digest,
        reviewStatus: "pending",
        status: "PENDING_REVIEW",
        evidenceRequired: record.input.evidenceRequired ?? null,
        createdById: ctx.userId,
      },
      select: { id: true, contractId: true, proposalDigest: true, status: true, version: true },
    })
    await tx.activity.create({
      data: {
        contractId: input.contractId,
        contractActionId: action.id,
        userId: ctx.userId,
        actorLabel: ctx.source === "api_key" ? "Agent API key" : "Agent proposal",
        action: "ACTION_PROPOSED",
        detail: "Agent action submitted for human review",
        metadata: {
          operation: "propose_action",
          policy: "human_review_required",
          principalType: principal.type,
          principalReferenceHash: opaqueReference(principal.id),
          requestIdempotencyHash: record.idempotencyHash,
          proposalDigest: record.digest,
          sourceFileVersion: record.input.source.fileVersion,
          sourceHash: record.sourceHash,
        },
      },
    })
    return {
      action,
      deduplicated: false,
      policy: "human_review_required" as const,
      sourceFreshness: "current" as const,
      provenance: {
        principalType: principal.type,
        principalReference: opaqueReference(principal.id),
        fileVersion: record.input.source.fileVersion,
        sourcePage: record.input.source.page ?? null,
        citationHash: record.input.source.excerptHash,
      },
      disclosure: { sensitivity: "not_classified" as const, sourceExcerptIncluded: false, rawPrincipalId: false, rawApiKey: false },
    }
  }, { isolationLevel: "Serializable" }))
}

export async function previewActionApprovalRequest(
  ctx: RequestContext,
  input: ActionApprovalRequestPreviewInput,
  store: AgentProposalPreviewStore,
) {
  requireProposalContext(ctx)
  const action = await prisma.contractAction.findFirst({
    where: { id: input.actionId, organizationId: ctx.organizationId, contract: agreementRelationWhere(ctx) },
    select: {
      id: true, contractId: true, title: true, status: true, reviewStatus: true, version: true,
      proposedByPrincipalType: true, sourceFileId: true, sourceFileVersion: true, sourceHash: true, sourceText: true, sourcePage: true,
      contract: {
        select: {
          extractedText: true, extractedSourceFileId: true, extractedSourceFileVersion: true, extractedSourceHash: true,
          files: { where: { isLatest: true }, select: { id: true, version: true }, take: 1 },
        },
      },
    },
  })
  if (!action) throw new AgentProposalError("proposal_not_found")
  if (!hasCurrentAgentActionSource(action, action.contract, action.contract.files[0])) throw new AgentProposalError("proposal_source_stale")
  if (!action.sourceText) throw new AgentProposalError("proposal_source_stale")
  if (action.status !== "PROPOSED" || action.reviewStatus !== "reviewed") throw new AgentProposalError("action_not_ready_for_approval")
  if (action.version !== input.expectedVersion) throw new AgentProposalError("action_version_conflict")
  const reviewer = await reviewerHasAccess(ctx.organizationId, action.contractId, input.assignedToId)
  if (!reviewer) throw new AgentProposalError("action_recipient_access_required")

  const previewId = randomUUID()
  const createdAt = Date.now()
  const digest = actionApprovalRequestDigest(input)
  const record: ApprovalPreviewRecord = {
    kind: "approval_request",
    previewId,
    principal: principalSnapshot(ctx),
    contractId: action.contractId,
    createdAt,
    expiresAt: createdAt + INTERACTIVE_AI_TTL_MS,
    digest,
    idempotencyHash: actionProposalIdempotencyHash(input.idempotencyKey),
    input,
  }
  await storePreview(store, ctx, record)
  const proposalPrincipal = actionProposalPrincipal(ctx)!
  return {
    previewId,
    digest,
    expiresAt: record.expiresAt,
    policy: "human_decision_required" as const,
    sourceFreshness: "current" as const,
    action: { id: action.id, contractId: action.contractId, title: action.title, status: action.status, reviewStatus: action.reviewStatus, version: action.version },
    reviewer: { reference: opaqueReference(reviewer.userId) },
    provenance: {
      principalType: proposalPrincipal.type,
      principalReference: opaqueReference(proposalPrincipal.id),
      fileVersion: action.sourceFileVersion,
      sourcePage: action.sourcePage,
      citationHash: extractedTextHash(action.sourceText),
    },
    disclosure: { sensitivity: "not_classified" as const, sourceExcerptIncluded: false, rawPrincipalId: false, rawApiKey: false },
  }
}

export async function submitActionApprovalRequest(
  ctx: RequestContext,
  input: ActionApprovalRequestSubmitInput,
  store: AgentProposalPreviewStore,
) {
  requireProposalContext(ctx)
  const record = await readPreview<ApprovalPreviewRecord>(store, ctx, input.previewId, ApprovalPreviewRecordSchema)
  if (record.kind !== "approval_request" || record.input.actionId !== input.actionId
    || record.input.expectedVersion !== input.expectedVersion || record.input.idempotencyKey !== input.idempotencyKey) {
    throw new AgentProposalError("proposal_preview_conflict")
  }
  const principal = actionProposalPrincipal(ctx)!

  return withTransactionRetry(() => prisma.$transaction(async tx => {
    const initialAction = await tx.contractAction.findFirst({
      where: { id: input.actionId, organizationId: ctx.organizationId, contract: agreementRelationWhere(ctx) },
      select: { contractId: true },
    })
    if (!initialAction || !(await lockCurrentActionProposalPermission(tx, ctx, initialAction.contractId))) {
      throw new AgentProposalError("proposal_not_found")
    }
    const action = await tx.contractAction.findFirst({
      where: { id: input.actionId, organizationId: ctx.organizationId, contract: agreementRelationWhere(ctx) },
      select: {
        id: true, contractId: true, title: true, status: true, reviewStatus: true, version: true,
        proposedByPrincipalType: true, sourceFileId: true, sourceFileVersion: true, sourceHash: true, sourceText: true, sourcePage: true,
        contract: {
          select: {
            extractedText: true, extractedSourceFileId: true, extractedSourceFileVersion: true, extractedSourceHash: true,
            files: { where: { isLatest: true }, select: { id: true, version: true }, take: 1 },
          },
        },
      },
    })
    if (!action) throw new AgentProposalError("proposal_not_found")
    if (!hasCurrentAgentActionSource(action, action.contract, action.contract.files[0])) throw new AgentProposalError("proposal_source_stale")
    if (!action.sourceText) throw new AgentProposalError("proposal_source_stale")
    const reviewer = await tx.member.findFirst({
      where: { organizationId: ctx.organizationId, userId: record.input.assignedToId, accessGrants: { some: { organizationId: ctx.organizationId, contractId: action.contractId } } },
      select: { userId: true },
    })
    if (!reviewer) throw new AgentProposalError("action_recipient_access_required")
    const existing = await tx.approval.findUnique({
      where: {
        contractId_requestPrincipalType_requestPrincipalId_requestIdempotencyHash: {
          contractId: action.contractId,
          requestPrincipalType: principal.type,
          requestPrincipalId: principal.id,
          requestIdempotencyHash: record.idempotencyHash,
        },
      },
      select: { id: true, actionId: true, actionVersion: true, assignedToId: true, status: true, requestDigest: true },
    })
    if (existing) {
      if (existing.actionId !== input.actionId || existing.requestDigest !== record.digest) {
        throw new AgentProposalError("proposal_idempotency_conflict")
      }
      return {
        approval: { id: existing.id, actionId: existing.actionId, actionVersion: existing.actionVersion, assignedToId: existing.assignedToId, status: existing.status },
        deduplicated: true,
        policy: "human_decision_required" as const,
        sourceFreshness: "current" as const,
        provenance: {
          principalType: principal.type,
          principalReference: opaqueReference(principal.id),
          fileVersion: action.sourceFileVersion,
          sourcePage: action.sourcePage,
          citationHash: extractedTextHash(action.sourceText),
        },
        disclosure: { sensitivity: "not_classified" as const, sourceExcerptIncluded: false, rawPrincipalId: false, rawApiKey: false },
      }
    }
    if (action.status !== "PROPOSED" || action.reviewStatus !== "reviewed") throw new AgentProposalError("action_not_ready_for_approval")
    if (action.version !== input.expectedVersion) throw new AgentProposalError("action_version_conflict")
    const bumped = await tx.contractAction.updateMany({
      where: { id: action.id, organizationId: ctx.organizationId, status: "PROPOSED", version: input.expectedVersion, contract: agreementRelationWhere(ctx) },
      data: { version: { increment: 1 } },
    })
    if (bumped.count !== 1) throw new AgentProposalError("action_version_conflict")
    const approval = await tx.approval.create({
      data: {
        contractId: action.contractId,
        actionId: action.id,
        actionVersion: input.expectedVersion + 1,
        requestedById: ctx.userId,
        assignedToId: record.input.assignedToId,
        status: "pending",
        required: true,
        comment: record.input.comment ?? null,
        requestPrincipalType: principal.type,
        requestPrincipalId: principal.id,
        requestIdempotencyHash: record.idempotencyHash,
        requestDigest: record.digest,
      },
      select: { id: true, actionId: true, actionVersion: true, assignedToId: true, status: true, requestDigest: true },
    })
    await tx.activity.create({
      data: {
        contractId: action.contractId,
        contractActionId: action.id,
        userId: ctx.userId,
        actorLabel: ctx.source === "api_key" ? "Agent API key" : "Agent proposal",
        action: "APPROVAL_REQUESTED",
        detail: `Approval requested for action: ${action.title}`,
        metadata: {
          operation: "request_action_approval",
          policy: "human_decision_required",
          principalType: principal.type,
          principalReferenceHash: opaqueReference(principal.id),
          reviewerReferenceHash: opaqueReference(record.input.assignedToId),
          requestIdempotencyHash: record.idempotencyHash,
          requestDigest: record.digest,
          sourceFileVersion: action.sourceFileVersion,
          expectedActionVersion: input.expectedVersion,
          resultingActionVersion: input.expectedVersion + 1,
          approvalId: approval.id,
        },
      },
    })
    return {
      approval: { id: approval.id, actionId: approval.actionId, actionVersion: approval.actionVersion, assignedToId: approval.assignedToId, status: approval.status },
      deduplicated: false,
      policy: "human_decision_required" as const,
      sourceFreshness: "current" as const,
      provenance: {
        principalType: principal.type,
        principalReference: opaqueReference(principal.id),
        fileVersion: action.sourceFileVersion,
        sourcePage: action.sourcePage,
        citationHash: extractedTextHash(action.sourceText),
      },
      disclosure: { sensitivity: "not_classified" as const, sourceExcerptIncluded: false, rawPrincipalId: false, rawApiKey: false },
    }
  }, { isolationLevel: "Serializable" }))
}
