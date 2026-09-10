import { createHash, randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { buildContractAlertPlan } from "@/lib/alerts/generate"
import type { RequestContext } from "@/lib/context"
import { lockCurrentAgreementPermission, hasAgreementAccess } from "@/lib/auth/agreement-access"
import { hasRole } from "@/lib/auth/roles"
import { normalizeCreateContractInput, type CreateContractInput } from "@/lib/contracts/create-schema"
import { sanitizeContractFilename, type ContractFileMime } from "@/lib/contracts/file-validation"
import { withTransactionRetry } from "@/lib/db/transaction-retry"
import { getContractExtractQueue, getDocumentConvertQueue } from "@/lib/jobs/queues"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"

const EXTRACTION_FIELDS = [
  "contractType", "startDate", "endDate", "renewalDate", "value", "currency",
  "counterpartyName", "governingLaw", "noticePeriodDays", "autoRenewal",
] as const

const extractionFieldSet = new Set<string>(EXTRACTION_FIELDS)

export type IntakeExtractionSeed = {
  field: typeof EXTRACTION_FIELDS[number]
  rawValue: string
  confidence: number
  extractedBy: "ai" | "manual"
}

export type ContractIntakeInput = {
  requestId: string
  metadata: CreateContractInput
  extractions: IntakeExtractionSeed[]
  file: { buffer: Buffer; filename: string; mimeType: ContractFileMime }
}

export type ContractIntakeResult = {
  id: string
  extractionQueued: boolean
  conversionQueued: boolean
  replayed: boolean
}

export class ContractIntakeError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = "ContractIntakeError"
  }
}

type IntakeDb = typeof import("@/lib/db/client").prisma
type IntakeStorage = Pick<typeof storage, "upload" | "delete">
type IntakeQueues = {
  extract: {
    add: (...args: Parameters<ReturnType<typeof getContractExtractQueue>["add"]>) => ReturnType<ReturnType<typeof getContractExtractQueue>["add"]>
    getJob?: (id: string) => Promise<{ getState(): Promise<string>; retry(): Promise<void> } | undefined>
  }
  convert: {
    add: (...args: Parameters<ReturnType<typeof getDocumentConvertQueue>["add"]>) => ReturnType<ReturnType<typeof getDocumentConvertQueue>["add"]>
    getJob?: (id: string) => Promise<{ getState(): Promise<string>; retry(): Promise<void> } | undefined>
  }
}

type PersistedIntake = {
  id: string
  requestHash: string | null
  requestedByMemberId: string | null
  file: { id: string; storageKey: string; mimeType: string } | null
}

function canonicalMetadataValue(metadata: CreateContractInput, field: IntakeExtractionSeed["field"]): unknown {
  return metadata[field as keyof CreateContractInput]
}

function manualValueMatchesCanonical(rawValue: string, canonical: unknown): boolean {
  if (rawValue === "") return canonical === undefined || canonical === null || canonical === ""
  if (canonical === undefined || canonical === null || canonical === "") return false
  if (typeof canonical === "number") return Number(rawValue) === canonical
  if (typeof canonical === "boolean") return rawValue === String(canonical)
  return rawValue === String(canonical)
}

export function validateIntakeExtractions(
  metadata: CreateContractInput,
  values: unknown,
): IntakeExtractionSeed[] {
  if (!Array.isArray(values) || values.length > EXTRACTION_FIELDS.length) {
    throw new ContractIntakeError("invalid_extractions", 422)
  }
  const seen = new Set<string>()
  const normalized: IntakeExtractionSeed[] = []
  for (const value of values) {
    if (!value || typeof value !== "object") throw new ContractIntakeError("invalid_extractions", 422)
    const row = value as Record<string, unknown>
    if (Object.keys(row).some(key => !["field", "rawValue", "confidence", "extractedBy"].includes(key))) {
      throw new ContractIntakeError("invalid_extractions", 422)
    }
    if (typeof row.field !== "string" || !extractionFieldSet.has(row.field) || seen.has(row.field)) {
      throw new ContractIntakeError("invalid_extractions", 422)
    }
    if (typeof row.rawValue !== "string" || (row.extractedBy !== "ai" && row.extractedBy !== "manual")) {
      throw new ContractIntakeError("invalid_extractions", 422)
    }
    if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) {
      throw new ContractIntakeError("invalid_extractions", 422)
    }
    if (row.extractedBy === "ai" && row.rawValue === "") throw new ContractIntakeError("invalid_extractions", 422)
    const field = row.field as IntakeExtractionSeed["field"]
    if (row.extractedBy === "manual" && !manualValueMatchesCanonical(row.rawValue, canonicalMetadataValue(metadata, field))) {
      throw new ContractIntakeError("manual_extraction_mismatch", 422)
    }
    seen.add(field)
    normalized.push({
      field,
      rawValue: row.rawValue,
      confidence: row.extractedBy === "manual" ? 0 : row.confidence,
      extractedBy: row.extractedBy,
    })
  }
  return normalized.sort((left, right) => left.field.localeCompare(right.field))
}

