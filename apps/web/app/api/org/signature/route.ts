import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { encrypt } from "@/lib/notifications/crypto"
import { testDocuSealConnection, type DocuSealConfig } from "@/lib/docuseal"
import { z } from "zod"
type SignatureDb = {
  findUnique: (args: unknown) => Promise<unknown>
  upsert: (args: unknown) => Promise<unknown>
  deleteMany: (args: unknown) => Promise<unknown>
}
const signatureDb = (prisma as unknown as { signatureIntegration: SignatureDb }).signatureIntegration

const bodySchema = z.object({
  provider: z.literal("DOCUSEAL"),
  baseUrl: z.string().url().max(500),
  apiKey: z.string().min(1).max(500),
  webhookSecret: z.string().max(500).optional().or(z.literal("")),
})

function canManage(role: string): boolean {
  return role === "owner" || role === "admin" || role === "legal"
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid_protocol")
  if (parsed.username || parsed.password) throw new Error("credentials_not_allowed")
  return parsed.toString().replace(/\/$/, "")
}

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const integration = await signatureDb.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { provider: true, baseUrl: true, enabled: true, createdAt: true, updatedAt: true, connectedBy: { select: { name: true } } },
    })
    const row = integration as { provider: string; baseUrl: string; enabled: boolean; createdAt: Date; updatedAt: Date; connectedBy: { name: string } } | null
    return Response.json({
      connected: Boolean(row?.enabled),
      integration: row ? {
        provider: row.provider,
        baseUrl: row.baseUrl,
        enabled: row.enabled,
        connectedAt: row.createdAt,
        connectedBy: row.connectedBy,
      } : null,
    })
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (!canManage(ctx.role)) return Response.json({ error: "Only owners, administrators, or legal users may manage integrations" }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  let baseUrl: string
  try {
    baseUrl = normalizeBaseUrl(parsed.data.baseUrl)
  } catch {
    return Response.json({ error: "Invalid provider URL" }, { status: 422 })
  }

  const config: DocuSealConfig = { baseUrl, apiKey: parsed.data.apiKey }
  if (!(await testDocuSealConnection(config))) {
    return Response.json({ error: "Could not connect to DocuSeal. Check the URL and API key." }, { status: 422 })
  }

  return requestContext.run(ctx, async () => {
    const integration = await signatureDb.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        provider: "DOCUSEAL",
        baseUrl,
        encryptedApiKey: encrypt(parsed.data.apiKey),
        encryptedWebhookSecret: parsed.data.webhookSecret ? encrypt(parsed.data.webhookSecret) : null,
        connectedById: ctx.userId,
      },
      update: {
        provider: "DOCUSEAL",
        baseUrl,
        encryptedApiKey: encrypt(parsed.data.apiKey),
        encryptedWebhookSecret: parsed.data.webhookSecret ? encrypt(parsed.data.webhookSecret) : undefined,
        enabled: true,
        connectedById: ctx.userId,
      },
      select: { provider: true, baseUrl: true, enabled: true, createdAt: true },
    })
    return Response.json({ connected: true, integration })
  })
}

export async function DELETE(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (!canManage(ctx.role)) return Response.json({ error: "Only owners, administrators, or legal users may manage integrations" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    await signatureDb.deleteMany({ where: { organizationId: ctx.organizationId } })
    return Response.json({ connected: false })
  })
}
