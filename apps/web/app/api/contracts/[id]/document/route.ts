import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { hasRole } from "@/lib/auth/roles"
import { requestContext, type RequestContext } from "@/lib/context"
import { withTransactionRetry } from "@/lib/db/transaction-retry"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { Prisma } from "@prisma/client"
import { z } from "zod"

// 5 MB cap on serialised content JSON.
const MAX_CONTENT_BYTES = 5_242_880

// Recursively walk the TipTap doc tree and strip HTML tags from text nodes
// to prevent XSS payloads being stored and later rendered in exported documents.
function sanitizeTipTapContent(node: unknown): unknown {
  if (typeof node !== "object" || node === null) return node
  const n = node as Record<string, unknown>
  if (n.type === "text" && typeof n.text === "string") {
    n.text = n.text.replace(/<[^>]*>/g, "")
  }
  if (Array.isArray(n.content)) {
    n.content = n.content.map(sanitizeTipTapContent)
  }
  return n
}

const READ_ONLY_STATUSES = new Set([
  "AWAITING_SIGNATURE",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "ARCHIVED",
])

class DocumentSaveError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function assertCurrentSavePermission(tx: Prisma.TransactionClient, ctx: RequestContext, contractId: string) {
  const permission = await lockCurrentAgreementPermission(tx, ctx, contractId)
  if (!permission) throw new DocumentSaveError(404, "Not Found")
  if (!hasRole(permission.role, "member")) throw new DocumentSaveError(403, "Forbidden")
  const current = await tx.contract.findFirst({
    where: { id: contractId, organizationId: ctx.organizationId }, select: { status: true },
  })
  if (!current) throw new DocumentSaveError(404, "Not Found")
  if (READ_ONLY_STATUSES.has(current.status)) throw new DocumentSaveError(422, "read_only_status")
}

// Accept either:
// - legacy Slate array: [...nodes]
// - TipTap doc object: { type: "doc", content: [...nodes] }
const TipTapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).max(50_000),
})

const SaveSchema = z.object({
  content: z.union([
    TipTapDocSchema,
    z.array(z.unknown()).max(50_000),
  ]),
  wordCount: z.number().int().min(0).max(1_000_000),
  clientVersion: z.number().int().min(0),
})

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source === "api_key" && !ctx.scopes?.includes("text_read")) return Response.json({ error: "text_read scope required" }, { status: 403 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    // Verify org access explicitly — belt-and-suspenders alongside middleware.
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }

    const document = await prisma.contractDocument.findUnique({
      where: { contractId: params.id },
      select: {
        id: true,
        content: true,
        wordCount: true,
        version: true,
        updatedAt: true,
      },
    })

    return Response.json({ document: document ?? null })
  })
}

export async function PUT(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (ctx.role === "viewer") {
    return Response.json({ error: "viewer role cannot edit documents" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    const parsed = SaveSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Size enforcement
    const serialized = JSON.stringify(parsed.data.content)
    if (Buffer.byteLength(serialized, "utf8") > MAX_CONTENT_BYTES) {
      return Response.json({ error: "payload_too_large" }, { status: 413 })
    }

    // Confirm contract exists and check status — explicit org check.
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }

    if (READ_ONLY_STATUSES.has(contract.status)) {
      return Response.json({ error: "read_only_status" }, { status: 422 })
    }

    const existing = await prisma.contractDocument.findUnique({
      where: { contractId: params.id },
      select: { id: true, version: true },
    })

    // Sanitize text nodes before persisting to prevent stored XSS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitizedContent = sanitizeTipTapContent(parsed.data.content) as any

    if (!existing) {
      // First save: clientVersion must be 0
      if (parsed.data.clientVersion !== 0) {
        return Response.json(
          { error: "conflict", serverVersion: 0 },
          { status: 409 },
        )
      }
      try {
        const created = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
        await assertCurrentSavePermission(tx, ctx, params.id)
        const document = await tx.contractDocument.create({
          data: {
            contractId: params.id,
            content: sanitizedContent,
            wordCount: parsed.data.wordCount,
            version: 1,
            savedById: ctx.userId,
          },
          select: { id: true, wordCount: true, version: true, updatedAt: true },
        })
        await writeActivity(params.id, ctx.userId, "DOCUMENT_SAVED", undefined, undefined, tx)
        return document
        }, { isolationLevel: "Serializable" }))
        return Response.json({ document: created })
      } catch (err) {
        if (err instanceof DocumentSaveError) return Response.json({ error: err.message }, { status: err.status })
        // P2002 = a concurrent first-save just won the race.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return Response.json(
            { error: "conflict", serverVersion: 1 },
            { status: 409 },
          )
        }
        throw err
      }
    }

    if (parsed.data.clientVersion !== existing.version) {
      return Response.json(
        { error: "conflict", serverVersion: existing.version },
        { status: 409 },
      )
    }

    try {
    const updated = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await assertCurrentSavePermission(tx, ctx, params.id)
    const document = await tx.contractDocument.update({
      where: { contractId: params.id, version: existing.version },
      data: {
        content: sanitizedContent,
        wordCount: parsed.data.wordCount,
        version: existing.version + 1,
        savedById: ctx.userId,
      },
      select: { id: true, wordCount: true, version: true, updatedAt: true },
    })
    await writeActivity(params.id, ctx.userId, "DOCUMENT_SAVED", undefined, undefined, tx)
    return document
    }, { isolationLevel: "Serializable" }))
    return Response.json({ document: updated })
    } catch (error) {
      if (error instanceof DocumentSaveError) return Response.json({ error: error.message }, { status: error.status })
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return Response.json({ error: "conflict" }, { status: 409 })
      }
      throw error
    }
  })
}
