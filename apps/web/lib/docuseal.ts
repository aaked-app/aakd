/**
 * Thin wrapper around the DocuSeal REST API.
 * All functions return null (and log a warning) when DOCUSEAL_API_KEY is not set.
 * Never import any third-party DocuSeal SDK — use fetch only.
 */
import { logger } from "@/lib/logger"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"
import { canonicalProviderOrigin } from "@/lib/notifications/validate-webhook-url"
import { pinnedProviderFetch } from "@/lib/security/pinned-provider-fetch"
import { z } from "zod"

export type DocuSealConfig = { baseUrl: string; apiKey: string }

export const DOCUSEAL_JSON_BODY_LIMIT = 1024 * 1024
const JSON_REQUEST_TIMEOUT_MS = 30_000
const CONNECTION_TEST_TIMEOUT_MS = 10_000
const CONNECT_TIMEOUT_MS = 10_000

function environmentConfig(): DocuSealConfig {
  return {
    baseUrl: process.env.DOCUSEAL_API_URL || process.env.DOCUSEAL_BASE_URL || "https://api.docuseal.com",
    apiKey: process.env.DOCUSEAL_API_KEY ?? "",
  }
}

function activeConfig(config?: DocuSealConfig): DocuSealConfig {
  return config ?? environmentConfig()
}

async function boundedTrustedFetch(url: string, init: RequestInit, maxResponseBytes: number, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const response = await fetch(url, { ...init, signal, redirect: "error" })
  const body = await readBoundedResponseBody(response, maxResponseBytes)
  const headers = new Headers(response.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")
  return new Response(response.status === 204 ? null : new Uint8Array(body), {
    status: response.status,
    headers,
  })
}

async function docuSealFetch(
  url: string,
  init: RequestInit,
  configWasProvided: boolean,
  maxResponseBytes = DOCUSEAL_JSON_BODY_LIMIT,
  timeoutMs = JSON_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  if (!configWasProvided) return boundedTrustedFetch(url, init, maxResponseBytes, timeoutMs)
  return pinnedProviderFetch(url, init, {
    privateOrigins: process.env.DOCUSEAL_PRIVATE_ORIGINS,
    timeoutMs,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    maxResponseBytes,
  })
}

/**
 * SSRF guard. DocuSeal returns signed-PDF URLs in its webhooks and submission
 * responses; we never fetch a URL we received from an external party without
 * confirming its origin matches our configured DocuSeal endpoint. This blocks
 * an attacker who can forge or replay a webhook from pointing us at an
 * internal address (e.g. cloud metadata service).
 */
export function isAllowedDocuSealUrl(url: string): boolean {
  return isAllowedDocuSealUrlFor(url, environmentConfig())
}

export function isAllowedDocuSealUrlFor(url: string, config: DocuSealConfig): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password || parsed.hash) return false

  let base: URL
  try {
    base = new URL(config.baseUrl)
  } catch {
    return false
  }
  if ((base.protocol !== "https:" && base.protocol !== "http:") || base.username || base.password) return false
  return canonicalProviderOrigin(parsed) === canonicalProviderOrigin(base)
}

export async function fetchDocuSealDocument(
  url: string,
  config?: DocuSealConfig,
): Promise<Response> {
  const active = activeConfig(config)
  if (!isAllowedDocuSealUrlFor(url, active)) throw new Error("Signed document URL rejected")
  return docuSealFetch(url, {}, config !== undefined, 50 * 1024 * 1024, JSON_REQUEST_TIMEOUT_MS)
}

function authHeaders(config: DocuSealConfig): Record<string, string> {
  return {
    "X-Auth-Token": config.apiKey,
  }
}

function warnMissing(): null {
  logger.warn("[docuseal] DOCUSEAL_API_KEY is not configured — skipping DocuSeal call")
  return null
}

export async function testDocuSealConnection(config: DocuSealConfig): Promise<boolean> {
  if (!config.apiKey) return false
  try {
    const res = await docuSealFetch(`${config.baseUrl.replace(/\/$/, "")}/templates?limit=1`, {
      method: "GET",
      headers: authHeaders(config),
    }, true, DOCUSEAL_JSON_BODY_LIMIT, CONNECTION_TEST_TIMEOUT_MS)
    return res.ok
  } catch {
    return false
  }
}

