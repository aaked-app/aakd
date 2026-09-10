import { randomUUID } from "node:crypto"
import { z } from "zod"

import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { hasRole } from "@/lib/auth/roles"

export const INTERACTIVE_AI_TTL_MS = 300_000

const operationSchema = z.enum([
  "contract_question",
  "clause_explanation",
  "semantic_search",
  "config_test",
])

export type InteractiveAiOperation = z.infer<typeof operationSchema>

export const interactiveAiJobDataSchema = z.object({
  jobId: z.string().uuid(),
  operation: operationSchema,
  organizationId: z.string().min(1).max(200),
  requestedByUserId: z.string().min(1).max(200),
  requestedByMemberId: z.string().min(1).max(200),
  source: z.enum(["session", "api_key"]),
  apiKeyId: z.string().min(1).max(200).nullable(),
  contractId: z.string().min(1).max(200).nullable(),
  payloadKey: z.string().min(1).max(1000),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
})

export type InteractiveAiJobData = z.infer<typeof interactiveAiJobDataSchema>

export const interactiveAiPayloadSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("contract_question"), question: z.string().trim().min(1).max(2000) }),
  z.object({ operation: z.literal("clause_explanation"), clauseText: z.string().trim().min(1).max(3000) }),
  z.object({
    operation: z.literal("semantic_search"),
    query: z.string().trim().min(1).max(2000),
    limit: z.number().int().min(1).max(50),
    threshold: z.number().min(0).max(1),
  }),
  z.object({
    operation: z.literal("config_test"),
    provider: z.enum(["anthropic", "openai", "ollama"]),
    encryptedCredential: z.string().min(1).max(100_000),
    model: z.string().trim().min(1).max(500).nullable(),
  }),
])

export type InteractiveAiPayload = z.infer<typeof interactiveAiPayloadSchema>

export const interactiveAiResponseSchema = z.object({
  status: z.number().int().min(200).max(599),
  body: z.record(z.string(), z.unknown()),
})

export type InteractiveAiResponse = z.infer<typeof interactiveAiResponseSchema>

type JobIdentity = Pick<InteractiveAiJobData,
  "jobId" | "organizationId" | "requestedByMemberId"
>

export function interactiveAiPayloadKey(data: JobIdentity): string {
  return `aakd:ai-request:${encodeURIComponent(data.organizationId)}:${encodeURIComponent(data.requestedByMemberId)}:${encodeURIComponent(data.jobId)}:payload`
}

export function interactiveAiResultKey(data: JobIdentity): string {
  return `aakd:ai-request:${encodeURIComponent(data.organizationId)}:${encodeURIComponent(data.requestedByMemberId)}:${encodeURIComponent(data.jobId)}:result`
}

export function createInteractiveAiJobData(
  input: Omit<InteractiveAiJobData, "payloadKey">,
): InteractiveAiJobData {
  const data = interactiveAiJobDataSchema.parse({
    ...input,
    payloadKey: interactiveAiPayloadKey(input),
  })
  if (data.expiresAt !== data.createdAt + INTERACTIVE_AI_TTL_MS) {
    throw new Error("Interactive AI expiry must be exactly five minutes")
  }
  if ((data.source === "api_key") !== Boolean(data.apiKeyId)) {
    throw new Error("Interactive AI API-key identity is invalid")
  }
  if ((data.operation === "contract_question" || data.operation === "clause_explanation") !== Boolean(data.contractId)) {
    throw new Error("Interactive AI contract identity is invalid")
  }
  return data
}

export function newInteractiveAiJobData(input: Omit<InteractiveAiJobData, "jobId" | "payloadKey" | "createdAt" | "expiresAt">): InteractiveAiJobData {
  const createdAt = Date.now()
  return createInteractiveAiJobData({
    ...input,
    jobId: randomUUID(),
    createdAt,
    expiresAt: createdAt + INTERACTIVE_AI_TTL_MS,
  })
}

type CurrentMembership = { id: string; role: string }
type CurrentApiKey = {
  id: string
  organizationId: string
  createdById: string
  scopes: string[]
  revokedAt: Date | null
  expiresAt: Date | null
}

