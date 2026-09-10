import { createHash, createHmac, timingSafeEqual } from "crypto"
import { z } from "zod"
import { DOCUSEAL_JSON_BODY_LIMIT } from "@/lib/docuseal"
import { signingSyncQueue } from "@/lib/jobs/queues"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { getDocuSealWebhookIntegration } from "@/lib/signature/config"
import { docuSealEnvironmentProviderId } from "@/lib/signature/resolve-config"

const webhookSchema = z.object({
  event_type: z.string().min(1).max(100),
  timestamp: z.string().max(100).optional(),
  data: z.object({
    id: z.number().int().positive(),
    submission_id: z.number().int().positive().optional(),
    status: z.string().max(100).optional(),
    slug: z.string().max(500).optional(),
  }).passthrough(),
}).passthrough()

async function readBoundedBody(req: Request): Promise<Buffer> {
  // The fallback only supports test harnesses that replace the DocuSeal module;
  // production always imports the exported canonical limit.
  const maxBytes = Number.isSafeInteger(DOCUSEAL_JSON_BODY_LIMIT)
    ? DOCUSEAL_JSON_BODY_LIMIT
    : 1024 * 1024
  const declared = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("payload_too_large")
  if (!req.body) return Buffer.alloc(0)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error("payload_too_large")
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, total)
}

function validSignature(raw: Buffer, supplied: string | null, secret: string | null | undefined): boolean {
  if (!supplied || !secret) return false
  const value = supplied.startsWith("sha256=") ? supplied.slice(7) : supplied
  if (!/^[a-f\d]{64}$/i.test(value)) return false
  const expected = createHmac("sha256", secret).update(raw).digest()
  return timingSafeEqual(expected, Buffer.from(value, "hex"))
}

export async function POST(req: Request) {
  let raw: Buffer
  try {
    raw = await readBoundedBody(req)
  } catch {
    return Response.json({ error: "payload_too_large" }, { status: 413 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw.toString("utf8"))
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = webhookSchema.safeParse(json)
  if (!parsed.success) return Response.json({ error: "Invalid webhook payload" }, { status: 422 })

  const integrationId = new URL(req.url).searchParams.get("integrationId")
  const integration = integrationId ? await getDocuSealWebhookIntegration(integrationId) : null
  const envBaseUrl = process.env.DOCUSEAL_API_URL || process.env.DOCUSEAL_BASE_URL || "https://api.docuseal.com"
  const providerId = integration?.providerId ?? (integrationId ? null : docuSealEnvironmentProviderId(envBaseUrl))
  const secret = integration?.secret ?? (integrationId ? null : process.env.DOCUSEAL_WEBHOOK_SECRET)
  if (!providerId || !validSignature(raw, req.headers.get("x-docuseal-signature"), secret)) {
    return Response.json({ error: "Invalid or missing signature" }, { status: 403 })
  }
  if (isAgreementAccessEmergencyDenyAll()) {
    return Response.json({ error: "service_unavailable" }, { status: 503 })
  }

  const submissionId = String(parsed.data.data.submission_id ?? parsed.data.data.id)
  const eventKey = createHash("sha256").update(JSON.stringify({
    providerId,
    event: parsed.data.event_type,
    timestamp: parsed.data.timestamp ?? null,
    submissionId,
    submitterId: parsed.data.data.id,
    status: parsed.data.data.status ?? null,
  })).digest("hex")
  await signingSyncQueue.add("sync", {
    triggeredAt: parsed.data.timestamp ?? new Date().toISOString(),
    submissionId,
    providerId,
    organizationId: integration?.organizationId,
  }, { jobId: `docuseal-webhook-${eventKey}` })
  return Response.json({ ok: true })
}
