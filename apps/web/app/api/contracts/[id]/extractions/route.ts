import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { captureServerEvent } from "@/lib/posthog-server"
import { projectRenewalActions } from "@/lib/actions/project"
import { generateAlertsForContract } from "@/lib/alerts/generate"
import { alertsCheckQueue } from "@/lib/jobs/queues"
import { fireAndLog } from "@/lib/utils/fire-and-log"
import { z } from "zod"
import { Prisma, type ContractType } from "@prisma/client"

// Fields whose acceptance must trigger renewal-alert regeneration
const ALERT_TRIGGERING_FIELDS = new Set(["endDate", "renewalDate", "noticePeriodDays", "autoRenewal", "renewalReminderEnabled"])

async function regenerateAlertsIfTouched(contractId: string, touchedFields: string[]) {
  if (!touchedFields.some((f) => ALERT_TRIGGERING_FIELDS.has(f))) return
  const c = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { endDate: true, renewalDate: true, noticePeriodDays: true, renewalReminderEnabled: true },
  })
  if (!c) return
  fireAndLog(
    generateAlertsForContract(contractId, c.endDate, c.renewalDate, c.noticePeriodDays, c.renewalReminderEnabled)
      .then(() => alertsCheckQueue.add("after-contract-change", { triggeredAt: new Date().toISOString() })),
    "generateAlertsForContract:extractionAccepted",
  )
}

// ─── GET /api/contracts/[id]/extractions ─────────────────────────────────────
// Returns all AIExtraction records for the contract, ordered by createdAt.

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
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

    return Response.json({ extractions })
  })
}

// ─── POST /api/contracts/[id]/extractions ─────────────────────────────────────
// Seeds initial extraction rows from the Pass-1 (extract-preview) data so the
// contract detail page is populated immediately. User-edited values are stored
// as accepted manual facts and are protected from worker enrichment.
// The worker's ai_extract job will later enrich these rows with sourceText and
// sourcePage via its own createMany(skipDuplicates)+updateMany(status≠accepted)
// upsert. Accepted manual rows are intentionally protected from worker output.

const EXTRACTABLE_FIELDS = new Set([
  "contractType", "startDate", "endDate", "renewalDate",
  "value", "currency", "counterpartyName", "governingLaw",
  "noticePeriodDays", "autoRenewal",
])

const SeedSchema = z.object({
  extractions: z
    .array(
      z.object({
        field:      z.string().min(1),
        rawValue:   z.string().min(1),
        confidence: z.number().min(0).max(1).default(0),
        extractedBy: z.enum(["ai", "manual"]).default("ai"),
      }),
    )
    .min(1)
    .max(20),
})

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
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

    let body: z.infer<typeof SeedSchema>
    try {
      body = SeedSchema.parse(await req.json())
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 })
    }

    const valid = body.extractions.filter((e) => EXTRACTABLE_FIELDS.has(e.field))
    if (valid.length === 0) return Response.json({ seeded: 0 })

    // skipDuplicates: if the worker already ran, don't clobber its richer data.
    const result = await prisma.aIExtraction.createMany({
      data: valid.map((e) => ({
        contractId:  params.id,
        field:       e.field,
        rawValue:    e.rawValue,
        confidence:  e.confidence,
        sourceText:  null,
        sourcePage:  null,
        extractedBy: e.extractedBy,
        status:      e.extractedBy === "manual" ? "accepted" : "pending",
      })),
      skipDuplicates: true,
    })

    return Response.json({ seeded: result.count })
  })
}

// ─── PATCH /api/contracts/[id]/extractions ────────────────────────────────────
// Actions:
//   { action: "accept",     extractionId: string }           — mark accepted + write to contract
//   { action: "reject",     extractionId: string }           — mark rejected
//   { action: "edit",       extractionId: string, newValue } — update rawValue then accept

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"),     extractionId: z.string().min(1) }),
  z.object({ action: z.literal("reject"),     extractionId: z.string().min(1) }),
  z.object({ action: z.literal("edit"),       extractionId: z.string().min(1), newValue: z.string().min(1) }),
])

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

/**
 * Returns true if the coerced value is safe to write. NaN floats, NaN ints,
 * and Invalid Date objects all coerce silently in JS but Prisma will either
 * reject them or — worse — persist nonsense like NaN/null.
 */
