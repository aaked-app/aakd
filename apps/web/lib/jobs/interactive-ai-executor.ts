import { Prisma } from "@prisma/client"

import { answerContractQuestion } from "@/lib/ai/answer"
import { chunkText } from "@/lib/ai/chunking"
import { explainContractClause } from "@/lib/ai/clause-explain"
import { testAiProviderConnection } from "@/lib/ai/config-test"
import { generateEmbedding } from "@/lib/embedding"
import { resolveAiConfig } from "@/lib/ai/resolve"
import { decrypt } from "@/lib/notifications/crypto"
import { getWorkerPrisma } from "@/lib/db/worker-client"
import type {
  InteractiveAiJobData,
  InteractiveAiPayload,
  InteractiveAiProcessorDependencies,
  InteractiveAiResponse,
} from "@/lib/jobs/interactive-ai"

type AskCitation = { chunkIndex: number; text: string; similarity: number | null }

function lexicalFallbackChunks(extractedText: string, question: string): AskCitation[] {
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? [])]
  return chunkText(extractedText, 8000, 1000)
    .map((chunk) => ({ chunk, score: terms.reduce((total, term) => total + chunk.text.toLowerCase().split(term).length - 1, 0) }))
    .sort((left, right) => right.score - left.score || left.chunk.index - right.chunk.index)
    .slice(0, 5)
    .map(({ chunk }) => ({ chunkIndex: chunk.index, text: chunk.text, similarity: null }))
}

function buildContext(chunks: AskCitation[]): string {
  return chunks.map((chunk) => `[Excerpt ${chunk.chunkIndex + 1}]\n${chunk.text}`).join("\n\n---\n\n").slice(0, 50_000)
}

async function executeContractQuestion(
  data: InteractiveAiJobData,
  payload: Extract<InteractiveAiPayload, { operation: "contract_question" }>,
  assertAuthorizedForEgress: () => Promise<void>,
): Promise<InteractiveAiResponse> {
  const db = getWorkerPrisma()
  const contract = await db.contract.findUnique({
    where: { id: data.contractId! },
    select: { id: true, title: true, extractedText: true, organizationId: true },
  })
  if (!contract || contract.organizationId !== data.organizationId) return { status: 404, body: { error: "Contract not found" } }
  if (!contract.extractedText?.trim()) return { status: 400, body: { error: "No extracted text available for this contract" } }
  const aiConfig = await resolveAiConfig(data.organizationId)
  if (!aiConfig.provider) return { status: 503, body: { error: "No AI provider configured" } }

  let citations: AskCitation[]
  try {
    await assertAuthorizedForEgress()
    const embedding = await generateEmbedding(payload.question, data.organizationId).catch(() => null)
    if (!embedding) citations = lexicalFallbackChunks(contract.extractedText, payload.question)
    else {
      const embeddingStr = `[${embedding.vector.join(",")}]`
      const rows = await db.$queryRaw<Array<{ chunkIndex: number; text: string; similarity: number }>>(Prisma.sql`
        SELECT cce."chunkIndex", cce."text", 1 - (cce."embedding" <=> ${embeddingStr}::vector) AS similarity
        FROM "ContractChunkEmbedding" cce
        INNER JOIN "Contract" c ON c."id" = cce."contractId"
        INNER JOIN "ContractAccessGrant" access_grant
          ON access_grant."contractId" = c."id"
          AND access_grant."organizationId" = ${data.organizationId}
          AND access_grant."memberId" = ${data.requestedByMemberId}
        WHERE cce."contractId" = ${contract.id}
          AND c."organizationId" = ${data.organizationId}
          AND cce."model" = ${embedding.model}
        ORDER BY cce."embedding" <=> ${embeddingStr}::vector
        LIMIT 5
      `).catch(() => [])
      citations = rows.length ? rows : lexicalFallbackChunks(contract.extractedText, payload.question)
    }
  } catch {
    return { status: 503, body: { error: "Retrieval failed" } }
  }
  if (!citations.length) return { status: 400, body: { error: "No usable contract text available for this contract" } }
  try {
    await assertAuthorizedForEgress()
    const answer = await answerContractQuestion(contract.title, buildContext(citations), payload.question, data.organizationId)
    return answer
      ? { status: 200, body: { answer, contractId: contract.id, contractTitle: contract.title, citations } }
      : { status: 503, body: { error: "No AI provider configured" } }
  } catch {
    return { status: 503, body: { error: "AI call failed" } }
  }
}

