import { resolveAuth } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { hasImportJobAccess } from "@/lib/auth/import-job-access"

const FULL_ROW_THRESHOLD = 200

export async function GET(req: Request, props: { params: AsyncRouteParams<{ jobId: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError
  if (ctx.source === "api_key" && !ctx.scopes?.includes("text_read")) {
    return Response.json({ error: "text_read scope required" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importJobModel = prisma.importJob
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importRowModel = prisma.importRow
    if (!importJobModel || !importRowModel) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const job = await importJobModel.findUnique({
      where: { id: params.jobId },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    if (!job || job.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }
    if (!(await hasImportJobAccess(prisma, ctx, job))) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const where =
      job.totalRows > FULL_ROW_THRESHOLD
        ? { jobId: job.id, status: "failed" }
        : { jobId: job.id }

    const rows = await importRowModel.findMany({
      where,
      orderBy: { rowIndex: "asc" },
      select: {
        id: true,
        rowIndex: true,
        sourceRef: true,
        status: true,
        errorMessage: true,
        contractId: true,
      },
    })

    return Response.json({ job: {
      id: job.id, source: job.source, status: job.status,
      totalRows: job.totalRows, succeededRows: job.succeededRows, failedRows: job.failedRows,
      createdAt: job.createdAt, startedAt: job.startedAt, completedAt: job.completedAt,
      createdBy: job.createdBy, hasErrorReport: Boolean(job.errorReportKey),
    }, rows })
  })
}
