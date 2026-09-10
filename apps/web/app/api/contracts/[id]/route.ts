import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { generateAlertsForContract } from "@/lib/alerts/generate"
import { enqueueNotification } from "@/lib/notifications/fanout"
import { writeInAppToOrgMembers } from "@/lib/notifications/write-in-app"
import { fireAndLog } from "@/lib/utils/fire-and-log"
import { alertsCheckQueue } from "@/lib/jobs/queues"
import { SECURE_HEADERS } from "@/lib/api-headers"
import { requestLogger } from "@/lib/logger"
import { z } from "zod"
import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { Prisma } from "@prisma/client"
import { isTransactionConflict, withTransactionRetry } from "@/lib/db/transaction-retry"
import { withoutContractIntakeIdentity } from "@/lib/contracts/create-schema"
import { activityMetadata, canReadContractText } from "@/lib/auth/read-projections"

// Allowed status transitions — all forward and backward moves permitted so
// users can correct mistakes freely. Only ARCHIVED is semi-terminal (can
// return to DRAFT to unarchive, but not to mid-flow states).
const ALL_STATUSES = ["DRAFT","INTERNAL_REVIEW","PENDING_APPROVAL","AWAITING_SIGNATURE","ACTIVE","EXPIRED","TERMINATED","ARCHIVED"] as const
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT:               ALL_STATUSES.filter((s) => s !== "DRAFT"),
  INTERNAL_REVIEW:     ALL_STATUSES.filter((s) => s !== "INTERNAL_REVIEW"),
  PENDING_APPROVAL:    ALL_STATUSES.filter((s) => s !== "PENDING_APPROVAL"),
  AWAITING_SIGNATURE:  ALL_STATUSES.filter((s) => s !== "AWAITING_SIGNATURE"),
  ACTIVE:              ["EXPIRED", "TERMINATED", "ARCHIVED"], // once active, only forward moves allowed
  EXPIRED:             ALL_STATUSES.filter((s) => s !== "EXPIRED"),
  TERMINATED:          ALL_STATUSES.filter((s) => s !== "TERMINATED"),
  ARCHIVED:            ["DRAFT"], // unarchive → back to draft only
}

const isoDate = z.union([z.string().date(), z.string().datetime({ offset: true })])

const UpdateContractSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  contractType: z.enum(["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"]).nullable().optional(),
  status: z.enum(["DRAFT", "INTERNAL_REVIEW", "PENDING_APPROVAL", "AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"]).optional(),
  counterpartyName: z.string().nullable().optional(),
  counterpartyContact: z.string().email().or(z.literal("")).nullable().optional(),
  value: z.number().positive().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  governingLaw: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  renewalDate: isoDate.nullable().optional(),
  noticePeriodDays: z.number().int().min(0).nullable().optional(),
  autoRenewal: z.boolean().optional(),
  renewalReminderEnabled: z.boolean().optional(),
  notes: z.string().max(10000).nullable().optional(),
  folderId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  ownerId: z.string().min(1).optional(),
})

