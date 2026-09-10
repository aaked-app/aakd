import { z } from "zod"
import { resolveAuth } from "@/lib/auth/middleware"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { IntakeContractMetadataSchema, normalizeCreateContractInput } from "@/lib/contracts/create-schema"
import { detectContractFileMime, MAX_CONTRACT_FILE_BYTES, sanitizeContractFilename } from "@/lib/contracts/file-validation"
import {
  ContractIntakeError,
  createContractIntake,
  findContractIntakeReplay,
  validateIntakeExtractions,
} from "@/lib/contracts/intake"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { requestLogger } from "@/lib/logger"

const RequestIdSchema = z.string().uuid()
const FORM_FIELDS = new Set(["requestId", "metadata", "extractions", "file"])

function onlyOne(form: FormData, key: string): FormDataEntryValue | null {
  const values = form.getAll(key)
  return values.length === 1 ? values[0] : null
}

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx?.memberId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })

  const parsed = RequestIdSchema.safeParse(new URL(req.url).searchParams.get("requestId"))
  if (!parsed.success) return Response.json({ error: "invalid_request_id" }, { status: 422 })

  return requestContext.run(ctx, async () => {
    const result = await findContractIntakeReplay(prisma, ctx, parsed.data)
    return result
      ? Response.json(result)
      : Response.json({ error: "Not Found" }, { status: 404 })
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx?.memberId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError

  const limited = await rateLimit(`${ctx.organizationId}:create-contract`, 20, 60_000)
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "invalid_form_data" }, { status: 400 })
  }
  if ([...form.keys()].some(key => !FORM_FIELDS.has(key))) {
    return Response.json({ error: "unsupported_form_field" }, { status: 422 })
  }
  const requestIdField = onlyOne(form, "requestId")
  const metadataField = onlyOne(form, "metadata")
  const extractionsField = onlyOne(form, "extractions")
  const fileField = onlyOne(form, "file")
  if (typeof requestIdField !== "string" || typeof metadataField !== "string" || typeof extractionsField !== "string" || !(fileField instanceof File)) {
    return Response.json({ error: "invalid_form_data" }, { status: 422 })
  }

  const requestId = RequestIdSchema.safeParse(requestIdField)
  if (!requestId.success) return Response.json({ error: "invalid_request_id" }, { status: 422 })
  if (fileField.size > MAX_CONTRACT_FILE_BYTES) return Response.json({ error: "file_too_large" }, { status: 413 })

  let rawMetadata: unknown
  let rawExtractions: unknown
  try {
    rawMetadata = JSON.parse(metadataField)
    rawExtractions = JSON.parse(extractionsField)
  } catch {
    return Response.json({ error: "invalid_json_fields" }, { status: 422 })
  }
  const parsedMetadata = IntakeContractMetadataSchema.safeParse(rawMetadata)
  if (!parsedMetadata.success) return Response.json({ error: "invalid_metadata" }, { status: 422 })

  let metadata
  let extractions
  try {
    metadata = normalizeCreateContractInput(parsedMetadata.data)
    extractions = validateIntakeExtractions(metadata, rawExtractions)
  } catch (error) {
    const intakeError = error instanceof ContractIntakeError ? error : new ContractIntakeError("invalid_metadata", 422)
    return Response.json({ error: intakeError.code }, { status: intakeError.status })
  }

  const buffer = Buffer.from(await fileField.arrayBuffer())
  const mimeType = detectContractFileMime(buffer)
  if (!mimeType) return Response.json({ error: "unsupported_file_type" }, { status: 415 })
  const filename = sanitizeContractFilename(fileField.name)
  const log = requestLogger(ctx.requestId)

  return requestContext.run(ctx, async () => {
    try {
      const result = await createContractIntake(prisma, ctx, {
        requestId: requestId.data,
        metadata,
        extractions,
        file: { buffer, filename, mimeType },
      })
      log.info({ contractId: result.id, replayed: result.replayed }, "[POST /contracts/intake] durable")
      return Response.json(result, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      if (error instanceof ContractIntakeError) {
        return Response.json({ error: error.code }, { status: error.status })
      }
      log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "[POST /contracts/intake] failed")
      return Response.json({ error: "contract_intake_failed" }, { status: 500 })
    }
  })
}
