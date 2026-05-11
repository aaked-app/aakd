import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

// ─── DELETE /api/contracts/[id]/signing/signers/[signerId] ────────────────────
// Removes a signer. Only allowed before submission is sent.

function hasRole(role: string, minimumRole: string): boolean {
  const hierarchy: Record<string, number> = { viewer: 0, member: 1, legal: 2, admin: 3, owner: 4 }
  return (hierarchy[role] ?? 0) >= (hierarchy[minimumRole] ?? 0)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; signerId: string } },
) {
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
      select: { id: true, organizationId: true, docusealSubmissionId: true },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (contract.docusealSubmissionId) {
      return Response.json(
        { error: "Cannot remove signers after submission has been sent" },
        { status: 409 },
      )
    }

    const signer = await prisma.contractSigner.findUnique({
      where: { id: params.signerId },
    })

    if (!signer || signer.contractId !== params.id) {
      return Response.json({ error: "Signer not found" }, { status: 404 })
    }

    await prisma.contractSigner.delete({ where: { id: params.signerId } })

    return Response.json({ success: true })
  })
}
