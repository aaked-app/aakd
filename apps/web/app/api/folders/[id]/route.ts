import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { z } from "zod"

const RenameFolderSchema = z.object({
  name: z.string().min(1).max(200),
})

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    const parsed = RenameFolderSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const existing = await prisma.folder.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!existing || existing.organizationId !== ctx.organizationId)
      return Response.json({ error: "Not Found" }, { status: 404 })

    const folder = await prisma.folder.update({
      where: { id: params.id },
      data: { name: parsed.data.name },
    })

    return Response.json(folder)
  })
}

export async function DELETE(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    const existing = await prisma.folder.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true, name: true },
    })
    if (!existing || existing.organizationId !== ctx.organizationId)
      return Response.json({ error: "Not Found" }, { status: 404 })

    const affectedContracts = await prisma.contract.findMany({
      where: { folderId: params.id },
      select: { id: true },
    })

    // Move contracts to root
    await prisma.contract.updateMany({
      where: { folderId: params.id },
      data: { folderId: null },
    })

    // Audit trail — must not be fire-and-forget
    await Promise.all(
      affectedContracts.map((contract) =>
        writeActivity(
          contract.id,
          ctx.userId,
          "UPDATED",
          `Removed from folder "${existing.name}" (folder deleted)`,
        ),
      ),
    )

    await prisma.folder.delete({ where: { id: params.id } })

    return new Response(null, { status: 204 })
  })
}
