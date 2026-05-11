import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { z } from "zod"

// ─── POST /api/contracts/[id]/signing/signers ─────────────────────────────────
// Adds a signer to the contract's signer list. Only allowed before submission is sent.

const AddSignerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  isInternal: z.boolean().default(false),
})

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
      select: { id: true, organizationId: true, docusealSubmissionId: true },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (contract.docusealSubmissionId) {
      return Response.json(
        { error: "Cannot add signers after submission has been sent" },
        { status: 409 },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = AddSignerSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Block duplicate email for this contract
    const existing = await prisma.contractSigner.findFirst({
      where: { contractId: params.id, email: parsed.data.email },
    })
    if (existing) {
      return Response.json(
        { error: "A signer with this email already exists" },
        { status: 409 },
      )
    }

    const signer = await prisma.contractSigner.create({
      data: {
        contractId: params.id,
        name: parsed.data.name,
        email: parsed.data.email,
        isInternal: parsed.data.isInternal,
      },
    })

    return Response.json({ signer }, { status: 201 })
  })
}
