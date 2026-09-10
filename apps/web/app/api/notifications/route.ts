import { resolveAuth } from "@/lib/auth/middleware"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

// GET /api/notifications
// Returns the last 30 notifications for the authenticated user.
// The Notification model is NOT org-scoped via middleware, so we query
// explicitly by userId (and organizationId for safety).
export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const grants = isAgreementAccessEmergencyDenyAll()
      ? []
      : await prisma.contractAccessGrant.findMany({
        where: { organizationId: ctx.organizationId, memberId: ctx.memberId },
        select: { contractId: true },
      })
    const accessibleContractIds = grants.map((grant) => grant.contractId)
    // `org.invited` notifications are stored under the *inviting* org's ID —
    // an org the invitee hasn't joined yet and therefore isn't their active org.
    // Only a human session may see cross-org invitations. A key's authority
    // stops at the organization for which it was issued.
    const notifWhere = {
      AND: [
        { userId: ctx.userId },
        {
          OR: [
            { organizationId: ctx.organizationId },
            ...(ctx.source === "session" ? [{ eventName: "org.invited" }] : []),
          ],
        },
        {
          OR: [
            { contractId: null },
            { organizationId: ctx.organizationId, contractId: { in: accessibleContractIds } },
          ],
        },
      ],
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: notifWhere,
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          contractId: true,
          eventName: true,
          title: true,
          body: true,
          actionUrl: true,
          read: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { ...notifWhere, read: false },
      }),
    ])

    return Response.json({ notifications: ctx.source === "session" ? notifications : notifications.map(row => ({
      id: row.id, contractId: row.contractId, eventName: row.eventName,
      title: row.title, read: row.read, readAt: row.readAt, createdAt: row.createdAt,
    })), unreadCount })
  })
}
