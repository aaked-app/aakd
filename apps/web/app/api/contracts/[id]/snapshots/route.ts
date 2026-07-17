import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { plateToPlaintext, countWords } from "@/lib/editor/plate-to-plaintext"
import { captureServerEvent } from "@/lib/posthog-server"
import { z } from "zod"

// ─── GET /api/contracts/[id]/snapshots ───────────────────────────────────────
// List snapshots for a contract (newest first). Any authenticated role can read.

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

    const [snapshots, total] = await Promise.all([
      prisma.documentSnapshot.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          label: true,
          wordCount: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.documentSnapshot.count({ where }),
    ])

    return Response.json({ snapshots, total, page, limit })
  })
}

// ─── POST /api/contracts/[id]/snapshots ──────────────────────────────────────
// Create a new snapshot. Requires member+ role.

const CreateSnapshotSchema = z.object({
  label: z.string().min(1).max(200),
  content: z.record(z.string(), z.unknown()),
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

    if (ctx.role === "viewer") {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = CreateSnapshotSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: "Invalid request body", detail: parsed.error }, { status: 400 })
    }

    const plaintext = plateToPlaintext(parsed.data.content)
    const wordCount = countWords(plaintext)

    const snapshot = await prisma.documentSnapshot.create({
      data: {
        contractId: params.id,
        organizationId: ctx.organizationId,
        label: parsed.data.label,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: parsed.data.content as any,
        wordCount,
        createdById: ctx.userId,
      },
      select: {
        id: true,
        label: true,
        createdAt: true,
      },
    })

    await writeActivity(params.id, ctx.userId, "SNAPSHOT_CREATED", parsed.data.label)

    captureServerEvent(ctx.userId, "snapshot_created", {
      contractId: params.id,
      organizationId: ctx.organizationId,
    })

    return Response.json({ snapshot }, { status: 201 })
  })
}
