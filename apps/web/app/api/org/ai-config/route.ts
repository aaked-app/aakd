import { resolveAuth } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/db/client"
import { encrypt } from "@/lib/notifications/crypto"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { logger } from "@/lib/logger"
import { z } from "zod"

const UpsertSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("anthropic"),
    apiKey: z.string().min(1),
    model: z.string().optional(),
  }),
  z.object({
    provider: z.literal("openai"),
    apiKey: z.string().min(1),
    model: z.string().optional(),
  }),
  z.object({
    provider: z.literal("ollama"),
    baseUrl: z.string().url(),
    model: z.string().min(1),
  }),
])

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  const rl = await rateLimit(`${ctx.organizationId}:ai-config-read`, 30, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  const config = await prisma.orgAiConfig.findUnique({
    where: { organizationId: ctx.organizationId },
    select: { provider: true, model: true },
  })

  if (!config) {
    return Response.json({ provider: null, model: null, hasKey: false }, { headers: SECURE_HEADERS })
  }

  return Response.json({
    provider: config.provider,
    model: config.model,
    hasKey: true,
  }, { headers: SECURE_HEADERS })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  if (!hasRole(ctx.role, "legal")) {
    return new Response("Forbidden", { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { provider } = parsed.data

  // For Ollama we encrypt the base URL; for cloud providers we encrypt the API key.
  const credentialPlain =
    parsed.data.provider === "ollama" ? parsed.data.baseUrl : parsed.data.apiKey
  const model = parsed.data.provider === "ollama" ? parsed.data.model : (parsed.data.model ?? null)

  let encryptedKey: string
  try {
    encryptedKey = encrypt(credentialPlain)
  } catch (err) {
    logger.error({ err }, "[ai-config] encryption failed")
    return Response.json({ error: "Encryption not configured on this server" }, { status: 500 })
  }

  const config = await prisma.orgAiConfig.upsert({
    where: { organizationId: ctx.organizationId },
    create: {
      organizationId: ctx.organizationId,
      provider,
      encryptedKey,
      model: model ?? null,
    },
    update: {
      provider,
      encryptedKey,
      model: model ?? null,
    },
    select: { provider: true, model: true },
  })

  return Response.json({ provider: config.provider, model: config.model, hasKey: true }, { status: 200 })
}

export async function DELETE(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  if (!hasRole(ctx.role, "legal")) {
    return new Response("Forbidden", { status: 403 })
  }

  const rl = await rateLimit(`${ctx.organizationId}:ai-config-delete`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  await prisma.orgAiConfig.deleteMany({
    where: { organizationId: ctx.organizationId },
  })

  return new Response(null, { status: 204 })
}
