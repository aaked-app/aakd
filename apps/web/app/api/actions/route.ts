import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { ACTION_LIST_SELECT, toActionListItem } from "@/lib/actions/dto"
import { orderPriorityActions } from "@/lib/actions/priority"
import { SECURE_HEADERS } from "@/lib/api-headers"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

const ACTION_STATUSES = [
  "PROPOSED",
  "PENDING_REVIEW",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
  "STALE",
  "DISMISSED",
] as const
const OPEN_STATUSES = ["PROPOSED", "PENDING_REVIEW", "ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED", "STALE"] as const
const ACTION_KINDS = ["OBLIGATION", "RENEWAL_NOTICE", "EXPIRY", "CUSTOM"] as const
const ACTION_VIEWS = ["my_work", "needs_review", "due_soon", "blocked", "completed", "dashboard", "open"] as const
const QuerySchema = z.object({
  view: z.enum(ACTION_VIEWS).optional(),
  status: z.enum(ACTION_STATUSES).optional(),
  ownerId: z.string().min(1).optional(),
  contractId: z.string().min(1).optional(),
  kind: z.enum(ACTION_KINDS).optional(),
  page: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1).optional(),
  limit: z.coerce.number().int().safe().min(1).max(100).optional(),
})
const DAY_MS = 86_400_000

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: SECURE_HEADERS })
    const { view, status, ownerId, contractId, kind } = parsed.data
    const page = parsed.data.page ?? 1
    const limit = parsed.data.limit ?? 50
    const now = new Date()
    const where: Prisma.ContractActionWhereInput = {
      organizationId: ctx.organizationId,
      ...(status ? { status } : {}),
      ...(ownerId ? { assigneeId: ownerId } : {}),
      ...(contractId ? { contractId } : {}),
      ...(kind ? { kind } : {}),
    }

    if (view === "my_work") Object.assign(where, { assigneeId: ctx.userId, status: { in: [...OPEN_STATUSES] } })
    if (view === "needs_review") Object.assign(where, { status: { in: ["PENDING_REVIEW", "STALE"] } })
    if (view === "due_soon") Object.assign(where, {
      status: { in: [...OPEN_STATUSES] },
      dueDate: { gte: now, lte: new Date(now.getTime() + 30 * DAY_MS) },
    })
    if (view === "blocked") Object.assign(where, { status: "BLOCKED" })
    if (view === "completed") Object.assign(where, { status: "COMPLETED" })
    if (view === "dashboard" || view === "open") Object.assign(where, { status: { in: [...OPEN_STATUSES] } })

    if (view === "dashboard") {
      const rows = await prisma.contractAction.findMany({ where, select: ACTION_LIST_SELECT })
      const ordered = orderPriorityActions(rows, now)
      return Response.json({
        actions: ordered.slice(0, limit).map(toActionListItem),
        total: ordered.length,
        page: 1,
        limit,
      }, { headers: SECURE_HEADERS })
    }

    const [rows, total] = await Promise.all([
      prisma.contractAction.findMany({
        where,
        select: ACTION_LIST_SELECT,
        orderBy: [
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "asc" },
          { id: "asc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contractAction.count({ where }),
    ])

    return Response.json({ actions: rows.map(toActionListItem), total, page, limit }, { headers: SECURE_HEADERS })
  })
}
