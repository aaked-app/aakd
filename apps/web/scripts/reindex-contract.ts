import { fileURLToPath } from "node:url"
import path from "node:path"
import { createHash } from "node:crypto"
import type { OperatorReindexDb, OperatorReindexIdentity } from "../lib/jobs/operator-reindex"
import { loadAuthorizedReindexTarget, MAX_EMBEDDING_CHARS } from "../lib/jobs/operator-reindex"

export interface OperatorReindexOptions extends OperatorReindexIdentity {
  execute: boolean
}

interface ReindexQueue {
  add(name: "embed", data: {
    contractId: string
    organizationId: string
    extractedText: string
    indexOnly: true
    requestedByUserId: string
    requestedByMemberId: string
  }, options: {
    jobId: string
    removeOnComplete: true
    removeOnFail: true
  }): Promise<{ id?: string | number }>
}

interface OperatorReindexDependencies {
  db: OperatorReindexDb
  queue: ReindexQueue
  write: (line: string) => void
}

const VALUE_FLAGS = {
  "--organization-id": "organizationId",
  "--contract-id": "contractId",
  "--actor-user-id": "actorUserId",
  "--actor-member-id": "actorMemberId",
} as const

function invalidArguments(): never {
  throw new Error("Invalid reindex arguments")
}

export function parseOperatorReindexArgs(args: string[]): OperatorReindexOptions {
  const parsed: Partial<OperatorReindexOptions> = { execute: false }
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === "--execute") {
      if (parsed.execute) invalidArguments()
      parsed.execute = true
      continue
    }
    const key = VALUE_FLAGS[flag as keyof typeof VALUE_FLAGS]
    const value = args[index + 1]
    if (!key || !value || value.startsWith("--") || value.length > 200 || parsed[key]) {
      invalidArguments()
    }
    parsed[key] = value
    index += 1
  }
  if (!parsed.organizationId || !parsed.contractId
    || !parsed.actorUserId || !parsed.actorMemberId) invalidArguments()
  return parsed as OperatorReindexOptions
}

export async function runOperatorReindex(
  options: OperatorReindexOptions,
  dependencies: OperatorReindexDependencies,
) {
  const target = await loadAuthorizedReindexTarget(dependencies.db, options)
  const base = {
    organizationId: options.organizationId,
    contractId: options.contractId,
  }
  if (!target.extractedText) {
    const result = { dryRun: !options.execute, eligible: false, ...base, reason: "no_extracted_text" as const }
    dependencies.write(JSON.stringify(result))
    return result
  }
  if (target.extractedText.length > MAX_EMBEDDING_CHARS) {
    const result = {
      dryRun: !options.execute,
      eligible: false,
      ...base,
      extractedChars: target.extractedText.length,
      reason: "index_budget" as const,
    }
    dependencies.write(JSON.stringify(result))
    return result
  }
  if (!options.execute) {
    const result = {
      dryRun: true,
      eligible: true,
      ...base,
      extractedChars: target.extractedText.length,
      currentEmbeddingModel: target.embedding?.model ?? null,
    }
    dependencies.write(JSON.stringify(result))
    return result
  }

  const jobId = `operator-reindex-${createHash("sha256")
    .update(`${options.organizationId}\n${options.contractId}\n${target.extractedText}`)
    .digest("hex")}`
  const job = await dependencies.queue.add("embed", {
    contractId: options.contractId,
    organizationId: options.organizationId,
    extractedText: target.extractedText,
    indexOnly: true,
    requestedByUserId: options.actorUserId,
    requestedByMemberId: options.actorMemberId,
  }, {
    jobId,
    removeOnComplete: true,
    removeOnFail: true,
  })
  const result = { queued: true as const, jobId: String(job.id ?? "") }
  dependencies.write(JSON.stringify(result))
  return result
}

async function main() {
  const { loadEnvConfig } = await import("@next/env")
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")
  const [{ getWorkerPrisma }, { getContractEmbedQueue }] = await Promise.all([
    import("../lib/db/worker-client"),
    import("../lib/jobs/queues"),
  ])
  const options = parseOperatorReindexArgs(process.argv.slice(2))
  const db = getWorkerPrisma()
  const queue = getContractEmbedQueue()
  try {
    await runOperatorReindex(options, {
      db: db as unknown as OperatorReindexDb,
      queue,
      write: console.log,
    })
  } finally {
    await queue.close()
    await db.$disconnect()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Reindex failed")
    process.exitCode = 1
  })
}