class OwnerTransferAuthorizationError extends Error {
  constructor(readonly status: 403 | 404) {
    super(status === 404 ? "Owner transfer agreement not found" : "Owner transfer forbidden")
    this.name = "OwnerTransferAuthorizationError"
  }
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        contractType: true,
        status: true,
        ownerId: true,
        counterpartyName: true,
        counterpartyContact: true,
        value: true,
        currency: true,
        governingLaw: true,
        startDate: true,
        endDate: true,
        renewalDate: true,
        noticePeriodDays: true,
        autoRenewal: true,
        renewalReminderEnabled: true,
        notes: true,
        organizationId: true,
        folderId: true,
        docusealSubmissionId: true,
        signingUrl: true,
        signingStatus: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true, image: true } },
        tags: true,
        folder: true,
        files: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            filename: true,
            sizeBytes: true,
            mimeType: true,
            isLatest: true,
            createdAt: true,
          },
        },
        versions: { orderBy: { version: "desc" } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        _count: { select: { files: true, versions: true, activities: true } },
      },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return new Response("Not Found", { status: 404 })
    }

    // The detail page only needs to know if extractedText exists (to gate the
    // Ask AI panel) — /ask fetches the real text. Keep the response light by
    // only fetching a presence flag.
    const presence = await prisma.contract.count({
      where: { id: params.id, extractedText: { not: null } },
    })

    if (ctx.source === "api_key") {
      // Explicit projection: adding a column to the human detail page must not
      // silently grant software principals a signing capability or raw text.
      const textAllowed = canReadContractText(ctx)
      return Response.json({
        id: contract.id, title: contract.title, contractType: contract.contractType,
        status: contract.status, ownerId: contract.ownerId, owner: contract.owner,
        counterpartyName: contract.counterpartyName, counterpartyContact: contract.counterpartyContact,
        value: contract.value, currency: contract.currency, governingLaw: contract.governingLaw,
        startDate: contract.startDate, endDate: contract.endDate, renewalDate: contract.renewalDate,
        noticePeriodDays: contract.noticePeriodDays, autoRenewal: contract.autoRenewal,
        renewalReminderEnabled: contract.renewalReminderEnabled, organizationId: contract.organizationId,
        folderId: contract.folderId, folder: contract.folder, tags: contract.tags, files: contract.files,
        signingStatus: contract.signingStatus, createdAt: contract.createdAt, updatedAt: contract.updatedAt,
        ...(textAllowed ? { notes: contract.notes } : {}),
        versions: (contract.versions ?? []).map(row => ({
          id: row.id, version: row.version, fileId: row.fileId, createdAt: row.createdAt,
          createdById: row.createdById, ...(textAllowed ? { changeNote: row.changeNote } : {}),
        })),
        activities: textAllowed ? contract.activities : (contract.activities ?? []).map(activityMetadata),
        _count: contract._count, hasExtractedText: presence > 0,
      }, { headers: SECURE_HEADERS })
    }
    return Response.json({ ...contract, hasExtractedText: presence > 0 }, { headers: SECURE_HEADERS })
  })
}