export function contractIntakeHash(input: ContractIntakeInput): string {
  const fileHash = createHash("sha256").update(input.file.buffer).digest("hex")
  return createHash("sha256").update("v1\n").update(JSON.stringify({
    metadata: input.metadata,
    extractions: [...input.extractions].sort((left, right) => left.field.localeCompare(right.field)),
    filename: input.file.filename,
    mimeType: input.file.mimeType,
    fileHash,
  })).digest("hex")
}

function stagedKey(ctx: RequestContext, requestId: string, filename: string): string {
  return `intake/${ctx.organizationId}/${requestId}/${randomUUID()}/${filename}`
}

async function lockRequest(tx: Prisma.TransactionClient, organizationId: string, requestId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId})::int, hashtext(${requestId})::int)`
}

async function readPersisted(tx: Prisma.TransactionClient, organizationId: string, requestId: string): Promise<PersistedIntake | null> {
  const rows = await tx.$queryRaw<Array<{
    id: string
    intakeRequestHash: string | null
    intakeRequestedByMemberId: string | null
    fileId: string | null
    storageKey: string | null
    mimeType: string | null
  }>>(Prisma.sql`
    SELECT c."id", c."intakeRequestHash", c."intakeRequestedByMemberId",
      f."id" AS "fileId", f."storageKey", f."mimeType"
    FROM "Contract" AS c
    LEFT JOIN LATERAL (
      SELECT "id", "storageKey", "mimeType"
      FROM "ContractFile"
      WHERE "contractId" = c."id" AND "isLatest" = TRUE
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
    ) AS f ON TRUE
    WHERE c."organizationId" = ${organizationId} AND c."intakeRequestId" = ${requestId}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    requestHash: row.intakeRequestHash,
    requestedByMemberId: row.intakeRequestedByMemberId,
    file: row.fileId && row.storageKey && row.mimeType
      ? { id: row.fileId, storageKey: row.storageKey, mimeType: row.mimeType }
      : null,
  }
}

async function authorizeReplay(tx: Prisma.TransactionClient, ctx: RequestContext, row: PersistedIntake, requestHash: string) {
  if (row.requestedByMemberId !== ctx.memberId) throw new ContractIntakeError("not_found", 404)
  const permission = await lockCurrentAgreementPermission(tx, ctx as RequestContext & { memberId: string }, row.id)
  if (!permission) throw new ContractIntakeError("not_found", 404)
  if (row.requestHash !== requestHash) throw new ContractIntakeError("intake_request_conflict", 409)
  if (!row.file) throw new ContractIntakeError("intake_incomplete", 500)
}

