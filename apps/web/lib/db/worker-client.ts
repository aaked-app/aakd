/**
 * Standalone Prisma client for the BullMQ worker process.
 *
 * Uses @prisma/adapter-pg (required by Prisma 7 "client" engine) but has NO
 * org-scope middleware — the worker operates as System with no request context.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { getDatabasePoolSize } from "@/lib/security/production-config"

let _client: PrismaClient | null = null

export function getWorkerPrisma(): PrismaClient {
  if (!_client) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "",
      max: getDatabasePoolSize(),
    })
    const adapter = new PrismaPg(pool)
    _client = new PrismaClient({ adapter, log: ["error", "warn"] })
  }
  return _client
}
