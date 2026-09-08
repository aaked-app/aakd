import { prisma } from "@/lib/db/client"
import { decrypt } from "@/lib/notifications/crypto"
import type { DocuSealConfig } from "@/lib/docuseal"
type SignatureDb = {
  findUnique: (args: unknown) => Promise<unknown>
}
const signatureDb = (prisma as unknown as { signatureIntegration: SignatureDb }).signatureIntegration

export async function getDocuSealConfig(organizationId: string): Promise<DocuSealConfig | null> {
  if (!signatureDb) return null
  const integration = await signatureDb.findUnique({
    where: { organizationId },
    select: { provider: true, baseUrl: true, encryptedApiKey: true, enabled: true },
  })
  const row = integration as { provider: string; baseUrl: string; encryptedApiKey: string; enabled: boolean } | null
  if (!row?.enabled || row.provider !== "DOCUSEAL") return null
  try {
    return { baseUrl: row.baseUrl, apiKey: decrypt(row.encryptedApiKey) }
  } catch {
    return null
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
