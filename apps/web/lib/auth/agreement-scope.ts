import type { RequestContext } from "@/lib/context"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

type QueryArgs = { where?: Record<string, unknown>; [key: string]: unknown }

const READ_OR_MUTATE_OPERATIONS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany",
])

export const AGREEMENT_ACCESS_MODEL_METADATA = {
  Contract: { directOrganizationId: true, relationPath: [] },
  ContractAction: { directOrganizationId: true, relationPath: ["contract"] },
  ContractObligation: { directOrganizationId: true, relationPath: ["contract"] },
  ContractAlert: { directOrganizationId: false, relationPath: ["contract"] },
  ContractObligationSuggestion: { directOrganizationId: true, relationPath: ["contract"] },
  ContractFile: { directOrganizationId: false, relationPath: ["contract"] },
  ContractVersion: { directOrganizationId: false, relationPath: ["contract"] },
  Activity: { directOrganizationId: false, relationPath: ["contract"] },
  Approval: { directOrganizationId: false, relationPath: ["contract"] },
  AIExtraction: { directOrganizationId: false, relationPath: ["contract"] },
  ContractEmbedding: { directOrganizationId: false, relationPath: ["contract"] },
  ContractDocument: { directOrganizationId: false, relationPath: ["contract"] },
  DocumentSnapshot: { directOrganizationId: true, relationPath: ["contract"] },
  ContractComment: { directOrganizationId: false, relationPath: ["contract"] },
  ContractSigner: { directOrganizationId: false, relationPath: ["contract"] },
  CrmLink: { directOrganizationId: false, relationPath: ["contract"] },
  ContractActionEvidence: { directOrganizationId: false, relationPath: ["action", "contract"] },
  ContractActionEvidenceReview: { directOrganizationId: false, relationPath: ["evidence", "action", "contract"] },
  ContractActionDelivery: { directOrganizationId: false, relationPath: ["action", "contract"] },
  ObligationSubTask: { directOrganizationId: false, relationPath: ["obligation", "contract"] },
} as const

function accessPath(relationPath: readonly string[], grant: Record<string, unknown>): Record<string, unknown> {
  return relationPath.reduceRight<Record<string, unknown>>(
    (where, relation) => ({ [relation]: where }),
    { accessGrants: { some: grant } },
  )
}

/**
 * Defense in depth for top-level Prisma operations. Nested reads/writes and raw
 * SQL do not pass through this boundary and must carry explicit route/service
 * authorization.
 */
export function scopeAgreementOperation(
  model: string | undefined,
  operation: string,
  args: QueryArgs,
  ctx: RequestContext | undefined,
): QueryArgs {
  const metadata = model
    ? AGREEMENT_ACCESS_MODEL_METADATA[model as keyof typeof AGREEMENT_ACCESS_MODEL_METADATA]
    : undefined
  if (!metadata || !READ_OR_MUTATE_OPERATIONS.has(operation) || !ctx?.organizationId) return args

  const originalWhere = args.where ?? {}
  if (isAgreementAccessEmergencyDenyAll() || !ctx.memberId) {
    return {
      ...args,
      where: {
        ...originalWhere,
        AND: [
          ...normalizeAnd(originalWhere.AND),
          { id: "__agreement_access_denied__" },
          { id: { not: "__agreement_access_denied__" } },
        ],
      },
    }
  }

  const grant = { organizationId: ctx.organizationId, memberId: ctx.memberId }
  const authorization = accessPath(metadata.relationPath, grant)
  return {
    ...args,
    where: {
      ...originalWhere,
      AND: [
        ...normalizeAnd(originalWhere.AND),
        ...(metadata.directOrganizationId ? [{ organizationId: ctx.organizationId }] : []),
        authorization,
      ],
    },
  }
}

function normalizeAnd(value: unknown): Record<string, unknown>[] {
  if (!value) return []
  return Array.isArray(value) ? value as Record<string, unknown>[] : [value as Record<string, unknown>]
}
