import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { z } from "zod"

const COMPLETED_BY_SELECT = { id: true, name: true } as const
const ROLES_CAN_WRITE = new Set(["owner", "admin", "legal", "member"])

const CreateSubTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export async function POST(
  req: Request,
  props: { params: AsyncRouteParams<{ id: string; obligationId: string }> }
) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (!ROLES_CAN_WRITE.has(ctx.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    // Org-scope guard. ContractObligation is org-scoped by middleware so
    // findUnique returns null for cross-tenant ids.
    const obligation = await prisma.contractObligation.findUnique({
      where: { id: params.obligationId },
      select: { id: true, contractId: true },
    })
    if (!obligation || obligation.contractId !== params.id) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = CreateSubTaskSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const subTask = await prisma.$transaction(async (tx) => {
      // Serialize creates for one obligation so concurrent requests cannot
      // both pass the existing 20-subtask cap.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('obligation-subtasks')::int, hashtext(${params.obligationId})::int)`
      const subTaskCount = await tx.obligationSubTask.count({
        where: { obligationId: params.obligationId },
      })
      if (subTaskCount >= 20) return null

      const created = await tx.obligationSubTask.create({
        data: {
          obligationId: params.obligationId,
          title: parsed.data.title,
        },
        include: { completedBy: { select: COMPLETED_BY_SELECT } },
      })

      await writeActivity(
        params.id,
        ctx.userId,
        "OBLIGATION_UPDATED",
        `Sub-task created: ${created.title}`,
        {
          obligationId: params.obligationId,
          subtaskId: created.id,
          subtaskOperation: "created",
        },
        tx,
      )
      return created
    })

    if (!subTask) {
      return Response.json({ error: "subtask_limit_reached" }, { status: 422 })
    }

    return Response.json(subTask, { status: 201 })
  })
}
