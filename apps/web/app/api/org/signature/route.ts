import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { encrypt } from "@/lib/notifications/crypto"
import { testDocuSealConnection, type DocuSealConfig } from "@/lib/docuseal"
import { canonicalDocuSealBaseIdentity } from "@/lib/signature/resolve-config"
import { withTransactionRetry } from "@/lib/db/transaction-retry"
import { Prisma } from "@prisma/client"
import { z } from "zod"
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
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("invalid_base_url")
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/"
  return parsed.toString().replace(/\/$/, "")
}

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const integration = await prisma.signatureIntegration.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { id: true, provider: true, baseUrl: true, enabled: true, createdAt: true, updatedAt: true, connectedBy: { select: { name: true } } },
    })
    const row = integration as { id: string; provider: string; baseUrl: string; enabled: boolean; createdAt: Date; updatedAt: Date; connectedBy: { name: string } } | null
    return Response.json({
      connected: Boolean(row?.enabled),
      integration: row ? {
        provider: row.provider,
        baseUrl: row.baseUrl,
        enabled: row.enabled,
        connectedAt: row.createdAt,
        connectedBy: row.connectedBy,
        webhookUrl: new URL(`/api/webhooks/docuseal?integrationId=${encodeURIComponent(row.id)}`, req.url).toString(),
      } : null,
    })
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })
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
    const result = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      // Any future provider-binding mutation must take this parent lock first.
      // It serializes the integration origin with organization-owned bindings.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${ctx.organizationId} FOR UPDATE`)
      const existing = await tx.signatureIntegration.findUnique({
        where: { organizationId: ctx.organizationId },
        select: { id: true, baseUrl: true },
      })
      if (existing && canonicalDocuSealBaseIdentity(existing.baseUrl) !== canonicalDocuSealBaseIdentity(baseUrl)) {
        const referenced = await tx.contract.findFirst({
          where: {
            organizationId: ctx.organizationId,
            docusealSubmissionId: { not: null },
            OR: [
              { signatureProviderId: `integration:${existing.id}` },
              { signatureProviderId: null },
            ],
          },
          select: { id: true },
        })
        if (referenced) return { conflict: true as const, integration: null }
      }

      const integration = await tx.signatureIntegration.upsert({
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
      return { conflict: false as const, integration }
    }, { isolationLevel: "Serializable" }))
    if (result.conflict) return Response.json({ error: "docuseal_origin_in_use" }, { status: 409 })
    return Response.json({ connected: true, integration: result.integration })
  })
}

export async function DELETE(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })
  if (!canManage(ctx.role)) return Response.json({ error: "Only owners, administrators, or legal users may manage integrations" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${ctx.organizationId} FOR UPDATE`)
      await tx.signatureIntegration.updateMany({
        where: { organizationId: ctx.organizationId, enabled: true },
        data: { enabled: false },
      })
    }, { isolationLevel: "Serializable" }))
    return Response.json({ connected: false })
  })
}