export async function PATCH(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const log = requestLogger(ctx.requestId)

  const roleError = requireRole(ctx.role, "legal")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  if (ctx.source === "api_key") {
    try {
      const candidate = await req.clone().json()
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && Object.hasOwn(candidate, "ownerId")) {
        return Response.json({ error: "human_session_required" }, { status: 403, headers: SECURE_HEADERS })
      }
    } catch {
      // The normal request parser below returns the established invalid-JSON response.
    }
  }

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    const parsed = UpdateContractSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    let existing: { id: string; title: string; ownerId: string; organizationId: string; status: string; endDate: Date | null; renewalDate: Date | null; noticePeriodDays: number | null; renewalReminderEnabled: boolean } | null
    try {
      existing = await prisma.contract.findUnique({
        where: { id: params.id },
        select: { id: true, title: true, ownerId: true, organizationId: true, status: true, endDate: true, renewalDate: true, noticePeriodDays: true, renewalReminderEnabled: true },
      })
    } catch (err) {
      log.error({ err, contractId: params.id }, "[PATCH /contracts/:id] findUnique error")
      return Response.json({ error: "Database error looking up contract" }, { status: 500 })
    }
    if (!existing) return new Response("Not Found", { status: 404 })

    // Validate status transition
    const { tagIds, folderId, startDate, endDate, renewalDate, status, ownerId, ...rest } = parsed.data

    // Strip any HTML tags from free-text fields to prevent XSS persistence
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "")
    if (rest.title !== undefined) {
      rest.title = stripHtml(rest.title)
      if (!rest.title.trim()) {
        return Response.json({ error: "Contract title is required" }, { status: 422 })
      }
    }
    if (rest.counterpartyName) rest.counterpartyName = stripHtml(rest.counterpartyName)
    if (rest.notes) rest.notes = stripHtml(rest.notes)
    if (rest.governingLaw) rest.governingLaw = stripHtml(rest.governingLaw)

    if (status && status !== existing.status) {
      const allowed = STATUS_TRANSITIONS[existing.status] ?? []
      if (!allowed.includes(status)) {
        return Response.json(
          { error: `Invalid transition: ${existing.status} → ${status}. Allowed: ${allowed.join(", ") || "none"}` },
          { status: 422 }
        )
      }

      // Guard: PENDING_APPROVAL → AWAITING_SIGNATURE only if all approvals resolved
      if (existing.status === "PENDING_APPROVAL" && status === "AWAITING_SIGNATURE") {
        const openApprovals = await prisma.approval.count({
          where: { contractId: existing.id, status: { in: ["pending", "rejected"] } },
        })
        if (openApprovals > 0) {
          return Response.json(
            { error: "Cannot advance to signing while approvals are pending or rejected" },
            { status: 422 }
          )
        }
      }
    }

    // Verify folder + tags belong to the caller's org before connecting them.
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, organizationId: ctx.organizationId },
        select: { id: true },
      })
      if (!folder) {
        return Response.json({ error: "Folder not found in this organization" }, { status: 400 })
      }
    }
    if (tagIds && tagIds.length > 0) {
      const found = await prisma.tag.findMany({
        where: { id: { in: tagIds }, organizationId: ctx.organizationId },
        select: { id: true },
      })
      if (found.length !== tagIds.length) {
        return Response.json({ error: "One or more tags not found in this organization" }, { status: 400 })
      }
    }

    const isOwnerTransfer = ownerId !== undefined && ownerId !== existing.ownerId
    if (isOwnerTransfer && ctx.userId !== existing.ownerId && ctx.role !== "owner" && ctx.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: SECURE_HEADERS })
    }
    const targetOwner = isOwnerTransfer
      ? await prisma.member.findFirst({
          where: { userId: ownerId, organizationId: ctx.organizationId },
          select: { id: true, userId: true, organizationId: true },
        })
      : null
    if (isOwnerTransfer && !targetOwner) {
      return Response.json({ error: "Owner must be a current organization member" }, { status: 422, headers: SECURE_HEADERS })
    }

    const updateData = {
      ...rest,
      ownerId: isOwnerTransfer ? ownerId : undefined,
      status: status ?? undefined,
      folderId: folderId === undefined ? undefined : folderId,
      startDate: startDate === undefined ? undefined : startDate ? new Date(startDate) : null,
      endDate: endDate === undefined ? undefined : endDate ? new Date(endDate) : null,
      renewalDate: renewalDate === undefined ? undefined : renewalDate ? new Date(renewalDate) : null,
      renewalReminderEnabled: parsed.data.renewalReminderEnabled,
      tags: tagIds !== undefined ? { set: tagIds.map((id) => ({ id })) } : undefined,
    }
    const include = {
      owner: { select: { id: true, name: true, email: true, image: true } },
      tags: true,
      folder: true,
    } as const

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updated: any
    let ownerTransferAudited = false
    try {
      if (isOwnerTransfer && targetOwner) {
        updated = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
          const current = await lockCurrentAgreementPermission(tx, ctx, params.id)
          if (!current) throw new OwnerTransferAuthorizationError(404)
          if (ctx.userId !== current.contractOwnerId && current.role !== "owner" && current.role !== "admin") {
            throw new OwnerTransferAuthorizationError(403)
          }
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Member" WHERE "id" = ${targetOwner.id} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`)
          const currentTarget = await tx.member.findFirst({
            where: { id: targetOwner.id, userId: ownerId, organizationId: ctx.organizationId },
            select: { id: true },
          })
          if (!currentTarget) throw new Error("owner_membership_changed")
          const existingGrant = await tx.contractAccessGrant.findUnique({
            where: { contractId_memberId: { contractId: params.id, memberId: currentTarget.id } },
            select: { id: true },
          })
          if (!existingGrant) {
            const grant = await tx.contractAccessGrant.create({
              data: { organizationId: ctx.organizationId, contractId: params.id, memberId: currentTarget.id, grantedById: ctx.userId },
              select: { id: true },
            })
            await tx.activity.create({
              data: { contractId: params.id, userId: ctx.userId, action: "ACCESS_GRANTED", metadata: { requestId: ctx.requestId, grantId: grant.id, targetMemberId: currentTarget.id } },
            })
          }
          const result = await tx.contract.update({ where: { id: params.id }, data: updateData, include })
          await tx.activity.create({ data: { contractId: params.id, userId: ctx.userId, action: "UPDATED", detail: Object.keys(parsed.data).join(", "), metadata: { requestId: ctx.requestId } } })
          if (status && status !== existing.status) {
            await tx.activity.create({ data: { contractId: params.id, userId: ctx.userId, action: "STATUS_CHANGED", detail: `${existing.status} → ${status}`, metadata: { requestId: ctx.requestId } } })
          }
          return result
        }, { isolationLevel: "Serializable" }))
        ownerTransferAudited = true
      } else {
        updated = await prisma.contract.update({ where: { id: params.id }, data: updateData, include })
      }
    } catch (err) {
      if (err instanceof OwnerTransferAuthorizationError) {
        return Response.json(
          { error: err.status === 404 ? "Not Found" : "Forbidden" },
          { status: err.status, headers: SECURE_HEADERS },
        )
      }
      if (isTransactionConflict(err)) return Response.json({ error: "agreement_changed_retry" }, { status: 409, headers: SECURE_HEADERS })
      log.error({ err, contractId: params.id }, "[PATCH /contracts/:id] update error")
      return Response.json({ error: "Database error updating contract" }, { status: 500 })
    }

    const changedFields = Object.keys(parsed.data).join(", ")
    // Audit trail — must not be fire-and-forget
    if (!ownerTransferAudited) await writeActivity(params.id, ctx.userId, "UPDATED", changedFields)

    if (status && status !== existing.status) {
      // Audit trail — must not be fire-and-forget
      if (!ownerTransferAudited) await writeActivity(params.id, ctx.userId, "STATUS_CHANGED", `${existing.status} → ${status}`)
      if (status === "AWAITING_SIGNATURE") {
        fireAndLog(
          enqueueNotification("contract.sent_for_signing", params.id, ctx.userId, {}),
          "enqueueNotification:contract.sent_for_signing",
        )
        await writeInAppToOrgMembers(ctx.organizationId, params.id, "contract.sent_for_signing", "Ready for signing", `"${existing.title}" is ready for signing`)
      } else if (status === "ARCHIVED") {
        fireAndLog(
          enqueueNotification("contract.archived", params.id, ctx.userId, {}),
          "enqueueNotification:contract.archived",
        )
        await writeInAppToOrgMembers(ctx.organizationId, params.id, "contract.archived", "Contract archived", `A contract was archived`, ctx.userId)
      }
    }

    // Regenerate renewal alerts if any date-related field changed
    const dateFieldsTouched =
      endDate !== undefined ||
      renewalDate !== undefined ||
      parsed.data.noticePeriodDays !== undefined ||
      parsed.data.renewalReminderEnabled !== undefined

    if (dateFieldsTouched) {
      // Merge patched values over existing values
      const resolvedEndDate = endDate
        ? new Date(endDate)
        : existing.endDate ?? null
      const resolvedRenewalDate = renewalDate
        ? new Date(renewalDate)
        : existing.renewalDate ?? null
      const resolvedNoticePeriodDays =
        parsed.data.noticePeriodDays !== undefined
          ? parsed.data.noticePeriodDays
          : existing.noticePeriodDays ?? null
      const resolvedRenewalReminderEnabled =
        parsed.data.renewalReminderEnabled !== undefined
          ? parsed.data.renewalReminderEnabled
          : existing.renewalReminderEnabled

      fireAndLog(
        generateAlertsForContract(
          params.id,
          resolvedEndDate,
          resolvedRenewalDate,
          resolvedNoticePeriodDays,
          resolvedRenewalReminderEnabled,
        ).then(() => alertsCheckQueue.add("after-contract-change", { triggeredAt: new Date().toISOString() })),
        "generateAlertsForContract:contractUpdated",
      )
    }

    return Response.json(withoutContractIntakeIdentity(updated))
  });
}

export async function DELETE(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const roleError = requireRole(ctx.role, "legal")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404, headers: SECURE_HEADERS })
    const existing = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, status: true },
    })
    if (!existing) return new Response("Not Found", { status: 404 })
    if (existing.status === "ARCHIVED") {
      return Response.json({ error: "Contract is already archived" }, { status: 409 })
    }

    await prisma.contract.update({
      where: { id: params.id },
      data: { status: "ARCHIVED" },
    })

    // Audit trail — must not be fire-and-forget
    await writeActivity(params.id, ctx.userId, "ARCHIVED")

    fireAndLog(
      enqueueNotification("contract.archived", params.id, ctx.userId, {}),
      "enqueueNotification:contract.archived",
    )
    await writeInAppToOrgMembers(ctx.organizationId, params.id, "contract.archived", "Contract archived", `"${existing.title}" was archived`, ctx.userId)

    return new Response(null, { status: 204 })
  })
}
