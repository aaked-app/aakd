import { z } from "zod"
import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import {
  DEFAULT_EMAIL_ENABLED,
  NOTIFICATION_EVENTS,
  isNotificationEventName,
} from "@/lib/notifications/events"

const PutSchema = z.object({
  preferences: z.array(
    z.object({
      eventName: z.string(),
      emailEnabled: z.boolean(),
    }),
  ),
})

interface PreferenceEntry {
  eventName: string
  emailEnabled: boolean
}

async function loadFullPreferenceSet(
  userId: string,
  organizationId: string,
): Promise<PreferenceEntry[]> {
  const rows = await prisma.userNotificationPreference.findMany({
    where: { userId, organizationId },
    select: { eventName: true, emailEnabled: true },
  })
  const byEvent = new Map(rows.map((r) => [r.eventName, r.emailEnabled]))
  return NOTIFICATION_EVENTS.map((eventName) => ({
    eventName,
    emailEnabled: byEvent.has(eventName)
      ? byEvent.get(eventName)!
      : DEFAULT_EMAIL_ENABLED[eventName],
  }))
}

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const preferences = await loadFullPreferenceSet(
      ctx.userId,
      ctx.organizationId,
    )
    return Response.json({ preferences })
  })
}

export async function PUT(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    const parsed = PutSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const filtered = parsed.data.preferences.filter((p) =>
      isNotificationEventName(p.eventName),
    )

    await prisma.$transaction([
      prisma.userNotificationPreference.deleteMany({
        where: { userId: ctx.userId, organizationId: ctx.organizationId },
      }),
      prisma.userNotificationPreference.createMany({
        data: filtered.map((p) => ({
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          eventName: p.eventName,
          emailEnabled: p.emailEnabled,
        })),
        skipDuplicates: true,
      }),
    ])

    const preferences = await loadFullPreferenceSet(
      ctx.userId,
      ctx.organizationId,
    )
    return Response.json({ preferences })
  })
}
