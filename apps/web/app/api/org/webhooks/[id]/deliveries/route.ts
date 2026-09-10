import { resolveAuth } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 50

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return n
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const roleErr = requireRole(ctx.role, "admin")
  if (roleErr) return roleErr

  return requestContext.run(ctx, async () => {
    const webhook = await prisma.outboundWebhook.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!webhook || webhook.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }
    const grants = isAgreementAccessEmergencyDenyAll()
      ? []
      : await prisma.contractAccessGrant.findMany({
        where: { organizationId: ctx.organizationId, memberId: ctx.memberId },
        select: { contractId: true },
      })
    const accessibleContractIds = grants.map((grant) => grant.contractId)

    const url = new URL(req.url)
    const page = parsePositiveInt(url.searchParams.get("page"), 1)
    const limit = Math.min(
      parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT,
    )
    const skip = (page - 1) * limit

    const [deliveries, total] = await Promise.all([
      prisma.webhookDeliveryLog.findMany({
        where: { webhookId: webhook.id, contractId: { in: accessibleContractIds } },
        select: {
          id: true,
          eventName: true,
          attempt: true,
          httpStatus: true,
          status: true,
          durationMs: true,
          deliveredAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.webhookDeliveryLog.count({
        where: { webhookId: webhook.id, contractId: { in: accessibleContractIds } },
      }),
    ])

    return Response.json({ deliveries, total })
  })
}
