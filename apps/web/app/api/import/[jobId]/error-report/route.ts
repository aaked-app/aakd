import { resolveAuth } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { storage } from "@/lib/storage"
import { logger } from "@/lib/logger"
import { hasImportJobAccess } from "@/lib/auth/import-job-access"

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
    if (!importJobModel) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const job = await importJobModel.findUnique({
      where: { id: params.jobId },
      select: { id: true, organizationId: true, errorReportKey: true, createdById: true },
    })
    if (!job || job.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }
    if (!(await hasImportJobAccess(prisma, ctx, job))) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }
    if (!job.errorReportKey) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    try {
      const object = await storage.getObject(job.errorReportKey, 50 * 1024 * 1024)
      // Revocation while storage is being read must also prevent the response.
      if (!(await hasImportJobAccess(prisma, ctx, job))) {
        return Response.json({ error: "Not Found" }, { status: 404 })
      }
      return new Response(Buffer.from(object.body), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="import-errors.csv"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch {
      logger.error({ importJobId: params.jobId }, "[import.error-report] download failed")
      return Response.json({ error: "download_failed" }, { status: 502 })
    }
  })
}
