import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { BUILT_IN_SNIPPETS } from "@/lib/snippets/built-in"
import { z } from "zod"

const MAX_USER_SNIPPETS = 500

const CreateSnippetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100).default("My Snippets"),
  content: z.array(z.any()).min(1),
  contentText: z.string().max(5000),
})

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const userSnippets = await prisma.clauseSnippet.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
    })

    return Response.json({ builtIn: BUILT_IN_SNIPPETS, userSnippets })
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = CreateSnippetSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Sanity cap: prevent runaway snippet accumulation per org
    const existingCount = await prisma.clauseSnippet.count({
      where: { organizationId: ctx.organizationId },
    })
    if (existingCount >= MAX_USER_SNIPPETS) {
      return Response.json(
        { error: `Organization snippet limit of ${MAX_USER_SNIPPETS} reached` },
        { status: 422 },
      )
    }

    const snippet = await prisma.clauseSnippet.create({
      data: {
        organizationId: ctx.organizationId,
        createdById: ctx.userId,
        name: parsed.data.name,
        category: parsed.data.category,
        content: parsed.data.content,
        contentText: parsed.data.contentText,
      },
    })

    return Response.json({ snippet }, { status: 201 })
  })
}
