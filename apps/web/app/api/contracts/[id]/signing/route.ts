import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

// ─── GET /api/contracts/[id]/signing ─────────────────────────────────────────
// Returns the signers list + overall signing status for a contract.

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        docusealSubmissionId: true,
        signingStatus: true,
        counterpartyContact: true,
        counterpartyName: true,
      },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const signers = await prisma.contractSigner.findMany({
      where: { contractId: params.id },
      orderBy: { createdAt: "asc" },
    })

    return Response.json({
      signers,
      submissionId: contract.docusealSubmissionId ?? null,
      signingStatus: contract.signingStatus ?? null,
      collectedSignatures: signers.filter((s) => s.status === "signed").length,
      totalSigners: signers.length,
    })
  })
}
