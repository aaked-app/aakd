import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { remindSubmitter } from "@/lib/docuseal"
import { z } from "zod"

// ─── POST /api/contracts/[id]/signing/remind ──────────────────────────────────
// Sends a reminder to a specific pending signer via DocuSeal.

const RemindSchema = z.object({ signerId: z.string().min(1) })

function hasRole(role: string, minimumRole: string): boolean {
  const hierarchy: Record<string, number> = { viewer: 0, member: 1, legal: 2, admin: 3, owner: 4 }
  return (hierarchy[role] ?? 0) >= (hierarchy[minimumRole] ?? 0)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  if (!hasRole(ctx.role, "legal")) {
    return Response.json({ error: "Insufficient permissions — legal role or above required" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = RemindSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const signer = await prisma.contractSigner.findFirst({
      where: { contractId: params.id, id: parsed.data.signerId },
    })

    if (!signer) {
      return Response.json({ error: "Signer not found" }, { status: 404 })
    }

    if (signer.status !== "pending") {
      return Response.json(
        { error: "Can only remind pending signers" },
        { status: 400 },
      )
    }

    if (!signer.externalId) {
      return Response.json(
        { error: "Submission has not been sent yet" },
        { status: 400 },
      )
    }

    await remindSubmitter(signer.externalId)

    return Response.json({ success: true })
  })
}
