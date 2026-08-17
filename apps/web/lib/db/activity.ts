import { getRequestContext } from "@/lib/context"
import type { ActivityAction, PrismaClient } from "@prisma/client"

type ActivityClient = {
  activity: Pick<PrismaClient["activity"], "create">
}

async function getDefaultActivityClient(): Promise<ActivityClient> {
  const { prisma } = await import("@/lib/db/client")
  return prisma
}

export async function writeActivity(
  contractId: string,
  userId: string | null,
  action: ActivityAction,
  detail?: string,
  metadata?: Record<string, unknown>,
  db?: ActivityClient,
) {
  const activityClient = db ?? await getDefaultActivityClient()
  const request = getRequestContext()
  const auditMetadata = {
    ...(metadata ?? {}),
    ...(request
      ? {
          requestSource: request.source,
          requestId: request.requestId,
        }
      : {}),
  }

  return activityClient.activity.create({
    data: {
      contractId,
      userId,
      actorLabel: userId ? undefined : "System",
      action,
      detail,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: Object.keys(auditMetadata).length > 0 ? (auditMetadata as any) : undefined,
    },
  })
}
