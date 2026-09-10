import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth/config"
import { prisma } from "@/lib/db/client"
import type { RequestContext } from "@/lib/context"
import { requestIdFrom } from "@/lib/security/request"

export async function resolveAuth(req: Request): Promise<RequestContext | null> {
  // Read the request ID from the incoming request header (set by Next.js middleware)
  const requestId = requestIdFrom(req.headers.get("x-request-id"))
  const authorization = req.headers.get("Authorization")
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const hasApiKeyAuth = bearer?.startsWith("cf_live_") === true
  // An explicit credential is authoritative even when malformed or from an
  // unsupported scheme. It must never borrow a browser cookie's authority.
  if (authorization !== null && !hasApiKeyAuth) return null

  // Path 1: Better Auth session (browser)
  // A bearer API key is authoritative. Never fall back to a browser session
  // when a caller explicitly supplied a cf_live_ token, otherwise a revoked
  // or invalid key could still succeed through a session cookie.
  if (!hasApiKeyAuth) {
    try {
      const session = await auth.api.getSession({ headers: req.headers })
      if (session?.user) {
        // Prefer the session's activeOrganizationId; fall back to the user's
        // first membership if it was never set (e.g. setActive() race on signup).
        const orgId = session.session.activeOrganizationId ?? null

        const member = orgId
          ? await prisma.member.findUnique({
              where: {
                userId_organizationId: {
                  userId: session.user.id,
                  organizationId: orgId,
                },
              },
            })
          : await prisma.member.findFirst({
              where: { userId: session.user.id },
              orderBy: { createdAt: "asc" },
            })

        if (member) {
          return {
            userId: session.user.id,
            organizationId: member.organizationId,
            memberId: member.id,
            role: member.role,
            source: "session",
            requestId,
          }
        }
      }
    } catch {}
  }

  // Path 2: API key (Bearer token for agents)
  if (hasApiKeyAuth) {
    const lookupHash = createHash("sha256").update(bearer).digest("hex")
    const apiKey = await prisma.apiKey.findUnique({
      where: { lookupHash },
      select: { id: true, keyHash: true, organizationId: true, scopes: true, createdById: true, revokedAt: true, expiresAt: true },
    })

    if (
      apiKey &&
      // `read` is foundational, explicit authority for every software key.
      // Never infer it from legacy write, text access, or proposal scopes.
      apiKey.scopes?.includes("read") &&
      !apiKey.revokedAt &&
      (!apiKey.expiresAt || apiKey.expiresAt > new Date()) &&
      (await bcrypt.compare(bearer, apiKey.keyHash))
    ) {
      // A key cannot outlive its creator's access to this organization.
      const creatorMember = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId: apiKey.createdById,
            organizationId: apiKey.organizationId,
          },
        },
        select: { id: true, role: true },
      })

      if (!creatorMember) return null
      prisma.apiKey.update({ where: { lookupHash }, data: { lastUsedAt: new Date() } }).catch(() => {})

      return {
        userId: apiKey.createdById,
        organizationId: apiKey.organizationId,
        memberId: creatorMember.id,
        role: creatorMember.role,
        scopes: apiKey.scopes,
        apiKeyId: apiKey.id,
        source: "api_key",
        requestId,
      }
    }
  }

  return null
}

export function requireAuth(ctx: RequestContext | null): ctx is RequestContext {
  return ctx !== null
}

/**
 * Legacy unrestricted bearer mutations are paused until they have governed
 * preview, version, replay and approval contracts. Keep the compatibility
 * helper name, but never reinterpret an existing write key as action_propose.
 * Session routes retain their own role/resource checks. Governed proposals
 * use a separate, narrower capability check.
 */
export function requireWriteScope(ctx: RequestContext): Response | null {
  if (ctx.source !== "api_key") return null
  return Response.json(
    { error: "legacy_api_key_mutations_disabled" },
    { status: 403 },
  )
}