export interface InteractiveAiProcessorDependencies {
  now(): number
  findMembership(data: InteractiveAiJobData): Promise<CurrentMembership | null>
  findApiKey(data: InteractiveAiJobData): Promise<CurrentApiKey | null>
  hasAgreementGrant(data: InteractiveAiJobData): Promise<boolean>
  findAuthorizedContractIds(data: InteractiveAiJobData, contractIds: string[]): Promise<string[]>
  execute(
    data: InteractiveAiJobData,
    payload: InteractiveAiPayload,
    assertAuthorizedForEgress: () => Promise<void>,
  ): Promise<InteractiveAiResponse>
}

function requiresTextRead(operation: InteractiveAiOperation): boolean {
  return operation === "contract_question" || operation === "clause_explanation"
}

function requiresAgreementGrant(operation: InteractiveAiOperation): boolean {
  return operation === "contract_question" || operation === "clause_explanation"
}

async function assertCurrentAuthorization(
  data: InteractiveAiJobData,
  dependencies: InteractiveAiProcessorDependencies,
): Promise<void> {
  if (isAgreementAccessEmergencyDenyAll()) throw new Error("Agreement processing disabled by emergency policy")
  const member = await dependencies.findMembership(data)
  if (!member || member.id !== data.requestedByMemberId) {
    throw new Error("Interactive AI requester is no longer authorized")
  }
  if (data.operation === "config_test" && (data.source !== "session" || !hasRole(member.role, "admin"))) {
    throw new Error("Interactive AI connectivity test requires a current admin session")
  }
  if (data.source === "api_key") {
    const apiKey = await dependencies.findApiKey(data)
    if (
      !apiKey
      || apiKey.id !== data.apiKeyId
      || apiKey.organizationId !== data.organizationId
      || apiKey.createdById !== data.requestedByUserId
      || apiKey.revokedAt
      || (apiKey.expiresAt && apiKey.expiresAt.getTime() <= dependencies.now())
      || (requiresTextRead(data.operation) && !apiKey.scopes.includes("text_read"))
    ) {
      throw new Error("Interactive AI API key is no longer authorized")
    }
  }
  if (requiresAgreementGrant(data.operation) && !(await dependencies.hasAgreementGrant(data))) {
    throw new Error("Interactive AI agreement access is no longer authorized")
  }
}

export async function authorizeInteractiveAiResponse(
  data: InteractiveAiJobData,
  rawResponse: InteractiveAiResponse,
  dependencies: InteractiveAiProcessorDependencies,
): Promise<InteractiveAiResponse> {
  if (dependencies.now() >= data.expiresAt) throw new Error("Interactive AI request expired")
  await assertCurrentAuthorization(data, dependencies)
  const response = interactiveAiResponseSchema.parse(rawResponse)
  if (data.operation !== "semantic_search" || response.status !== 200) return response

  const results = Array.isArray(response.body.results) ? response.body.results : []
  const identified = results.filter((value): value is Record<string, unknown> & { id: string } => (
    Boolean(value) && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
  ))
  const authorizedIds = new Set(await dependencies.findAuthorizedContractIds(
    data,
    [...new Set(identified.map((value) => value.id))],
  ))
  const authorizedResults = identified.filter((value) => authorizedIds.has(value.id))
  return {
    status: response.status,
    body: {
      results: authorizedResults,
      total: authorizedResults.length,
      mode: response.body.mode === "semantic" ? "semantic" : "keyword",
    },
  }
}

export async function processInteractiveAiRequest(
  rawData: InteractiveAiJobData,
  loadPayload: (data: InteractiveAiJobData) => Promise<unknown>,
  dependencies: InteractiveAiProcessorDependencies,
): Promise<InteractiveAiResponse> {
  const data = interactiveAiJobDataSchema.parse(rawData)
  if (data.payloadKey !== interactiveAiPayloadKey(data)) throw new Error("Invalid interactive AI payload key")
  if (dependencies.now() >= data.expiresAt) throw new Error("Interactive AI request expired")
  await assertCurrentAuthorization(data, dependencies)
  const payload = interactiveAiPayloadSchema.parse(await loadPayload(data))
  if (payload.operation !== data.operation) throw new Error("Interactive AI operation mismatch")
  if (dependencies.now() >= data.expiresAt) throw new Error("Interactive AI request expired")
  await assertCurrentAuthorization(data, dependencies)
  const response = interactiveAiResponseSchema.parse(await dependencies.execute(
    data,
    payload,
    () => assertCurrentAuthorization(data, dependencies),
  ))
  return authorizeInteractiveAiResponse(data, response, dependencies)
}
