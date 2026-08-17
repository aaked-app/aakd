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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importJobModel = prisma.importJob
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!importJobModel) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const job = await importJobModel.findUnique({
      where: { id: params.jobId },
      select: { id: true, organizationId: true, status: true, failedRows: true, completedAt: true },
    })
    if (!job || job.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (job.status !== "COMPLETED" && job.status !== "FAILED") {
      return Response.json({ error: "job_not_finished" }, { status: 422 })
    }
    if (job.failedRows < 1) {
      return Response.json({ error: "no_failed_rows" }, { status: 422 })
    }

    const claimed = await importJobModel.updateMany({
      where: {
        id: job.id,
        organizationId: ctx.organizationId,
        status: { in: ["COMPLETED", "FAILED"] },
        failedRows: { gt: 0 },
      },
      data: { status: "PENDING", startedAt: null, completedAt: null },
    })
    if (claimed.count !== 1) {
      return Response.json({ error: "retry_already_queued" }, { status: 409 })
    }

    try {
      await enqueueImportProcess({
        importJobId: job.id,
        organizationId: ctx.organizationId,
        createdById: ctx.userId,
      })
    } catch (err) {
      logger.error({ err, importJobId: job.id }, "[import.retry] enqueue failed")
      await importJobModel.updateMany({
        where: { id: job.id, organizationId: ctx.organizationId, status: "PENDING" },
        data: { status: job.status, completedAt: job.completedAt },
      })
      return Response.json({ error: "queue_unavailable" }, { status: 503 })
    }

    return Response.json({ jobId: job.id }, { status: 202 })
  })
}
