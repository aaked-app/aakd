import { resolveAuth } from "@/lib/auth/middleware"
import { auth } from "@/lib/auth/config"
import { prisma } from "@/lib/db/client"
import { fireAndLog } from "@/lib/utils/fire-and-log"

// ─── POST /api/org/invitations/[id]/accept ────────────────────────────────────
// Accepts a pending invitation for the currently logged-in user.
// Validates email match, creates the Member row, marks invitation accepted.

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveAuth(req)
  // An invited user is not a member of this organization yet, so resolveAuth()
  // intentionally returns null for their otherwise-valid session. Fall back to
  // Better Auth's session lookup only for this bootstrap transition.
  const session = ctx ? null : await auth.api.getSession({ headers: req.headers })
  const userId = ctx?.userId ?? session?.user?.id
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const invitation = await prisma.invitation.findUnique({
    where: { id: params.id },
  })

  if (!invitation) {
    return Response.json({ error: "Invitation not found" }, { status: 404 })
  }

  if (invitation.status === "pending" && invitation.expiresAt < new Date()) {
    return Response.json({ error: "expired" }, { status: 410 })
  }

  // Verify the logged-in user's email matches the invitation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return Response.json(
      { error: "email_mismatch", message: "This invitation was sent to a different email address." },
      { status: 403 },
    )
  }

  if (invitation.status !== "pending") {
    // A session refresh can repeat the accept request after the first request
    // has committed. Make that retry safe for the same invitee only.
    if (invitation.status === "accepted") {
      const acceptedMember = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invitation.organizationId,
          },
        },
      })
      if (acceptedMember) {
        return Response.json({
          organizationId: invitation.organizationId,
          role: acceptedMember.role,
          alreadyMember: true,
        })
      }
    }
    return Response.json({ error: "already_accepted" }, { status: 409 })
  }

  // Check if already a member
  const existing = await prisma.member.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: invitation.organizationId,
      },
    },
  })

  if (existing) {
    // Already a member — mark invitation accepted and return the org so the
    // frontend can still call setActive and redirect to dashboard.
    await prisma.invitation.update({
      where: { id: params.id },
      data: { status: "accepted" },
    })
    return Response.json({ organizationId: invitation.organizationId, alreadyMember: true })
  }

  // Create the Member record and mark invitation accepted in a transaction
  const [member] = await prisma.$transaction([
    prisma.member.create({
      data: {
        id: `${userId}-${invitation.organizationId}`.slice(0, 36),
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role ?? "member",
        createdAt: new Date(),
      },
    }),
    prisma.invitation.update({
      where: { id: params.id },
      data: { status: "accepted" },
    }),
  ])

  // Notify org admins & owners that a new member joined (non-critical side-effect)
  fireAndLog(
    Promise.all([
      prisma.member.findMany({
        where: {
          organizationId: invitation.organizationId,
          role: { in: ["admin", "owner"] },
          NOT: { userId },
        },
        select: { userId: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ]).then(([admins, newUser]) => {
      const displayName = newUser?.name || newUser?.email || "Someone"
      return Promise.all(
        admins.map((a) =>
          prisma.notification.create({
            data: {
              userId: a.userId,
              organizationId: invitation.organizationId,
              contractId: null,
              eventName: "member.joined",
              title: "New member joined",
              body: `${displayName} joined your organization`,
            },
          }),
        ),
      )
    }),
    "prisma.notification.create:member.joined",
  )

  return Response.json({
    organizationId: member.organizationId,
    role: member.role,
  })
}
