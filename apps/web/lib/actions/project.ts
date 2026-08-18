import { createHash } from "node:crypto"
import { prisma } from "@/lib/db/client"
import type { ContractActionStatus, Prisma } from "@prisma/client"

export type ObligationActionProjection = {
  id: string
  contractId: string
  organizationId: string
  title: string
  description?: string | null
  clauseReference?: string | null
  dueDate: Date
  assigneeId?: string | null
  createdById?: string | null
  sourceHash?: string | null
  sourceText?: string | null
  sourcePage?: number | null
  confidence?: number | null
  evidenceRequired?: "completion_note" | "external_link"
}

/**
 * Materializes the user-facing Phase 1 action for an existing obligation.
 * The source key makes retries and repeated imports idempotent. Existing
 * action state is intentionally preserved once a user has acknowledged or
 * completed it; projection refreshes only source-derived fields.
 */
async function projectObligationActionWithDb(
  input: ObligationActionProjection,
  db: Pick<Prisma.TransactionClient, "contractAction">,
) {
  const existing = await db.contractAction.findUnique({
      where: {
        organizationId_sourceKey: {
          organizationId: input.organizationId,
          sourceKey: `obligation:${input.id}`,
        },
      },
      select: { sourceHash: true, status: true },
    })
  const sourceChanged = Boolean(existing && existing.sourceHash !== (input.sourceHash ?? null))

  return db.contractAction.upsert({
      where: {
        organizationId_sourceKey: {
          organizationId: input.organizationId,
          sourceKey: `obligation:${input.id}`,
        },
      },
      create: {
        organizationId: input.organizationId,
        contractId: input.contractId,
        sourceObligationId: input.id,
        sourceKey: `obligation:${input.id}`,
        kind: "OBLIGATION",
        title: input.title,
        description: input.description ?? undefined,
        condition: input.clauseReference ?? undefined,
        dueDate: input.dueDate,
        assigneeId: input.assigneeId ?? undefined,
        sourceHash: input.sourceHash ?? undefined,
        sourceText: input.sourceText ?? undefined,
        sourcePage: input.sourcePage ?? undefined,
        confidence: input.confidence ?? undefined,
        reviewStatus: "reviewed",
        status: "PROPOSED" satisfies ContractActionStatus,
        evidenceRequired: input.evidenceRequired ?? "completion_note",
        createdById: input.createdById ?? undefined,
      },
      update: {
        title: input.title,
        description: input.description ?? null,
        condition: input.clauseReference ?? null,
        dueDate: input.dueDate,
        assigneeId: input.assigneeId ?? null,
        sourceHash: input.sourceHash ?? null,
        sourceText: input.sourceText ?? null,
        sourcePage: input.sourcePage ?? null,
        confidence: input.confidence ?? null,
        evidenceRequired: input.evidenceRequired ?? "completion_note",
        ...(sourceChanged ? { status: "STALE", staleAt: new Date(), version: { increment: 1 } } : {}),
      },
  })
}

export async function projectObligationAction(
  input: ObligationActionProjection,
  transaction?: Pick<Prisma.TransactionClient, "contractAction">,
) {
  if (transaction) return projectObligationActionWithDb(input, transaction)
  return prisma.$transaction((tx) => projectObligationActionWithDb(input, tx))
}