function isCoercedValueValid(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return value !== undefined
}

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

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

    // ── single-field actions (accept / reject / edit) ─────────────────────────
    const { extractionId } = body

    const extraction = await prisma.aIExtraction.findUnique({
      where: { id: extractionId },
      select: { id: true, contractId: true, field: true, rawValue: true, status: true, extractedBy: true, sourceText: true },
    })

    if (!extraction || extraction.contractId !== params.id) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    if (body.action === "accept" || body.action === "edit") {
      const result = await prisma.$transaction(async (tx) => {
        // Upload holds this same parent lock before invalidating derived rows.
        // Lock it first here too to maintain a single lock order and avoid an
        // acceptance-vs-replacement deadlock.
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "Contract" WHERE "id" = ${params.id} FOR UPDATE
        `)
        // Re-read after the parent lock: an upload, correction, or worker
        // refresh may have changed/deleted this candidate while the request
        // was waiting. Canonical data must always be derived from this row.
        const current = await tx.aIExtraction.findUnique({
          where: { id: extractionId },
          select: { id: true, contractId: true, field: true, rawValue: true, extractedBy: true, sourceText: true },
        })
        if (!current || current.contractId !== params.id) return { kind: "missing" as const }
        if (body.action === "accept" && current.extractedBy !== "manual" && !current.sourceText?.trim()) {
          return { kind: "uncited" as const }
        }
        const rawValue = body.action === "edit" ? body.newValue : current.rawValue
        const mapping = FIELD_MAP[current.field]
        const coerced = mapping && rawValue !== null ? mapping.coerce(rawValue) : undefined
        if (mapping && rawValue !== null && !isCoercedValueValid(coerced)) {
          return { kind: "invalid" as const, field: current.field }
        }
        await tx.aIExtraction.update({
          where: { id: extractionId },
          data: {
            status: "accepted",
            ...(body.action === "edit" ? { rawValue: body.newValue, extractedBy: "user" } : {}),
          },
        })
        if (mapping && rawValue !== null) {
          await tx.contract.update({
            where: { id: params.id },
            data: { [mapping.column]: coerced },
          })
        }
        await tx.activity.create({
          data: {
            contractId: params.id,
            userId: ctx.userId,
            action: "METADATA_UPDATED",
            detail: `Accepted AI extraction for field "${current.field}"`,
          },
        })
        if (ALERT_TRIGGERING_FIELDS.has(current.field)) {
          await projectRenewalActions(contract.organizationId, tx)
        }
        return { kind: "accepted" as const, field: current.field }
      })
      if (result.kind === "missing") return Response.json({ error: "Not Found" }, { status: 404 })
      if (result.kind === "uncited") {
        return Response.json({ error: "Source evidence is still processing; review is unavailable." }, { status: 409 })
      }
      if (result.kind === "invalid") {
        return Response.json({ error: "AI-extracted value failed type coercion", field: result.field }, { status: 422 })
      }

      // Keep activation telemetry aggregate-only. Never send document identifiers
      // or extracted values to the analytics provider.
      captureServerEvent(ctx.userId, "contract_fact_reviewed", {
        action: body.action,
        field: result.field,
      })

      await regenerateAlertsIfTouched(params.id, [result.field])
    } else {
      const rejected = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "Contract" WHERE "id" = ${params.id} FOR UPDATE
        `)
        const current = await tx.aIExtraction.findUnique({
          where: { id: extractionId },
          select: { id: true, contractId: true, field: true, status: true },
        })
        if (!current || current.contractId !== params.id) return { kind: "missing" as const }
        // Accepted values are a reviewed canonical decision. Corrections must
        // be explicit edits, never a later rejection that strands the value.
        if (current.status === "accepted") return { kind: "accepted" as const }
        await tx.aIExtraction.update({ where: { id: extractionId }, data: { status: "rejected" } })
        await tx.activity.create({
          data: {
            contractId: params.id,
            userId: ctx.userId,
            action: "METADATA_UPDATED",
            detail: `Rejected AI extraction for field "${current.field}"`,
          },
        })
        return { kind: "rejected" as const }
      })
      if (rejected.kind === "missing") return Response.json({ error: "Not Found" }, { status: 404 })
      if (rejected.kind === "accepted") {
        return Response.json({ error: "Accepted facts must be corrected, not rejected." }, { status: 409 })
      }
    }

    const updated = await prisma.aIExtraction.findUnique({ where: { id: extractionId } })
    return Response.json(updated)
  })
}