async function keywordSearch(data: InteractiveAiJobData, query: string, limit: number) {
  return getWorkerPrisma().contract.findMany({
    where: {
      organizationId: data.organizationId,
      accessGrants: { some: { organizationId: data.organizationId, memberId: data.requestedByMemberId } },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { counterpartyName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, contractType: true, status: true, counterpartyName: true, value: true, currency: true, endDate: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })
}

async function executeSemanticSearch(
  data: InteractiveAiJobData,
  payload: Extract<InteractiveAiPayload, { operation: "semantic_search" }>,
  assertAuthorizedForEgress: () => Promise<void>,
): Promise<InteractiveAiResponse> {
  const fallback = async () => {
    const results = await keywordSearch(data, payload.query, payload.limit)
    return { status: 200, body: { results, total: results.length, mode: "keyword" } } satisfies InteractiveAiResponse
  }
  let embedding
  try {
    await assertAuthorizedForEgress()
    embedding = await generateEmbedding(payload.query, data.organizationId)
  } catch {
    return fallback()
  }
  if (!embedding) return fallback()
  const embeddingStr = `[${embedding.vector.join(",")}]`
  try {
    const rows = await getWorkerPrisma().$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT c.id, c.title, c."contractType", c.status, c."counterpartyName", c.value,
        c.currency, c."endDate", c."createdAt", 1 - (ce.embedding <=> ${embeddingStr}::vector) AS similarity
      FROM "ContractEmbedding" ce
      INNER JOIN "Contract" c ON c.id = ce."contractId"
      INNER JOIN "ContractAccessGrant" access_grant
        ON access_grant."contractId" = c.id
        AND access_grant."organizationId" = ${data.organizationId}
        AND access_grant."memberId" = ${data.requestedByMemberId}
      WHERE c."organizationId" = ${data.organizationId}
        AND ce.model = ${embedding.model}
        AND 1 - (ce.embedding <=> ${embeddingStr}::vector) > ${payload.threshold}
      ORDER BY ce.embedding <=> ${embeddingStr}::vector
      LIMIT ${payload.limit}
    `)
    if (!rows.length) return fallback()
    return { status: 200, body: { results: rows, total: rows.length, mode: "semantic" } }
  } catch {
    return fallback()
  }
}

export async function executeInteractiveAiOperation(
  data: InteractiveAiJobData,
  payload: InteractiveAiPayload,
  assertAuthorizedForEgress: () => Promise<void>,
): Promise<InteractiveAiResponse> {
  if (payload.operation === "contract_question") return executeContractQuestion(data, payload, assertAuthorizedForEgress)
  if (payload.operation === "clause_explanation") {
    try {
      await assertAuthorizedForEgress()
      const result = await explainContractClause(payload.clauseText, data.organizationId)
      return result ? { status: 200, body: result } : { status: 503, body: { error: "ai_unavailable" } }
    } catch {
      return { status: 503, body: { error: "ai_call_failed" } }
    }
  }
  if (payload.operation === "semantic_search") return executeSemanticSearch(data, payload, assertAuthorizedForEgress)
  try {
    await assertAuthorizedForEgress()
    const result = await testAiProviderConnection({
      provider: payload.provider,
      credential: decrypt(payload.encryptedCredential),
      model: payload.model,
    })
    const blockedOllama = payload.provider === "ollama"
      && (result.error === "This Ollama URL is not allowed" || result.error === "Invalid Ollama base URL")
    return { status: blockedOllama ? 400 : 200, body: result }
  } catch {
    return { status: 200, body: { valid: false, error: "Network error — unable to reach provider" } }
  }
}

export const interactiveAiProcessorDependencies: InteractiveAiProcessorDependencies = {
  now: () => Date.now(),
  findMembership: (data) => getWorkerPrisma().member.findFirst({
    where: { id: data.requestedByMemberId, userId: data.requestedByUserId, organizationId: data.organizationId },
    select: { id: true, role: true },
  }),
  findApiKey: (data) => data.apiKeyId
    ? getWorkerPrisma().apiKey.findUnique({
      where: { id: data.apiKeyId },
      select: { id: true, organizationId: true, createdById: true, scopes: true, revokedAt: true, expiresAt: true },
    })
    : Promise.resolve(null),
  hasAgreementGrant: async (data) => Boolean(await getWorkerPrisma().contractAccessGrant.findFirst({
    where: { organizationId: data.organizationId, memberId: data.requestedByMemberId, contractId: data.contractId! },
    select: { id: true },
  })),
  findAuthorizedContractIds: async (data, contractIds) => {
    if (!contractIds.length) return []
    const grants = await getWorkerPrisma().contractAccessGrant.findMany({
      where: {
        organizationId: data.organizationId,
        memberId: data.requestedByMemberId,
        contractId: { in: contractIds },
      },
      select: { contractId: true },
    })
    return grants.map((grant) => grant.contractId)
  },
  execute: executeInteractiveAiOperation,
}
