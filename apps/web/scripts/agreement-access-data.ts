import type { PoolClient } from "pg"
import type {
  AgreementAccessPreflightInput,
  BriefAudienceMappingRow,
  ContractOwnerMappingRow,
  ExistingGrantRow,
} from "../lib/auth/agreement-access-preflight"

async function hasColumn(client: PoolClient, table: string, column: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
        AND column_name = $2
    ) AS exists
  `, [table, column])
  return result.rows[0]?.exists === true
}

export async function collectAgreementAccessPreflightInput(
  client: PoolClient,
): Promise<AgreementAccessPreflightInput> {
  const hasGrantTableResult = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('"ContractAccessGrant"') IS NOT NULL AS exists`,
  )
  const hasGrantTable = hasGrantTableResult.rows[0]?.exists === true
  const hasBriefAudienceMemberId = await hasColumn(client, "TeamBrief", "audienceMemberId")

  const contractResult = await client.query<ContractOwnerMappingRow>(`
    SELECT
      contract."id" AS "contractId",
      contract."organizationId" AS "organizationId",
      contract."ownerId" AS "ownerUserId",
      member."id" AS "memberId"
    FROM "Contract" AS contract
    LEFT JOIN "Member" AS member
      ON member."organizationId" = contract."organizationId"
     AND member."userId" = contract."ownerId"
    ORDER BY contract."id", member."id"
  `)

  const bindingSelection = hasBriefAudienceMemberId
    ? 'brief."audienceMemberId"'
    : "NULL::text"
  const briefResult = await client.query<BriefAudienceMappingRow>(`
    SELECT
      brief."id" AS "briefId",
      brief."organizationId" AS "organizationId",
      brief."audienceUserId" AS "audienceUserId",
      member."id" AS "audienceMemberId",
      ${bindingSelection} AS "currentBindingMemberId"
    FROM "TeamBrief" AS brief
    LEFT JOIN "Member" AS member
      ON member."organizationId" = brief."organizationId"
     AND member."userId" = brief."audienceUserId"
    ORDER BY brief."id", member."id"
  `)

  const existingGrants = hasGrantTable
    ? (await client.query<ExistingGrantRow>(`
        SELECT "contractId", "memberId"
        FROM "ContractAccessGrant"
        ORDER BY "contractId", "memberId"
      `)).rows
    : []

  return {
    contracts: contractResult.rows,
    briefs: briefResult.rows,
    existingGrants,
    schema: { hasGrantTable, hasBriefAudienceMemberId },
  }
}
