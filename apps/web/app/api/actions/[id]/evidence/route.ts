import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { z } from "zod"

const WRITERS = new Set(["owner", "admin", "legal", "member"])
const EvidenceSchema = z.object({
  kind: z.string().min(1).max(80),
  note: z.string().max(4000).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
})

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
  if (!WRITERS.has(ctx.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    const action = await prisma.contractAction.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: { id: true, contractId: true, status: true },
    })
    if (!action) return Response.json({ error: "Not Found" }, { status: 404 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = EvidenceSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

    const evidence = await prisma.$transaction(async (tx) => {
      const created = await tx.contractActionEvidence.create({
        data: {
          actionId: action.id,
          kind: parsed.data.kind,
          note: parsed.data.note,
          sourceUrl: parsed.data.sourceUrl,
          recordedById: ctx.userId,
        },
      })
      await tx.activity.create({
        data: {
          contractId: action.contractId,
          contractActionId: action.id,
          userId: ctx.userId,
          action: "ACTION_EVIDENCE_ADDED",
          detail: "Completion evidence added",
          metadata: { requestSource: ctx.source, requestId: ctx.requestId, evidenceId: created.id },
        },
      })
      return created
    })

    return Response.json({
      id: evidence.id,
      kind: evidence.kind,
      note: evidence.note,
      sourceUrl: evidence.sourceUrl,
      recordedById: evidence.recordedById,
      createdAt: evidence.createdAt,
    }, { status: 201, headers: SECURE_HEADERS })
  })
}
