import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    const snippet = await prisma.clauseSnippet.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: { id: true, createdById: true },
    })

    if (!snippet) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    // Only the creator or an admin/owner may delete a snippet
    const isCreator = snippet.createdById === ctx.userId
    const isAdmin = hasRole(ctx.role, "admin")
    if (!isCreator && !isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.clauseSnippet.delete({ where: { id: snippet.id } })

    return new Response(null, { status: 204 })
  })
}
