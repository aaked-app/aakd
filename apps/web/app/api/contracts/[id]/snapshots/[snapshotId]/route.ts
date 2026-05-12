import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"

// ─── GET /api/contracts/[id]/snapshots/[snapshotId] ──────────────────────────
// Fetch a single snapshot with full content. Any authenticated role can read.

export async function GET(
  req: Request,
  { params }: { params: { id: string; snapshotId: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const snapshot = await prisma.documentSnapshot.findUnique({
      where: { id: params.snapshotId },
      select: {
        id: true,
        label: true,
        content: true,
        wordCount: true,
        createdAt: true,
        organizationId: true,
        contractId: true,
        createdBy: { select: { name: true } },
      },
    })

    if (!snapshot || snapshot.organizationId !== ctx.organizationId || snapshot.contractId !== params.id) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    return Response.json({ snapshot })
  })
}

// ─── DELETE /api/contracts/[id]/snapshots/[snapshotId] ───────────────────────
// Delete a snapshot. Requires legal+ role.

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; snapshotId: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    const snapshot = await prisma.documentSnapshot.findUnique({
      where: { id: params.snapshotId },
      select: {
        id: true,
        label: true,
        organizationId: true,
        contractId: true,
      },
    })

    if (!snapshot || snapshot.organizationId !== ctx.organizationId || snapshot.contractId !== params.id) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    // Requires legal or admin role
    if (ctx.role === "viewer" || ctx.role === "member") {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.documentSnapshot.delete({ where: { id: params.snapshotId } })

    await writeActivity(params.id, ctx.userId, "SNAPSHOT_DELETED", snapshot.label)

    return new Response(null, { status: 204 })
  })
}
