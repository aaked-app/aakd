import { loadEnvConfig } from "@next/env"
import { resolve } from "node:path"
import { Pool } from "pg"
import {
  buildAgreementAccessPreflightReport,
} from "../lib/auth/agreement-access-preflight"
import { collectAgreementAccessPreflightInput } from "./agreement-access-data"

async function main() {
  const explicitDatabaseUrl = process.env.DATABASE_URL?.trim()
  const workspaceEnv = loadEnvConfig(resolve(process.cwd(), "../.."), false).combinedEnv
  const appEnv = loadEnvConfig(process.cwd(), false).combinedEnv
  const databaseUrl = explicitDatabaseUrl || appEnv.DATABASE_URL?.trim() || workspaceEnv.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error("DATABASE_URL is required")

  const pool = new Pool({ connectionString: databaseUrl, application_name: "aakd-agreement-access-preflight" })
  const client = await pool.connect()
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const report = buildAgreementAccessPreflightReport(await collectAgreementAccessPreflightInput(client))
    await client.query("ROLLBACK")
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!report.readyForReviewedBackfill) process.exitCode = 2
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Agreement-access preflight failed: ${error instanceof Error ? error.message : "Unknown error"}\n`)
  process.exitCode = 1
})
