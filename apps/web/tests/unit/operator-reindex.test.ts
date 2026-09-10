// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"

const ids = {
  organizationId: "org-1",
  contractId: "contract-1",
  actorUserId: "user-1",
  actorMemberId: "member-1",
}

function authorizedDb(extractedText: string | null = "Private contract terms") {
  return {
    member: {
      findFirst: vi.fn().mockImplementation(async (args: {
        where: { id: string; userId: string; organizationId: string }
      }) => (
        args.where.id === ids.actorMemberId
        && args.where.userId === ids.actorUserId
        && args.where.organizationId === ids.organizationId
          ? { id: ids.actorMemberId }
          : null
      )),
    },
    contract: {
      findFirst: vi.fn().mockImplementation(async (args: {
        where: {
          id: string
          organizationId: string
          accessGrants?: { some?: { organizationId?: string; memberId?: string } }
        }
      }) => (
        args.where.id === ids.contractId
        && args.where.organizationId === ids.organizationId
        && args.where.accessGrants?.some?.organizationId === ids.organizationId
        && args.where.accessGrants?.some?.memberId === ids.actorMemberId
          ? {
              extractedText,
              embedding: { model: "openai:legacy-model:1536" },
            }
          : null
      )),
    },
  } as unknown as PrismaClient
}

