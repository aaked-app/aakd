import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { archiveSubmission } from "@/lib/docuseal"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

// POST /api/contracts/[id]/signing/reset
// Voids the DocuSeal submission (best-effort) and resets signing state so
// the contract owner can reconfigure signers and re-send.
// Only allowed when signingStatus is "declined", "expired", or "failed".

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  if (ctx.role !== "admin" && ctx.role !== "legal") {
    return Response.json({ error: "Only admin or legal roles may reset signing" }, { status: 403 })
  }

  const rl = await rateLimit(`${ctx.organizationId}:sign`, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        status: true,
        signingStatus: true,
        docusealSubmissionId: true,
      },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (contract.status !== "AWAITING_SIGNATURE") {
      return Response.json({ error: "Contract is not in AWAITING_SIGNATURE status" }, { status: 400 })
    }

    const RESETTABLE_STATUSES = ["declined", "expired", "failed"]
    if (!contract.signingStatus || !RESETTABLE_STATUSES.includes(contract.signingStatus)) {
      return Response.json(
        {
          error: `Signing can only be reset when status is: ${RESETTABLE_STATUSES.join(", ")}. Current: ${contract.signingStatus ?? "none"}`,
        },
        { status: 400 },
      )
    }

    // Best-effort void on DocuSeal — don't block reset if it fails
    if (contract.docusealSubmissionId) {
      const voided = await archiveSubmission(Number(contract.docusealSubmissionId))
      if (!voided) {
        console.warn(
          `[signing-reset] DocuSeal archive failed for submission ${contract.docusealSubmissionId} — continuing with local reset`,
        )
      }
    }

    // Reset all signer statuses
    await prisma.contractSigner.updateMany({
      where: { contractId: params.id },
      data: { status: "pending", externalId: null, signedAt: null },
    })

    // Clear submission info on the contract
    await prisma.contract.update({
      where: { id: params.id },
      data: {
        docusealSubmissionId: null,
        signingStatus: null,
        signingUrl: null,
      },
    })

    await writeActivity(
      params.id,
      ctx.userId,
      "UPDATED",
      `Signing reset — previous submission ${contract.docusealSubmissionId ?? "unknown"} voided`,
    )

    return Response.json({ ok: true })
  })
}
