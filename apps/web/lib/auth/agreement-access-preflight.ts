import { createHash } from "node:crypto"

export interface ContractOwnerMappingRow {
  contractId: string
  organizationId: string
  ownerUserId: string
  memberId: string | null
}

export interface BriefAudienceMappingRow {
  briefId: string
  organizationId: string
  audienceUserId: string
  audienceMemberId: string | null
  currentBindingMemberId: string | null
}

export interface ExistingGrantRow {
  contractId: string
  memberId: string
}

export interface AgreementAccessPreflightInput {
  contracts: ContractOwnerMappingRow[]
  briefs: BriefAudienceMappingRow[]
  existingGrants: ExistingGrantRow[]
  schema: {
    hasGrantTable: boolean
    hasBriefAudienceMemberId: boolean
  }
}

function groupedIds<T>(rows: T[], key: (row: T) => string, value: (row: T) => string | null) {
  const groups = new Map<string, Set<string>>()
  for (const row of rows) {
    const id = value(row)
    if (!groups.has(key(row))) groups.set(key(row), new Set())
    if (id) groups.get(key(row))?.add(id)
  }
  return groups
}

function canonicalDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function buildAgreementAccessPreflightReport(input: AgreementAccessPreflightInput) {
  const ownerMembers = groupedIds(input.contracts, (row) => row.contractId, (row) => row.memberId)
  const audienceMembers = groupedIds(input.briefs, (row) => row.briefId, (row) => row.audienceMemberId)
  const existingGrantKeys = new Set(input.existingGrants.map((row) => `${row.contractId}\u0000${row.memberId}`))

  const contractsById = new Map(input.contracts.map((row) => [row.contractId, row]))
  const contracts = [...contractsById.values()]
    .sort((a, b) => a.contractId.localeCompare(b.contractId))
    .map((row) => {
      const ownerMemberIds = [...(ownerMembers.get(row.contractId) ?? [])].sort()
      const status = ownerMemberIds.length === 0
        ? "owner_missing"
        : ownerMemberIds.length === 1
          ? "ready"
          : "owner_duplicate"
      const ownerMemberId = status === "ready" ? ownerMemberIds[0] : null
      return {
        contractId: row.contractId,
        organizationId: row.organizationId,
        ownerUserId: row.ownerUserId,
        ownerMemberIds,
        status,
        ownerGrantExists: ownerMemberId
          ? existingGrantKeys.has(`${row.contractId}\u0000${ownerMemberId}`)
          : false,
      }
    })

  const briefsById = new Map(input.briefs.map((row) => [row.briefId, row]))
  const briefs = [...briefsById.values()]
    .sort((a, b) => a.briefId.localeCompare(b.briefId))
    .map((row) => {
      const currentAudienceMemberIds = [...(audienceMembers.get(row.briefId) ?? [])].sort()
      const status = currentAudienceMemberIds.length === 0
        ? "audience_missing"
        : currentAudienceMemberIds.length !== 1
          ? "audience_duplicate"
          : row.currentBindingMemberId === null
            ? "audience_unbound"
            : row.currentBindingMemberId === currentAudienceMemberIds[0]
              ? "ready"
              : "audience_binding_invalid"
      // A null FK can mean legacy data OR a revoked membership. Never infer a
      // fresh entitlement from the same user's new organization membership.
      // An authorized publisher must review and republish an unbound Brief.
      const plannedAudienceMemberId = status === "ready" ? row.currentBindingMemberId : null
      return {
        briefId: row.briefId,
        organizationId: row.organizationId,
        audienceUserId: row.audienceUserId,
        currentAudienceMemberIds,
        currentBindingMemberId: row.currentBindingMemberId,
        plannedAudienceMemberId,
        status,
        bindingChangeRequired: row.currentBindingMemberId !== plannedAudienceMemberId,
      }
    })

  const ownerMissing = contracts.filter((row) => row.status === "owner_missing").length
  const ownerDuplicate = contracts.filter((row) => row.status === "owner_duplicate").length
  const mapping = {
    schema: input.schema,
    counts: {
      contracts: contracts.length,
      ownerMissing,
      ownerDuplicate,
      ownerGrantsToInsert: contracts.filter((row) => row.status === "ready" && !row.ownerGrantExists).length,
      briefs: briefs.length,
      briefAudienceMissing: briefs.filter((row) => row.status === "audience_missing").length,
      briefAudienceDuplicate: briefs.filter((row) => row.status === "audience_duplicate").length,
      briefAudienceUnbound: briefs.filter((row) => row.status === "audience_unbound").length,
      briefAudienceBindingInvalid: briefs.filter((row) => row.status === "audience_binding_invalid").length,
      briefBindingsToChange: briefs.filter((row) => row.bindingChangeRequired).length,
    },
    contracts,
    briefs,
  }

  return {
    ...mapping,
    readyForReviewedBackfill: ownerMissing === 0 && ownerDuplicate === 0,
    mappingSha256: canonicalDigest(mapping),
  }
}