// ─── createTemplate ───────────────────────────────────────────────────────────

/**
 * Upload a PDF buffer to DocuSeal as a template.
 * DocuSeal Cloud expects JSON + base64-encoded file at POST /templates/pdf.
 * (multipart/form-data is rejected with a 422 JSON parse error on Cloud.)
 * Returns { id: templateId } or null if unconfigured / on error.
 */
export async function createTemplate(
  name: string,
  pdfBuffer: Buffer,
  config?: DocuSealConfig,
): Promise<{ id: number; attachmentUuid: string | null } | null> {
  const active = activeConfig(config)
  if (!active.apiKey) return warnMissing()

  const base64File = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`

  const res = await docuSealFetch(`${active.baseUrl.replace(/\/$/, "")}/templates/pdf`, {
    method: "POST",
    headers: {
      ...authHeaders(active),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      documents: [{ name: `${name}.pdf`, file: base64File }],
    }),
  }, config !== undefined)

  if (!res.ok) {
    logger.error({ status: res.status }, "[docuseal] createTemplate failed")
    return null
  }

  const parsed = z.object({
    id: z.number().int().positive(),
    schema: z.array(z.object({ attachment_uuid: z.string().min(1).optional() }).passthrough()).optional(),
  }).passthrough().safeParse(await res.json().catch(() => null))
  if (!parsed.success) return null
  return { id: parsed.data.id, attachmentUuid: parsed.data.schema?.[0]?.attachment_uuid ?? null }
}

// ─── addFieldsToTemplate ─────────────────────────────────────────────────────

/**
 * Add one signature field per role to a template.
 * Must be called before createSubmission — DocuSeal rejects submissions
 * on templates with no fields.
 *
 * Fields are stacked near the bottom-right of the first page,
 * one per signer role, spaced 8% of page height apart.
 */
export async function addFieldsToTemplate(
  templateId: number,
  attachmentUuid: string,
  roles: string[],
  config?: DocuSealConfig,
): Promise<boolean> {
  const active = activeConfig(config)
  if (!active.apiKey) return false

  const fields = roles.map((role, i) => ({
    name: `Signature ${i + 1}`,
    type: "signature",
    role,
    required: true,
    areas: [
      {
        x: 0.55,
        y: Math.max(0.88 - i * 0.10, 0.05), // stack upward, clamp to top
        w: 0.38,
        h: 0.06,
        page: 0,
        attachment_uuid: attachmentUuid,
      },
    ],
  }))

  const res = await docuSealFetch(`${active.baseUrl.replace(/\/$/, "")}/templates/${templateId}`, {
    method: "PUT",
    headers: {
      ...authHeaders(active),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  }, config !== undefined)

  if (!res.ok) {
    logger.error({ templateId, status: res.status }, "[docuseal] addFieldsToTemplate failed")
    return false
  }

  return true
}

// ─── createSubmission ─────────────────────────────────────────────────────────

export interface DocuSealSubmitter {
  slug: string
  embed_src: string
}

export interface DocuSealSubmission {
  id: number
  submitters: DocuSealSubmitter[]
}

const submitterSchema = z.object({
  slug: z.string().min(1),
  embed_src: z.string().url(),
  submission_id: z.number().int().positive().optional(),
  id: z.number().int().positive().optional(),
}).passthrough()

/**
 * Create a submission (send for signing).
 * POST /submissions
 * Returns { id, submitters: [{ slug, embed_src }] } or null if unconfigured.
 */
export async function createSubmission(
  templateId: number,
  signers: { email: string; name: string; role: string }[],
  config?: DocuSealConfig,
): Promise<DocuSealSubmission | null> {
  const active = activeConfig(config)
  if (!active.apiKey) return warnMissing()

  const res = await docuSealFetch(`${active.baseUrl.replace(/\/$/, "")}/submissions`, {
    method: "POST",
    headers: {
      ...authHeaders(active),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      send_email: true,
      submitters: signers.map((s) => ({
        email: s.email,
        name: s.name,
        role: s.role,
      })),
    }),
  }, config !== undefined)

  if (!res.ok) {
    logger.error({ templateId, status: res.status }, "[docuseal] createSubmission failed")
    return null
  }

  const data = await res.json().catch(() => null)

  // DocuSeal Cloud POST /submissions returns a flat array of submitter objects:
  //   [{ id: <submitterId>, submission_id: <submissionId>, slug, embed_src, ... }]
  // Self-hosted returns:
  //   { id: <submissionId>, submitters: [{ slug, embed_src, ... }] }
  // Handle both shapes.
  if (Array.isArray(data)) {
    const parsed = z.array(submitterSchema).min(1).safeParse(data)
    if (!parsed.success) return null
    const submissionId = parsed.data[0].submission_id ?? parsed.data[0].id
    if (!submissionId) return null
    return {
      id: submissionId,
      submitters: parsed.data.map((s) => ({
        slug: s.slug,
        embed_src: s.embed_src,
      })),
    }
  }

  const parsed = z.object({
    id: z.number().int().positive(),
    submitters: z.array(submitterSchema),
  }).passthrough().safeParse(data)
  if (!parsed.success) return null
  return {
    id: parsed.data.id,
    submitters: parsed.data.submitters.map(({ slug, embed_src }) => ({ slug, embed_src })),
  }
}

// ─── remindSubmitter ──────────────────────────────────────────────────────────

/**
 * Send a reminder email to a specific submitter.
 * POST /submitters/{slug}/remind
 */
export async function remindSubmitter(slug: string, config?: DocuSealConfig): Promise<boolean> {
  const active = activeConfig(config)
  if (!active.apiKey) return false
  const res = await docuSealFetch(`${active.baseUrl.replace(/\/$/, "")}/submitters/${slug}/remind`, {
    method: "POST",
    headers: authHeaders(active),
  }, config !== undefined)
  return res.ok
}

// ─── archiveSubmission ────────────────────────────────────────────────────────

/**
 * Archive (void) a DocuSeal submission.
 * PUT /submissions/:id/archive
 * Returns true on success, false if unconfigured or on error.
 */
export async function archiveSubmission(submissionId: number, config?: DocuSealConfig): Promise<boolean> {
  const active = activeConfig(config)
  if (!active.apiKey) return false
  const res = await docuSealFetch(`${active.baseUrl.replace(/\/$/, "")}/submissions/${submissionId}/archive`, {
    method: "PUT",
    headers: authHeaders(active),
  }, config !== undefined)
  if (!res.ok) {
    logger.error({ submissionId, status: res.status }, "[docuseal] archiveSubmission failed")
    return false
  }
  return true
}

// ─── getSubmission ────────────────────────────────────────────────────────────

export interface DocuSealSubmissionDetail {
  id: number
  status: string
  documents: { url: string }[]
  submitters: { slug: string; status: string; completed_at?: string | null }[]
}

/**
 * Get submission status — used to verify webhook payloads.
 * GET /submissions/:id
 * Returns the submission or null if unconfigured / not found.
 */
export async function getSubmission(
  submissionId: number,
  config?: DocuSealConfig,
): Promise<DocuSealSubmissionDetail | null> {
  const active = activeConfig(config)
  if (!active.apiKey) return warnMissing()

  const res = await docuSealFetch(`${active.baseUrl.replace(/\/$/, "")}/submissions/${submissionId}`, {
    method: "GET",
    headers: authHeaders(active),
  }, config !== undefined)

  if (!res.ok) {
    logger.error({ submissionId, status: res.status }, "[docuseal] getSubmission failed")
    return null
  }

  const parsed = z.object({
    id: z.number().int().positive(),
    status: z.string().min(1),
    documents: z.array(z.object({ url: z.string().url() }).passthrough()).default([]),
    submitters: z.array(z.object({
      slug: z.string().min(1),
      status: z.string().min(1),
      completed_at: z.string().nullable().optional(),
    }).passthrough()).default([]),
  }).passthrough().safeParse(await res.json().catch(() => null))
  if (!parsed.success || parsed.data.id !== submissionId) return null
  return {
    id: parsed.data.id,
    status: parsed.data.status,
    documents: parsed.data.documents,
    submitters: parsed.data.submitters,
  }
}
