import type { PoolClient } from "pg"
import type { buildAgreementAccessPreflightReport } from "./agreement-access-preflight"

type Report = ReturnType<typeof buildAgreementAccessPreflightReport>

/** Called under the backfill transaction's Member table lock. */
export async function assertAgreementBackfillActor(
  client: Pick<PoolClient, "query">,
  userId: string,
  report: Report,
): Promise<void> {
  const organizations = [...new Set([
    ...report.contracts.filter(row => row.status === "ready" && !row.ownerGrantExists).map(row => row.organizationId),
    ...report.briefs.filter(row => row.bindingChangeRequired).map(row => row.organizationId),
  ])].sort()
  if (organizations.length === 0) return
  const members = await client.query<{ organizationId: string; role: string }>(
    'SELECT "organizationId", "role" FROM "Member" WHERE "userId" = $1 AND "organizationId" = ANY($2::text[])',
    [userId, organizations],
  )
  for (const organizationId of organizations) {
    const matches = members.rows.filter(member => member.organizationId === organizationId)
    if (matches.length !== 1 || !["owner", "admin"].includes(matches[0].role)) {
      throw new Error("Backfill actor must have exactly one current owner/admin membership in every affected organization")
    }
  }
}
