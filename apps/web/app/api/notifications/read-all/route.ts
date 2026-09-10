import { resolveAuth } from "@/lib/auth/middleware"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

// POST /api/notifications/read-all
// Marks all unread notifications for the authenticated user as read.
export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key") return Response.json({ error: "human_session_required" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    const grants = isAgreementAccessEmergencyDenyAll()
      ? []
      : await prisma.contractAccessGrant.findMany({
        where: { organizationId: ctx.organizationId, memberId: ctx.memberId },
        select: { contractId: true },
      })
    const accessibleContractIds = grants.map((grant) => grant.contractId)
    // Mirror the same OR pattern from the GET route so cross-org org.invited
    // notifications (stored under the inviting org's ID) also get marked read.
    await prisma.notification.updateMany({
      where: {
        AND: [
          { userId: ctx.userId, read: false },
          {
            OR: [
              { organizationId: ctx.organizationId },
              { eventName: "org.invited" },
            ],
          },
          {
            OR: [
              { contractId: null },
              { organizationId: ctx.organizationId, contractId: { in: accessibleContractIds } },
            ],
          },
        ],
      },
      data: { read: true, readAt: new Date() },
    })

    return Response.json({ ok: true })
  })
}
