import { prisma } from "@/lib/db/client"
import { decrypt } from "@/lib/notifications/crypto"
import type { DocuSealConfig } from "@/lib/docuseal"
import { docuSealEnvironmentProviderId, resolveDocuSealConfigFromDb, type DocuSealConfigResolution } from "@/lib/signature/resolve-config"
type SignatureDb = { findUnique: (args: unknown) => Promise<unknown> }
const signatureDb = (prisma as unknown as { signatureIntegration: SignatureDb }).signatureIntegration

export async function getDocuSealConfig(organizationId: string): Promise<DocuSealConfig | null> {
  return (await getDocuSealConfigResolution(organizationId)).config
}

export async function getDocuSealConfigResolution(
  organizationId: string,
): Promise<DocuSealConfigResolution> {
  const stored = await resolveDocuSealConfigFromDb(
    { signatureIntegration: signatureDb as never },
    organizationId,
  )
  // A stored integration is authoritative. Corrupt or undecryptable credentials
  // must never fall through to another organization's/operator's environment key.
  if (stored.configured) return stored
  const apiKey = process.env.DOCUSEAL_API_KEY?.trim()
  const baseUrl = process.env.DOCUSEAL_API_URL || process.env.DOCUSEAL_BASE_URL || "https://api.docuseal.com"
  if (!apiKey) return { configured: false, config: null, providerId: null }
  return {
    configured: false,
    config: { baseUrl, apiKey },
    providerId: docuSealEnvironmentProviderId(baseUrl),
  }
}

export async function getDocuSealWebhookSecret(organizationId: string): Promise<string | null> {
  if (!signatureDb) return null
  const integration = await signatureDb.findUnique({
    where: { organizationId },
    select: { encryptedWebhookSecret: true, enabled: true, provider: true },
  })
  const row = integration as { provider: string; encryptedWebhookSecret: string | null; enabled: boolean } | null
  if (!row?.enabled || row.provider !== "DOCUSEAL" || !row.encryptedWebhookSecret) return null
  try {
    return decrypt(row.encryptedWebhookSecret)
  } catch {
    return null
  }
}

export async function getDocuSealWebhookIntegration(integrationId: string): Promise<{
  organizationId: string
  providerId: string
  secret: string
} | null> {
  if (!signatureDb) return null
  const integration = await signatureDb.findUnique({
    where: { id: integrationId },
    select: { id: true, organizationId: true, encryptedWebhookSecret: true, enabled: true, provider: true },
  })
  const row = integration as { id: string; organizationId: string; provider: string; encryptedWebhookSecret: string | null; enabled: boolean } | null
  if (!row?.enabled || row.provider !== "DOCUSEAL" || !row.encryptedWebhookSecret) return null
  try {
    return {
      organizationId: row.organizationId,
      providerId: `integration:${row.id}`,
      secret: decrypt(row.encryptedWebhookSecret),
    }
  } catch {
    return null
  }
}