describe("operator-controlled semantic reindex", () => {
  it("rejects before reading membership or contract data during emergency deny-all", async () => {
    const original = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
    const client = authorizedDb()
    try {
      const { loadAuthorizedReindexTarget } = await import("@/lib/jobs/operator-reindex")
      await expect(loadAuthorizedReindexTarget(client, ids)).rejects.toThrow("Reindex target is not authorized")
      expect(client.member.findFirst).not.toHaveBeenCalled()
      expect(client.contract.findFirst).not.toHaveBeenCalled()
    } finally {
      if (original === undefined) delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      else process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = original
    }
  })

  it("parses exact identifiers and stays dry-run unless --execute is explicit", async () => {
    const { parseOperatorReindexArgs } = await import("@/scripts/reindex-contract")
    expect(parseOperatorReindexArgs([
      "--organization-id", ids.organizationId,
      "--contract-id", ids.contractId,
      "--actor-user-id", ids.actorUserId,
      "--actor-member-id", ids.actorMemberId,
    ])).toEqual({ ...ids, execute: false })
    expect(parseOperatorReindexArgs([
      "--organization-id", ids.organizationId,
      "--contract-id", ids.contractId,
      "--actor-user-id", ids.actorUserId,
      "--actor-member-id", ids.actorMemberId,
      "--execute",
    ])).toEqual({ ...ids, execute: true })
  })

  it("rejects missing, empty, duplicate, or unknown arguments", async () => {
    const { parseOperatorReindexArgs } = await import("@/scripts/reindex-contract")
    expect(() => parseOperatorReindexArgs([])).toThrow("Invalid reindex arguments")
    expect(() => parseOperatorReindexArgs([
      "--organization-id", ids.organizationId,
      "--organization-id", ids.organizationId,
      "--contract-id", ids.contractId,
      "--actor-user-id", ids.actorUserId,
      "--actor-member-id", ids.actorMemberId,
    ])).toThrow("Invalid reindex arguments")
    expect(() => parseOperatorReindexArgs([
      "--organization-id", ids.organizationId,
      "--contract-id", ids.contractId,
      "--actor-user-id", ids.actorUserId,
      "--actor-member-id", ids.actorMemberId,
      "--all-organizations",
    ])).toThrow("Invalid reindex arguments")
  })

  it("dry-runs an authorized exact contract without queueing or disclosing text", async () => {
    const { runOperatorReindex } = await import("@/scripts/reindex-contract")
    const add = vi.fn()
    const write = vi.fn()
    const result = await runOperatorReindex(
      { ...ids, execute: false },
      { db: authorizedDb(), queue: { add }, write },
    )
    expect(result).toEqual({
      dryRun: true,
      eligible: true,
      organizationId: ids.organizationId,
      contractId: ids.contractId,
      extractedChars: 22,
      currentEmbeddingModel: "openai:legacy-model:1536",
    })
    expect(add).not.toHaveBeenCalled()
    expect(JSON.stringify(write.mock.calls)).not.toContain("Private contract terms")
  })

  it("queues one index-only job with the current source and exact actor", async () => {
    const { runOperatorReindex } = await import("@/scripts/reindex-contract")
    const add = vi.fn().mockResolvedValue({ id: "job-1" })
    const write = vi.fn()
    const result = await runOperatorReindex(
      { ...ids, execute: true },
      { db: authorizedDb(), queue: { add }, write },
    )
    expect(result).toEqual({ queued: true, jobId: "job-1" })
    expect(add).toHaveBeenCalledWith("embed", {
      contractId: ids.contractId,
      organizationId: ids.organizationId,
      extractedText: "Private contract terms",
      indexOnly: true,
      requestedByUserId: ids.actorUserId,
      requestedByMemberId: ids.actorMemberId,
    }, {
      jobId: "operator-reindex-74c8081019262cf767c31255fdcf8360553b7791ea218fd384dadef330c3fedf",
      removeOnComplete: true,
      removeOnFail: true,
    })
    expect(JSON.stringify(write.mock.calls)).not.toContain("Private contract terms")
  })

  it("fails closed without revealing whether membership, grant, or contract was missing", async () => {
    const { runOperatorReindex } = await import("@/scripts/reindex-contract")
    for (const db of [
      {
        member: { findFirst: vi.fn().mockResolvedValue(null) },
        contract: { findFirst: vi.fn() },
      },
      {
        member: { findFirst: vi.fn().mockResolvedValue({ id: ids.actorMemberId }) },
        contract: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    ]) {
      const add = vi.fn()
      await expect(runOperatorReindex(
        { ...ids, execute: true },
        { db: db as unknown as PrismaClient, queue: { add }, write: vi.fn() },
      )).rejects.toThrow("Reindex target is not authorized")
      expect(add).not.toHaveBeenCalled()
    }
  })

  it("reports missing or over-budget text as ineligible and never queues it", async () => {
    const { MAX_EMBEDDING_CHARS } = await import("@/lib/jobs/operator-reindex")
    const { runOperatorReindex } = await import("@/scripts/reindex-contract")
    for (const [text, reason] of [
      [null, "no_extracted_text"],
      ["x".repeat(MAX_EMBEDDING_CHARS + 1), "index_budget"],
    ] as const) {
      const add = vi.fn()
      const result = await runOperatorReindex(
        { ...ids, execute: true },
        { db: authorizedDb(text), queue: { add }, write: vi.fn() },
      )
      expect(result).toMatchObject({ eligible: false, reason })
      expect(add).not.toHaveBeenCalled()
    }
  })

  it("rechecks exact membership, grant, organization, and source before every provider call", async () => {
    const { generateEmbeddingForJob } = await import("@/lib/jobs/operator-reindex")
    const db = authorizedDb()
    const generate = vi.fn().mockResolvedValue({ vector: [0.1], model: "model" })
    const job = {
      contractId: ids.contractId,
      organizationId: ids.organizationId,
      extractedText: "Private contract terms",
      indexOnly: true,
      requestedByUserId: ids.actorUserId,
      requestedByMemberId: ids.actorMemberId,
    } as const
    await generateEmbeddingForJob(db, job, ids.organizationId, "first chunk", generate)
    await generateEmbeddingForJob(db, job, ids.organizationId, "second chunk", generate)
    expect(db.member.findFirst).toHaveBeenCalledTimes(2)
    expect(db.contract.findFirst).toHaveBeenCalledTimes(2)
    expect(generate).toHaveBeenCalledTimes(2)

    vi.mocked(db.contract.findFirst).mockResolvedValueOnce({
      extractedText: "Replaced contract terms",
      embedding: null,
    } as never)
    const revoked = await generateEmbeddingForJob(db, job, ids.organizationId, "third chunk", generate)
      .catch((error) => error)
    expect(revoked).toMatchObject({
      name: "OperatorReindexAuthorizationError",
      message: "Reindex target is not authorized",
    })
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it("preserves the worker-resolved organization for legacy upload jobs", async () => {
    const { generateEmbeddingForJob } = await import("@/lib/jobs/operator-reindex")
    const generate = vi.fn().mockResolvedValue(null)
    await generateEmbeddingForJob(
      authorizedDb(),
      { contractId: ids.contractId, extractedText: "Terms" },
      ids.organizationId,
      "Terms",
      generate,
    )
    expect(generate).toHaveBeenCalledWith("Terms", ids.organizationId)
  })

  it("never chains metadata extraction for an index-only job", async () => {
    const { shouldChainAiExtraction } = await import("@/lib/jobs/operator-reindex")
    expect(shouldChainAiExtraction({ indexOnly: true })).toBe(false)
    expect(shouldChainAiExtraction({ skipAiExtraction: true })).toBe(false)
    expect(shouldChainAiExtraction({})).toBe(true)
  })
})
