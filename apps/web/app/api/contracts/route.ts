import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { agreementAccessWhere } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { generateAlertsForContract } from "@/lib/alerts/generate"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { fireAndLog } from "@/lib/utils/fire-and-log"
import { alertsCheckQueue } from "@/lib/jobs/queues"
import { requestLogger } from "@/lib/logger"
import { captureServerEvent } from "@/lib/posthog-server"
import { Prisma } from "@prisma/client"
import { CreateContractSchema, normalizeCreateContractInput, withoutContractIntakeIdentity } from "@/lib/contracts/create-schema"

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const log = requestLogger(ctx.requestId)

  return requestContext.run(ctx, async () => {
    const url = new URL(req.url)
    const status = url.searchParams.get("status") ?? undefined
    const contractType = url.searchParams.get("contractType") ?? undefined
    const ownerId = url.searchParams.get("ownerId") ?? undefined
    const folderId = url.searchParams.get("folderId") ?? undefined
    const tagId = url.searchParams.get("tagId") ?? undefined
    const search = url.searchParams.get("search") ?? undefined
    const page = (() => {
      const n = parseInt(url.searchParams.get("page") ?? "1", 10)
      return Number.isNaN(n) ? 1 : Math.max(1, n)
    })()
    const limit = (() => {
      const n = parseInt(url.searchParams.get("limit") ?? "20", 10)
      return Number.isNaN(n) ? 20 : Math.min(Math.max(1, n), 100)
    })()

    const where: Record<string, unknown> = { organizationId: ctx.organizationId }
    if (status) {
      where.status = status
    } else {
      // ARCHIVED is a soft-delete state — exclude it from the default listing.
      // Callers that explicitly want archived contracts can pass ?status=ARCHIVED.
      where.status = { not: "ARCHIVED" }
    }
    if (contractType) where.contractType = contractType
    if (ownerId) where.ownerId = ownerId
    if (folderId) where.folderId = folderId
    if (tagId) where.tags = { some: { id: tagId } }
    if (search) where.title = { contains: search, mode: "insensitive" }

    const authorizedWhere = agreementAccessWhere(ctx, where as Prisma.ContractWhereInput)
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where: authorizedWhere,
        select: {
          id: true,
          title: true,
          contractType: true,
          status: true,
          ownerId: true,
          counterpartyName: true,
          counterpartyContact: true,
          value: true,
          currency: true,
          governingLaw: true,
          startDate: true,
          endDate: true,
          renewalDate: true,
          noticePeriodDays: true,
          autoRenewal: true,
          renewalReminderEnabled: true,
          notes: ctx.source === "session" || Boolean(ctx.scopes?.includes("text_read")),
          organizationId: true,
          folderId: true,
          riskScore: true,
          riskScoredAt: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, email: true, image: true } },
          tags: true,
          folder: true,
          crmLinks: { select: { provider: true } },
          _count: { select: { files: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contract.count({ where: authorizedWhere }),
    ])

    log.info({ total, page, limit }, "[GET /contracts] listed")
    return Response.json({ contracts, total, page, limit }, { headers: SECURE_HEADERS })
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx?.memberId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const log = requestLogger(ctx.requestId)

  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  // Rate limit: 20 requests/min per org
  const rl = await rateLimit(`${ctx.organizationId}:create-contract`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  return requestContext.run(ctx, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    const parsed = CreateContractSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    let normalized
    try {
      normalized = normalizeCreateContractInput(parsed.data)
    } catch {
      return Response.json({ error: "Contract title is required" }, { status: 422 })
    }
    const { tagIds, folderId, startDate, endDate, renewalDate, ...rest } = normalized

    // Verify folder + tags belong to the caller's org before connecting them.
    // Prisma's `connect` does not re-check ownership, so without this an
    // attacker who guesses an id could attach a cross-tenant folder/tag.
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, organizationId: ctx.organizationId },
        select: { id: true },
      })
      if (!folder) {
        return Response.json({ error: "Folder not found in this organization" }, { status: 400 })
      }
    }
    if (tagIds.length > 0) {
      const found = await prisma.tag.findMany({
        where: { id: { in: tagIds }, organizationId: ctx.organizationId },
        select: { id: true },
      })
      if (found.length !== tagIds.length) {
        return Response.json({ error: "One or more tags not found in this organization" }, { status: 400 })
      }
    }

    // Use scalar FK instead of relation connect — middleware (lib/db/client.ts)
    // also injects organizationId as a scalar; Prisma 7 rejects having both a
    // scalar FK and a relation connect for the same field simultaneously.
    const data: Prisma.ContractUncheckedCreateInput = {
      ...rest,
      ownerId: ctx.userId,
      organizationId: ctx.organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      renewalDate: renewalDate ? new Date(renewalDate) : undefined,
      folderId: folderId ?? undefined,
      tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
    }

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data,
        include: {
          owner: { select: { id: true, name: true, email: true, image: true } },
          tags: true,
          folder: true,
        },
      })
      const grant = await tx.contractAccessGrant.create({
        data: {
          organizationId: ctx.organizationId,
          contractId: created.id,
          memberId: ctx.memberId!,
          grantedById: ctx.userId,
        },
      })
      await tx.activity.create({ data: { contractId: created.id, userId: ctx.userId, action: "CREATED", metadata: { requestId: ctx.requestId } } })
      await tx.activity.create({ data: { contractId: created.id, userId: ctx.userId, action: "ACCESS_GRANTED", metadata: { requestId: ctx.requestId, grantId: grant.id, targetMemberId: ctx.memberId } } })
      return created
    }, { isolationLevel: "Serializable" })
    log.info({ contractId: contract.id }, "[POST /contracts] created")

    captureServerEvent(ctx.userId, "contract_created", {
      contractType: parsed.data.contractType,
    })

    // Generate renewal alerts if date fields were provided (non-critical side-effect)
    if (endDate || renewalDate || parsed.data.noticePeriodDays != null) {
      fireAndLog(
        generateAlertsForContract(
          contract.id,
          endDate ? new Date(endDate) : null,
          renewalDate ? new Date(renewalDate) : null,
          parsed.data.noticePeriodDays ?? null,
          parsed.data.renewalReminderEnabled,
        ).then(() => alertsCheckQueue.add("after-contract-change", { triggeredAt: new Date().toISOString() })),
        "generateAlertsForContract:contractCreated",
      )
    }

    return Response.json(withoutContractIntakeIdentity(contract), { status: 201 })
  })
}
