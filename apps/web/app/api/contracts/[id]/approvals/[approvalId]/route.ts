import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { z } from "zod"

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const

// ─── PATCH /api/contracts/[id]/approvals/[approvalId] ────────────────────────
// Decide on an approval. Only the assigned reviewer can approve or reject.

const PatchSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; approvalId: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    // Org-scope check on the contract
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true, status: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    // Validate body
    let body: z.infer<typeof PatchSchema>
    try {
      body = PatchSchema.parse(await req.json())
    } catch (err) {
      return Response.json({ error: "Invalid request body", detail: err }, { status: 400 })
    }

    // Fetch the approval and verify it belongs to this contract
    const approval = await prisma.approval.findUnique({
      where: { id: params.approvalId },
      select: { id: true, contractId: true, assignedToId: true, status: true },
    })
    if (!approval || approval.contractId !== params.id) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    // Only the assigned reviewer may decide
    if (approval.assignedToId !== ctx.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // Reject re-decisions — approvals are write-once.
    if (approval.status !== "pending") {
      return Response.json({ error: "Approval already decided" }, { status: 409 })
    }

    // Update the approval record
    const updated = await prisma.approval.update({
      where: { id: params.approvalId },
      data: {
        status: body.decision,
        comment: body.comment ?? null,
        decidedAt: new Date(),
      },
      include: {
        requestedBy: { select: USER_SELECT },
        assignedTo: { select: USER_SELECT },
      },
    })

    // Write audit activity
    const action = body.decision === "approved" ? "APPROVED" : "REJECTED"
    const detail = body.comment
      ? `${body.decision === "approved" ? "Approved" : "Rejected"}: ${body.comment}`
      : body.decision === "approved"
        ? "Approved"
        : "Rejected"

    await writeActivity(params.id, ctx.userId, action, detail)

    // On approval, auto-advance only after every approval request has approved.
    if (body.decision === "approved" && contract.status === "PENDING_APPROVAL") {
      const unresolvedApprovals = await prisma.approval.findMany({
        where: {
          contractId: params.id,
          status: { in: ["pending", "rejected"] },
        },
        select: { id: true },
      })

      if (unresolvedApprovals.length === 0) {
        await prisma.contract.update({
          where: { id: params.id },
          data: { status: "AWAITING_SIGNATURE" },
        })
        await writeActivity(
          params.id,
          ctx.userId,
          "STATUS_CHANGED",
          "PENDING_APPROVAL → AWAITING_SIGNATURE",
          { from: "PENDING_APPROVAL", to: "AWAITING_SIGNATURE" },
        )
      }
    }

    if (body.decision === "rejected" && contract.status === "PENDING_APPROVAL") {
      await prisma.contract.update({
        where: { id: params.id },
        data: { status: "INTERNAL_REVIEW" },
      })
      await writeActivity(
        params.id,
        ctx.userId,
        "STATUS_CHANGED",
        "PENDING_APPROVAL → INTERNAL_REVIEW",
        { from: "PENDING_APPROVAL", to: "INTERNAL_REVIEW" },
      )
    }

    return Response.json({ approval: updated })
  })
}
