import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { enqueueImportProcess } from "@/lib/types/import-queue"
import { logger } from "@/lib/logger"

export async function POST(req: Request, { params }: { params: { jobId: string } }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    const claim = await prisma.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({
        where: { id: params.jobId },
        select: { id: true, organizationId: true, status: true, failedRows: true, completedAt: true },
      })
      if (!job || job.organizationId !== ctx.organizationId) {
        return { error: "Not Found" as const, status: 404 as const }
      }
      if (job.status !== "COMPLETED" && job.status !== "FAILED") {
        return { error: "job_not_finished" as const, status: 422 as const }
      }
      if (job.failedRows < 1) {
        return { error: "no_failed_rows" as const, status: 422 as const }
      }

      const claimed = await tx.importJob.updateMany({
        where: {
          id: job.id,
          organizationId: ctx.organizationId,
          status: { in: ["COMPLETED", "FAILED"] },
          failedRows: { gt: 0 },
        },
        data: { status: "PENDING", startedAt: null, completedAt: null },
      })
      if (claimed.count !== 1) {
        return { error: "retry_already_queued" as const, status: 409 as const }
      }
      return { job }
    })
    if ("error" in claim) {
      return Response.json({ error: claim.error }, { status: claim.status })
    }
    const { job } = claim

    try {
      await enqueueImportProcess({
        importJobId: job.id,
        organizationId: ctx.organizationId,
        createdById: ctx.userId,
      })
    } catch (err) {
      logger.error({ err, importJobId: job.id }, "[import.retry] enqueue failed")
      await prisma.importJob.updateMany({
        where: { id: job.id, organizationId: ctx.organizationId, status: "PENDING" },
        data: { status: job.status, completedAt: job.completedAt },
      })
      return Response.json({ error: "queue_unavailable" }, { status: 503 })
    }

    return Response.json({ jobId: job.id }, { status: 202 })
  })
}