/** Backfills the action ledger for obligations created before Phase 1. */
export async function projectObligationActions(organizationId: string) {
  return prisma.$transaction(async (tx) => {
  const obligations = await tx.contractObligation.findMany({
    where: { organizationId },
    select: {
      id: true,
      contractId: true,
      organizationId: true,
      title: true,
      description: true,
      clauseReference: true,
      dueDate: true,
      assigneeId: true,
      createdById: true,
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  })
  if (obligations.length === 0) return []

  const sourceKeys = obligations.map((obligation) => `obligation:${obligation.id}`)
  const existing = await tx.contractAction.findMany({
    where: { organizationId, sourceKey: { in: sourceKeys } },
    select: { sourceKey: true },
  })
  const existingKeys = new Set(existing.map((action) => action.sourceKey))
  const missing = obligations.filter((obligation) => !existingKeys.has(`obligation:${obligation.id}`))
  if (missing.length > 0) {
    await tx.contractAction.createMany({
      data: missing.map((obligation) => ({
        organizationId,
        contractId: obligation.contractId,
        sourceObligationId: obligation.id,
        sourceKey: `obligation:${obligation.id}`,
        kind: "OBLIGATION" as const,
        title: obligation.title,
        description: obligation.description,
        condition: obligation.clauseReference,
        dueDate: obligation.dueDate,
        assigneeId: obligation.assigneeId,
        reviewStatus: "reviewed",
        status: "PROPOSED" as const,
        evidenceRequired: "completion_note",
        createdById: obligation.createdById,
      })),
      skipDuplicates: true,
    })
  }
  return tx.contractAction.findMany({
    where: { organizationId, sourceKey: { in: sourceKeys } },
  })
  })
}

/** Materializes deterministic notice-window actions for auto-renewing contracts. */
async function projectRenewalActionsWithDb(
  organizationId: string,
  tx: Pick<Prisma.TransactionClient, "contract" | "contractAction">,
) {
  const contracts = await tx.contract.findMany({
    where: {
      organizationId,
      autoRenewal: true,
      status: { not: "ARCHIVED" },
      endDate: { not: null },
      noticePeriodDays: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      ownerId: true,
      endDate: true,
      noticePeriodDays: true,
      extractions: {
        where: { field: { in: ["endDate", "noticePeriodDays", "autoRenewal"] }, status: "accepted" },
        select: { field: true, sourceText: true, sourcePage: true, confidence: true, rawValue: true },
      },
    },
    take: 500,
  })

  if (contracts.length === 0) return []
  const sourceKeys = contracts.map((contract) => `renewal-notice:${contract.id}`)
  const existingActions = await tx.contractAction.findMany({
    where: { organizationId, sourceKey: { in: sourceKeys } },
    select: { id: true, sourceKey: true, sourceHash: true, status: true },
  })
  const existingByKey = new Map(existingActions.map((action) => [action.sourceKey, action]))

  const actions = []
  for (const contract of contracts) {
    if (!contract.endDate || contract.noticePeriodDays == null) continue
    const reviewedFields = new Set(contract.extractions.map((item) => item.field))
    if (!["endDate", "noticePeriodDays", "autoRenewal"].every((field) => reviewedFields.has(field))) continue
    const noticeDate = new Date(contract.endDate.getTime() - contract.noticePeriodDays * 86_400_000)
    const endDateExtraction = contract.extractions.find((item) => item.field === "endDate")
    const noticeExtraction = contract.extractions.find((item) => item.field === "noticePeriodDays")
    const sourceText = [endDateExtraction?.sourceText, noticeExtraction?.sourceText].filter(Boolean).join(" ") || undefined
    const sourcePage = endDateExtraction?.sourcePage ?? noticeExtraction?.sourcePage ?? undefined
    const confidence = [endDateExtraction?.confidence, noticeExtraction?.confidence].filter((value): value is number => value != null)
    const sourceHash = createHash("sha256")
      .update(`${contract.endDate.toISOString()}:${contract.noticePeriodDays}:${sourceText ?? ""}`)
      .digest("hex")

    const sourceKey = `renewal-notice:${contract.id}`
    const existing = existingByKey.get(sourceKey)
    const sourceChanged = Boolean(existing?.sourceHash && existing.sourceHash !== sourceHash)

    if (existing && !sourceChanged) continue

    actions.push(await tx.contractAction.upsert({
      where: {
        organizationId_sourceKey: {
          organizationId,
          sourceKey,
        },
      },
      create: {
        organizationId,
        contractId: contract.id,
        sourceKey,
        kind: "RENEWAL_NOTICE",
        title: `Review renewal notice for ${contract.title}`,
        description: `Give notice at least ${contract.noticePeriodDays} days before the contract end date.`,
        condition: `Auto-renews unless notice is given ${contract.noticePeriodDays} days before expiry.`,
        dueDate: noticeDate,
        noticeDate,
        assigneeId: contract.ownerId,
        sourceText: sourceText ?? null,
        sourcePage: sourcePage ?? null,
        confidence: confidence.length ? Math.min(...confidence) : null,
        sourceHash,
        reviewStatus: "reviewed",
        status: "PROPOSED",
        evidenceRequired: "completion_note",
        createdById: null,
      },
      update: {
        title: `Review renewal notice for ${contract.title}`,
        description: `Give notice at least ${contract.noticePeriodDays} days before the contract end date.`,
        condition: `Auto-renews unless notice is given ${contract.noticePeriodDays} days before expiry.`,
        dueDate: noticeDate,
        noticeDate,
        assigneeId: contract.ownerId,
        sourceText: sourceText ?? null,
        sourcePage: sourcePage ?? null,
        confidence: confidence.length ? Math.min(...confidence) : null,
        sourceHash,
        evidenceRequired: "completion_note",
        ...(sourceChanged
          ? { status: "STALE", staleAt: new Date(), version: { increment: 1 } }
          : {}),
      },
    }))
  }
  return actions
}

export async function projectRenewalActions(
  organizationId: string,
  transaction?: Pick<Prisma.TransactionClient, "contract" | "contractAction">,
) {
  if (transaction) return projectRenewalActionsWithDb(organizationId, transaction)
  return prisma.$transaction((tx) => projectRenewalActionsWithDb(organizationId, tx))
}
