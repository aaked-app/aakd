import { loadEnvConfig } from "@next/env"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Pool } from "pg"
import { buildAgreementAccessPreflightReport } from "../lib/auth/agreement-access-preflight"
import { collectAgreementAccessPreflightInput } from "./agreement-access-data"
import { assertAgreementBackfillActor } from "../lib/auth/agreement-backfill-actor"

const REQUIRED_FLAGS = ["--mapping", "--approved-sha256", "--actor-user-id", "--request-id"] as const

function readArguments(argv: string[]) {
  const allowed = new Set<string>(REQUIRED_FLAGS)
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag || !allowed.has(flag) || !value || value.startsWith("--") || values.has(flag)) {
      throw new Error(`Expected each required flag exactly once: ${REQUIRED_FLAGS.join(", ")}`)
    }
    values.set(flag, value)
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!values.get(flag)?.trim()) throw new Error(`Missing required flag: ${flag}`)
  }
  return Object.fromEntries(REQUIRED_FLAGS.map((flag) => [flag.slice(2), values.get(flag)!])) as {
    mapping: string
    "approved-sha256": string
    "actor-user-id": string
    "request-id": string
  }
}

function readReviewedReport(path: string): ReturnType<typeof buildAgreementAccessPreflightReport> {
  const raw = readFileSync(path, "utf8")
  const jsonStart = raw.indexOf("{")
  if (jsonStart < 0) throw new Error("Mapping file does not contain a JSON report")
  return JSON.parse(raw.slice(jsonStart)) as ReturnType<typeof buildAgreementAccessPreflightReport>
}

async function main() {
  const args = readArguments(process.argv.slice(2))
  const reviewedReport = readReviewedReport(args.mapping)
  if (reviewedReport.mappingSha256 !== args["approved-sha256"]) {
    throw new Error("Approved SHA-256 does not match the reviewed mapping file")
  }

  const explicitDatabaseUrl = process.env.DATABASE_URL?.trim()
  const workspaceEnv = loadEnvConfig(resolve(process.cwd(), "../.."), false).combinedEnv
  const appEnv = loadEnvConfig(process.cwd(), false).combinedEnv
  const databaseUrl = explicitDatabaseUrl || appEnv.DATABASE_URL?.trim() || workspaceEnv.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error("DATABASE_URL is required")

  const pool = new Pool({ connectionString: databaseUrl, application_name: "aakd-agreement-access-backfill" })
  const client = await pool.connect()
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout = '5s'")
    // This is intentionally a maintenance-window operation. The table locks
    // prevent the signed mapping from becoming stale between verification and writes.
    await client.query('LOCK TABLE "Contract" IN SHARE ROW EXCLUSIVE MODE')
    await client.query('LOCK TABLE "Member" IN SHARE ROW EXCLUSIVE MODE')
    await client.query('LOCK TABLE "TeamBrief" IN SHARE ROW EXCLUSIVE MODE')
    await client.query('LOCK TABLE "ContractAccessGrant" IN SHARE ROW EXCLUSIVE MODE')

    const liveReport = buildAgreementAccessPreflightReport(await collectAgreementAccessPreflightInput(client))
    if (!liveReport.schema.hasGrantTable || !liveReport.schema.hasBriefAudienceMemberId) {
      throw new Error("Agreement-access schema migration must be applied before backfill")
    }
    if (!liveReport.readyForReviewedBackfill) {
      throw new Error("Live mapping contains unresolved contract owner rows")
    }
    if (liveReport.mappingSha256 !== args["approved-sha256"] || JSON.stringify(liveReport) !== JSON.stringify(reviewedReport)) {
      throw new Error("Live mapping changed after operator review; generate and review a new preflight report")
    }

    const actor = await client.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM "User" WHERE "id" = $1) AS exists',
      [args["actor-user-id"]],
    )
    if (actor.rows[0]?.exists !== true) throw new Error("Backfill actor user does not exist")
    await assertAgreementBackfillActor(client, args["actor-user-id"], liveReport)

    let insertedGrants = 0
    for (const contract of liveReport.contracts) {
      if (contract.status !== "ready" || contract.ownerGrantExists) continue
      const memberId = contract.ownerMemberIds[0]
      if (!memberId) throw new Error(`Reviewed owner mapping is incomplete for contract ${contract.contractId}`)
      const grantId = randomUUID()
      await client.query(`
        INSERT INTO "ContractAccessGrant"
          ("id", "organizationId", "contractId", "memberId", "grantedById")
        VALUES ($1, $2, $3, $4, $5)
      `, [grantId, contract.organizationId, contract.contractId, memberId, args["actor-user-id"]])
      await client.query(`
        INSERT INTO "Activity"
          ("id", "contractId", "userId", "actorLabel", "action", "detail", "metadata")
        VALUES ($1, $2, $3, 'Migration operator', 'ACCESS_GRANTED', 'Owner access backfilled', $4::jsonb)
      `, [randomUUID(), contract.contractId, args["actor-user-id"], JSON.stringify({
        requestId: args["request-id"],
        targetMemberId: memberId,
        grantId,
        source: "agreement_access_backfill",
      })])
      insertedGrants += 1
    }

    let updatedBriefs = 0
    for (const brief of liveReport.briefs) {
      if (!brief.bindingChangeRequired) continue
      // Defense in depth: this maintenance path may revoke an invalid binding,
      // never turn an absent/old entitlement into a new membership grant.
      if (brief.plannedAudienceMemberId !== null) throw new Error("Brief recipient grants require reviewed publication")
      const result = await client.query(`
        UPDATE "TeamBrief"
        SET "audienceMemberId" = $1
        WHERE "id" = $2 AND "organizationId" = $3
      `, [brief.plannedAudienceMemberId, brief.briefId, brief.organizationId])
      if (result.rowCount !== 1) throw new Error(`Brief mapping changed for ${brief.briefId}`)
      updatedBriefs += 1
    }

    if (insertedGrants !== liveReport.counts.ownerGrantsToInsert || updatedBriefs !== liveReport.counts.briefBindingsToChange) {
      throw new Error("Applied row counts do not match the reviewed mapping")
    }

    await client.query("COMMIT")
    process.stdout.write(`${JSON.stringify({
      approvedSha256: args["approved-sha256"],
      insertedGrants,
      updatedBriefs,
      requestId: args["request-id"],
    }, null, 2)}\n`)
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Agreement-access backfill failed: ${error instanceof Error ? error.message : "Unknown error"}\n`)
  process.exitCode = 1
})
