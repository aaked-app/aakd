import { createHash } from "crypto"
import { decrypt } from "@/lib/notifications/crypto"
import { canonicalProviderOrigin } from "@/lib/notifications/validate-webhook-url"
import type { DocuSealConfig } from "@/lib/docuseal"

type SignatureIntegrationRow = {
  id: string
  organizationId: string
  provider: string
  baseUrl: string
  encryptedApiKey: string
  enabled: boolean
}

export type SignatureConfigDb = {
  signatureIntegration?: {
    findUnique: (args: {
      where: { organizationId: string }
      select: { id: true; organizationId: true; provider: true; baseUrl: true; encryptedApiKey: true; enabled: true }
    }) => Promise<SignatureIntegrationRow | null>
  }
}

export type DocuSealConfigResolution = {
  configured: boolean
  config: DocuSealConfig | null
  providerId: string | null
}

export function docuSealIntegrationProviderId(integrationId: string): string {
  return `integration:${integrationId}`
}

export function canonicalDocuSealBaseIdentity(baseUrl: string): string | null {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return null
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null
  const pathname = url.pathname.replace(/\/+$/, "")
  return `${canonicalProviderOrigin(url)}${pathname}`
}

export function docuSealEnvironmentProviderId(baseUrl: string): string | null {
  const identity = canonicalDocuSealBaseIdentity(baseUrl)
  if (!identity) return null
  return `environment:${createHash("sha256").update(identity).digest("hex")}`
}

export async function resolveDocuSealConfigFromDb(
  db: SignatureConfigDb,
  organizationId: string,
): Promise<DocuSealConfigResolution> {
  if (!db.signatureIntegration) return { configured: false, config: null, providerId: null }
  const row = await db.signatureIntegration.findUnique({
    where: { organizationId },
    select: { id: true, organizationId: true, provider: true, baseUrl: true, encryptedApiKey: true, enabled: true },
  })
  if (!row?.enabled || row.provider !== "DOCUSEAL") return { configured: false, config: null, providerId: null }
  if (row.organizationId !== organizationId) return { configured: true, config: null, providerId: null }
  const providerId = docuSealIntegrationProviderId(row.id)
  try {
    return { configured: true, config: { baseUrl: row.baseUrl, apiKey: decrypt(row.encryptedApiKey) }, providerId }
  } catch {
    return { configured: true, config: null, providerId }
  }
}
