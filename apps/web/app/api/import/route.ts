import { resolveAuth } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { Prisma } from "@prisma/client"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"

type AccessibleImportJob = {
  id: string
  source: string
  status: string
  totalRows: number
  succeededRows: number
  failedRows: number
  hasErrorReport: boolean
  createdAt: Date
  completedAt: Date | null
  createdById: string
  createdByName: string | null
  accessibleTotal: bigint
}

// GET /api/import — list import jobs for the org, paginated
export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError

  return requestContext.run(ctx, async () => {
    const url = new URL(req.url)
    const page = (() => {
      const n = parseInt(url.searchParams.get("page") ?? "1", 10)
      return Number.isNaN(n) ? 1 : Math.max(1, n)
    })()
    const limit = (() => {
      const n = parseInt(url.searchParams.get("limit") ?? "20", 10)
      return Number.isNaN(n) ? 20 : Math.min(Math.max(1, n), 100)
    })()
    if (isAgreementAccessEmergencyDenyAll()) {
      return Response.json({ jobs: [], total: 0, page, limit })
    }

    const jobs = await prisma.$queryRaw<AccessibleImportJob[]>(Prisma.sql`
      SELECT job."id", job."source"::text AS "source", job."status"::text AS "status",
             job."totalRows", job."succeededRows", job."failedRows", job."createdAt", job."completedAt",
             creator."id" AS "createdById", creator."name" AS "createdByName",
             (job."errorReportKey" IS NOT NULL AND job."errorReportKey" <> '') AS "hasErrorReport",
             COUNT(*) OVER()::bigint AS "accessibleTotal"
      FROM "ImportJob" AS job
      INNER JOIN "User" AS creator ON creator."id" = job."createdById"
      WHERE job."organizationId" = ${ctx.organizationId}
        AND NOT EXISTS (
          SELECT 1 FROM "ImportRow" AS inaccessible_row
          WHERE inaccessible_row."jobId" = job."id"
            AND inaccessible_row."contractId" IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ContractAccessGrant" AS access_grant
              WHERE access_grant."organizationId" = ${ctx.organizationId}
                AND access_grant."memberId" = ${ctx.memberId}
                AND access_grant."contractId" = inaccessible_row."contractId"
            )
        )
        AND (
          job."createdById" = ${ctx.userId}
          OR (
            EXISTS (SELECT 1 FROM "ImportRow" AS present_row WHERE present_row."jobId" = job."id")
            AND NOT EXISTS (
              SELECT 1 FROM "ImportRow" AS unbound_row
              WHERE unbound_row."jobId" = job."id" AND unbound_row."contractId" IS NULL
            )
          )
        )
      ORDER BY job."createdAt" DESC
      OFFSET ${(page - 1) * limit}
      LIMIT ${limit}
    `)
    const total = jobs.length > 0 ? Number(jobs[0].accessibleTotal) : 0

    return Response.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        source: job.source,
        status: job.status,
        totalRows: job.totalRows,
        succeededRows: job.succeededRows,
        failedRows: job.failedRows,
        hasErrorReport: job.hasErrorReport,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        createdBy: { id: job.createdById, name: job.createdByName },
      })),
      total,
      page,
      limit,
    })
  })
}
