import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { z } from "zod"

const AUTHOR_SELECT = {
  id: true,
  name: true,
  image: true,
} as const

// ─── GET /api/contracts/[id]/comments ────────────────────────────────────────
// Return all comments for the contract. Any member can read.

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const url = new URL(req.url)
    const page = (() => {
      const n = parseInt(url.searchParams.get("page") ?? "1", 10)
      return Number.isNaN(n) ? 1 : Math.max(1, n)
    })()
    const limit = (() => {
      const n = parseInt(url.searchParams.get("limit") ?? "50", 10)
      return Number.isNaN(n) ? 50 : Math.min(Math.max(1, n), 100)
    })()

    const where = { contractId: params.id }

    const [comments, total] = await Promise.all([
      prisma.contractComment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: AUTHOR_SELECT },
          resolvedBy: { select: AUTHOR_SELECT },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contractComment.count({ where }),
    ])

    return Response.json({ comments, total, page, limit })
  })
}

// ─── POST /api/contracts/[id]/comments ───────────────────────────────────────
// Create a comment. Requires member+ role.

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  markId: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    // viewers cannot comment
    if (ctx.role === "viewer") {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = CreateCommentSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: "Invalid request body", detail: parsed.error }, { status: 400 })
    }

    const comment = await prisma.contractComment.create({
      data: {
        contractId: params.id,
        authorId: ctx.userId,
        body: parsed.data.body,
        markId: parsed.data.markId ?? null,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        resolvedBy: { select: AUTHOR_SELECT },
      },
    })

    await writeActivity(params.id, ctx.userId, "COMMENTED", parsed.data.body.slice(0, 200))

    return Response.json({ comment }, { status: 201 })
  })
}
