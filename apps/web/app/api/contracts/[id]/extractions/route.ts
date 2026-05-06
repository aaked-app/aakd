import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { z } from "zod"
import type { ContractType } from "@prisma/client"

// ─── GET /api/contracts/[id]/extractions ─────────────────────────────────────
// Returns all AIExtraction records for the contract, ordered by createdAt.

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

    const extractions = await prisma.aIExtraction.findMany({
      where: { contractId: params.id },
      orderBy: { createdAt: "asc" },
    })

    return Response.json(extractions)
  })
}

// ─── PATCH /api/contracts/[id]/extractions ────────────────────────────────────
// Accept or reject an AI-extracted field.
// Body: { extractionId: string, action: "accept" | "reject" }

const PatchSchema = z.object({
  extractionId: z.string().min(1),
  action: z.enum(["accept", "reject"]),
})

// Map of extraction field name → canonical Contract column + type coercion
type CoerceFn = (raw: string) => unknown
const FIELD_MAP: Record<string, { column: string; coerce: CoerceFn }> = {
  contractType:     { column: "contractType",     coerce: (v) => v as ContractType },
  startDate:        { column: "startDate",         coerce: (v) => new Date(v) },
  endDate:          { column: "endDate",           coerce: (v) => new Date(v) },
  renewalDate:      { column: "renewalDate",       coerce: (v) => new Date(v) },
  value:            { column: "value",             coerce: (v) => parseFloat(v) },
  currency:         { column: "currency",          coerce: (v) => v },
  counterpartyName: { column: "counterpartyName",  coerce: (v) => v },
  governingLaw:     { column: "governingLaw",      coerce: (v) => v },
  noticePeriodDays: { column: "noticePeriodDays",  coerce: (v) => parseInt(v, 10) },
  autoRenewal:      { column: "autoRenewal",       coerce: (v) => v === "true" || v === "1" },
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    // Org-scope check
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
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

    const { extractionId, action } = body

    // Fetch the extraction record (no org-scope middleware on AIExtraction —
    // we verify ownership through the contract FK check above)
    const extraction = await prisma.aIExtraction.findUnique({
      where: { id: extractionId },
      select: { id: true, contractId: true, field: true, rawValue: true, status: true },
    })

    if (!extraction || extraction.contractId !== params.id) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (action === "accept") {
      // 1. Mark accepted
      await prisma.aIExtraction.update({
        where: { id: extractionId },
        data: { status: "accepted" },
      })

      // 2. Apply value to canonical Contract field
      const mapping = FIELD_MAP[extraction.field]
      if (mapping && extraction.rawValue !== null) {
        const coerced = mapping.coerce(extraction.rawValue)
        await prisma.contract.update({
          where: { id: params.id },
          data: { [mapping.column]: coerced },
        })
      }

      await writeActivity(
        params.id,
        ctx.userId,
        "METADATA_UPDATED",
        `Accepted AI extraction for field "${extraction.field}"`,
      )
    } else {
      // Reject
      await prisma.aIExtraction.update({
        where: { id: extractionId },
        data: { status: "rejected" },
      })

      await writeActivity(
        params.id,
        ctx.userId,
        "METADATA_UPDATED",
        `Rejected AI extraction for field "${extraction.field}"`,
      )
    }

    const updated = await prisma.aIExtraction.findUnique({ where: { id: extractionId } })
    return Response.json(updated)
  })
}
