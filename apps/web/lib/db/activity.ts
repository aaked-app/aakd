import { prisma } from "@/lib/db/client"
import { getRequestContext } from "@/lib/context"
import { ActivityAction } from "@prisma/client"

export async function writeActivity(
  contractId: string,
  userId: string | null,
  action: ActivityAction,
  detail?: string,
  metadata?: Record<string, unknown>
) {
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

  return prisma.activity.create({
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