async function cleanupAttempt(
  db: IntakeDb,
  objectStore: IntakeStorage,
  ctx: RequestContext,
  requestId: string,
  storageKey: string,
): Promise<void> {
  try {
    const referenced = await db.$transaction(async tx => {
      await lockRequest(tx, ctx.organizationId, requestId)
      const rows = await tx.$queryRaw<{ referenced: boolean }[]>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM "ContractFile" WHERE "storageKey" = ${storageKey}
        ) AS "referenced"
      `)
      return rows[0]?.referenced === true
    }, { isolationLevel: "ReadCommitted" })
    if (!referenced) await objectStore.delete(storageKey)
  } catch {
    logger.error({ organizationId: ctx.organizationId }, "[contract-intake] staged object retained after inconclusive cleanup")
  }
}

async function enqueueProcessing(
  queues: IntakeQueues,
  ctx: RequestContext,
  row: PersistedIntake,
): Promise<Pick<ContractIntakeResult, "extractionQueued" | "conversionQueued">> {
  if (!row.file) return { extractionQueued: false, conversionQueued: false }
  let extractionQueued = false
  let conversionQueued = false
  try {
    const jobId = `contract-text-${row.file.id}`
    const existing = await queues.extract.getJob?.(jobId)
    const state = existing ? await existing.getState() : null
    if (existing && state === "failed") await existing.retry()
    else if (!existing || state === "unknown") await queues.extract.add("extract", {
      contractId: row.id,
      organizationId: ctx.organizationId,
      fileId: row.file.id,
      storageKey: row.file.storageKey,
      preserveUserFields: true,
    }, { jobId })
    extractionQueued = true
  } catch {
    logger.error({ contractId: row.id }, "[contract-intake] extraction enqueue failed after durable commit")
  }
  try {
    const convertData = {
      contractId: row.id,
      organizationId: ctx.organizationId,
      sourceFileId: row.file.id,
      storageKey: row.file.storageKey,
      requestedById: ctx.userId,
      requestedByMemberId: ctx.memberId!,
      jobId: row.file.id,
      fileType: row.file.mimeType === "application/pdf" ? "pdf" as const : "docx" as const,
      deleteSource: false,
    }
    const jobId = `contract-document-${row.file.id}`
    const existing = await queues.convert.getJob?.(jobId)
    const state = existing ? await existing.getState() : null
    if (existing && state === "failed") await existing.retry()
    else if (!existing || state === "unknown") await queues.convert.add("convert", convertData, { jobId })
    conversionQueued = true
  } catch {
    logger.error({ contractId: row.id }, "[contract-intake] conversion enqueue failed after durable commit")
  }
  return { extractionQueued, conversionQueued }
}

export async function createContractIntake(
  db: IntakeDb,
  ctx: RequestContext,
  rawInput: ContractIntakeInput,
  deps: { objectStore?: IntakeStorage; queues?: IntakeQueues } = {},
): Promise<ContractIntakeResult> {
  if (ctx.source !== "session" || !ctx.memberId) throw new ContractIntakeError("human_session_required", 403)
  const memberId = ctx.memberId
  const objectStore = deps.objectStore ?? storage
  const queues = deps.queues ?? { extract: getContractExtractQueue(), convert: getDocumentConvertQueue() }
  const metadata = normalizeCreateContractInput(rawInput.metadata)
  const extractions = validateIntakeExtractions(metadata, rawInput.extractions)
  const input = { ...rawInput, metadata, extractions, file: { ...rawInput.file, filename: sanitizeContractFilename(rawInput.file.filename) } }
  const requestHash = contractIntakeHash(input)

  const known = await db.$queryRaw<{ present: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM "Contract"
      WHERE "organizationId" = ${ctx.organizationId} AND "intakeRequestId" = ${input.requestId}
    ) AS "present"
  `)
  if (known[0]?.present === true) {
    const replay = await withTransactionRetry(() => db.$transaction(async tx => {
      await lockRequest(tx, ctx.organizationId, input.requestId)
      const row = await readPersisted(tx, ctx.organizationId, input.requestId)
      if (!row) throw new ContractIntakeError("not_found", 404)
      await authorizeReplay(tx, ctx, row, requestHash)
      return row
    }, { isolationLevel: "ReadCommitted" }))
    return { id: replay.id, replayed: true, ...await enqueueProcessing(queues, ctx, replay) }
  }

  const storageKey = stagedKey(ctx, input.requestId, input.file.filename)
  try {
    await objectStore.upload(storageKey, input.file.buffer, input.file.mimeType)
  } catch {
    throw new ContractIntakeError("storage_upload_failed", 502)
  }
  let result: { row: PersistedIntake; replayed: boolean }
  try {
    result = await withTransactionRetry(() => db.$transaction(async tx => {
      await lockRequest(tx, ctx.organizationId, input.requestId)
      const existing = await readPersisted(tx, ctx.organizationId, input.requestId)
      if (existing) {
        await authorizeReplay(tx, ctx, existing, requestHash)
        return { row: existing, replayed: true }
      }

      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Member" WHERE "id" = ${memberId} AND "userId" = ${ctx.userId} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`)
      const member = await tx.member.findFirst({
        where: { id: memberId, userId: ctx.userId, organizationId: ctx.organizationId },
        select: { role: true },
      })
      if (!member || !hasRole(member.role, "member")) throw new ContractIntakeError("forbidden", 403)

      const { tagIds, folderId, startDate, endDate, renewalDate, ...rest } = metadata
      if (folderId && !await tx.folder.findFirst({ where: { id: folderId, organizationId: ctx.organizationId }, select: { id: true } })) {
        throw new ContractIntakeError("folder_not_found", 400)
      }
      if (tagIds.length > 0) {
        const tags = await tx.tag.findMany({ where: { id: { in: tagIds }, organizationId: ctx.organizationId }, select: { id: true } })
        if (tags.length !== tagIds.length) throw new ContractIntakeError("tags_not_found", 400)
      }

      const contractId = randomUUID()
      const alertPlan = buildContractAlertPlan(
        contractId,
        endDate ? new Date(endDate) : null,
        renewalDate ? new Date(renewalDate) : null,
        rest.noticePeriodDays ?? null,
        rest.renewalReminderEnabled,
      )
      const contract = await tx.contract.create({
        data: {
          id: contractId,
          ...rest,
          status: alertPlan.shouldExpire ? "EXPIRED" : undefined,
          ownerId: ctx.userId,
          organizationId: ctx.organizationId,
          intakeRequestId: input.requestId,
          intakeRequestHash: requestHash,
          intakeRequestedByMemberId: memberId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          renewalDate: renewalDate ? new Date(renewalDate) : undefined,
          folderId: folderId ?? undefined,
          tags: tagIds.length ? { connect: tagIds.map(id => ({ id })) } : undefined,
        },
        select: { id: true },
      })
      const grant = await tx.contractAccessGrant.create({
        data: { organizationId: ctx.organizationId, contractId: contract.id, memberId, grantedById: ctx.userId },
        select: { id: true },
      })
      if (extractions.length) {
        await tx.aIExtraction.createMany({
          data: extractions.map(seed => ({
            contractId: contract.id,
            field: seed.field,
            rawValue: seed.rawValue,
            confidence: seed.extractedBy === "manual" ? 0 : seed.confidence,
            sourceText: null,
            sourcePage: null,
            extractedBy: seed.extractedBy,
            status: seed.extractedBy === "manual" ? "accepted" : "pending",
          })),
        })
      }
      const file = await tx.contractFile.create({
        data: {
          contractId: contract.id,
          filename: input.file.filename,
          storageKey,
          mimeType: input.file.mimeType,
          sizeBytes: input.file.buffer.byteLength,
          isLatest: true,
          version: 1,
          uploadedById: ctx.userId,
        },
        select: { id: true, storageKey: true, mimeType: true },
      })
      await tx.contractVersion.create({
        data: { contractId: contract.id, version: 1, fileId: file.id, createdById: ctx.userId, changeNote: `Uploaded ${input.file.filename}` },
      })
      if (alertPlan.alerts.length) await tx.contractAlert.createMany({ data: alertPlan.alerts })
      await tx.activity.create({ data: { contractId: contract.id, userId: ctx.userId, action: "CREATED", metadata: { requestId: input.requestId } } })
      await tx.activity.create({ data: { contractId: contract.id, userId: ctx.userId, action: "ACCESS_GRANTED", metadata: { requestId: input.requestId, grantId: grant.id, targetMemberId: memberId } } })
      await tx.activity.create({ data: { contractId: contract.id, userId: ctx.userId, action: "UPLOADED", detail: input.file.filename, metadata: { requestId: input.requestId, fileId: file.id } } })
      if (alertPlan.shouldExpire) {
        await tx.activity.create({
          data: {
            contractId: contract.id,
            userId: ctx.userId,
            action: "STATUS_CHANGED",
            detail: "Contract end date is in the past — status automatically set to EXPIRED",
            metadata: { requestId: input.requestId, from: "DRAFT", to: "EXPIRED" },
          },
        })
      }
      return { row: { id: contract.id, requestHash, requestedByMemberId: memberId, file }, replayed: false }
    }, { isolationLevel: "ReadCommitted" }))
  } catch (error) {
    await cleanupAttempt(db, objectStore, ctx, input.requestId, storageKey)
    throw error
  }
  if (result.replayed) await cleanupAttempt(db, objectStore, ctx, input.requestId, storageKey)
  return { id: result.row.id, replayed: result.replayed, ...await enqueueProcessing(queues, ctx, result.row) }
}

export async function findContractIntakeReplay(db: IntakeDb, ctx: RequestContext, requestId: string): Promise<{ id: string } | null> {
  if (ctx.source !== "session" || !ctx.memberId) return null
  const row = await db.contract.findUnique({
    where: { organizationId_intakeRequestId: { organizationId: ctx.organizationId, intakeRequestId: requestId } },
    select: { id: true, intakeRequestedByMemberId: true },
  })
  if (!row || row.intakeRequestedByMemberId !== ctx.memberId) return null
  return await hasAgreementAccess(db, ctx, row.id) ? { id: row.id } : null
}
