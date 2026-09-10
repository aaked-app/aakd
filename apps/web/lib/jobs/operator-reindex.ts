import type { GeneratedEmbedding } from "@/lib/embedding"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

export const MAX_EMBEDDING_CHARS = 500_000

export interface OperatorReindexIdentity {
  organizationId: string
  contractId: string
  actorUserId: string
  actorMemberId: string
}

export interface OperatorReindexJobData {
  contractId: string
  organizationId?: string
  extractedText: string
  indexOnly?: boolean
  requestedByUserId?: string
  requestedByMemberId?: string
  skipAiExtraction?: boolean
}

export interface OperatorReindexDb {
  member: {
    findFirst(args: {
      where: { id: string; userId: string; organizationId: string }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
  contract: {
    findFirst(args: {
      where: {
        id: string
        organizationId: string
        accessGrants: { some: { organizationId: string; memberId: string } }
      }
      select: {
        extractedText: true
        embedding: { select: { model: true } }
      }
    }): Promise<{
      extractedText: string | null
      embedding: { model: string } | null
    } | null>
  }
}

export class OperatorReindexAuthorizationError extends Error {
  constructor() {
    super("Reindex target is not authorized")
    this.name = "OperatorReindexAuthorizationError"
  }
}

export async function loadAuthorizedReindexTarget(
  db: OperatorReindexDb,
  identity: OperatorReindexIdentity,
  expectedExtractedText?: string,
) {
  if (isAgreementAccessEmergencyDenyAll()) throw new OperatorReindexAuthorizationError()
  const member = await db.member.findFirst({
    where: {
      id: identity.actorMemberId,
      userId: identity.actorUserId,
      organizationId: identity.organizationId,
    },
    select: { id: true },
  })
  if (!member) throw new OperatorReindexAuthorizationError()

  const contract = await db.contract.findFirst({
    where: {
      id: identity.contractId,
      organizationId: identity.organizationId,
      accessGrants: {
        some: {
          organizationId: identity.organizationId,
          memberId: identity.actorMemberId,
        },
      },
    },
    select: {
      extractedText: true,
      embedding: { select: { model: true } },
    },
  })
  if (!contract || (expectedExtractedText !== undefined
    && contract.extractedText !== expectedExtractedText)) {
    throw new OperatorReindexAuthorizationError()
  }
  return contract
}

export function shouldChainAiExtraction(job: Pick<OperatorReindexJobData, "indexOnly" | "skipAiExtraction">) {
  return !job.indexOnly && !job.skipAiExtraction
}

export async function assertOperatorReindexJobAuthorized(
  db: OperatorReindexDb,
  job: OperatorReindexJobData,
): Promise<void> {
  const organizationId = job.organizationId ?? ""
  if (!job.indexOnly) return
  if (!organizationId || !job.requestedByUserId || !job.requestedByMemberId) {
    throw new OperatorReindexAuthorizationError()
  }
  await loadAuthorizedReindexTarget(db, {
    organizationId,
    contractId: job.contractId,
    actorUserId: job.requestedByUserId,
    actorMemberId: job.requestedByMemberId,
  }, job.extractedText)
}

export async function generateEmbeddingForJob(
  db: OperatorReindexDb,
  job: OperatorReindexJobData,
  resolvedOrganizationId: string,
  text: string,
  generate: (text: string, organizationId: string) => Promise<GeneratedEmbedding | null>,
): Promise<GeneratedEmbedding | null> {
  await assertOperatorReindexJobAuthorized(db, job)
  return generate(text, resolvedOrganizationId)
}
