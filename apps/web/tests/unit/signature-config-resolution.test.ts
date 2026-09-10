import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetKeyCacheForTests, encrypt } from "@/lib/notifications/crypto"
import { docuSealEnvironmentProviderId, resolveDocuSealConfigFromDb } from "@/lib/signature/resolve-config"

const KEY = "8".repeat(64)

describe("worker-safe DocuSeal configuration resolution", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_ENCRYPTION_KEY", KEY)
    __resetKeyCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    __resetKeyCacheForTests()
  })

  it("treats reverse-proxy base paths as distinct environment provider identities", () => {
    expect(docuSealEnvironmentProviderId("https://docuseal.example/instance-a"))
      .not.toBe(docuSealEnvironmentProviderId("https://docuseal.example/instance-b"))
    expect(docuSealEnvironmentProviderId("https://DOCUSEAL.example:443/instance-a/"))
      .toBe(docuSealEnvironmentProviderId("https://docuseal.example/instance-a"))
  })

  it("decrypts an enabled organization integration from the injected database", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "integration-1",
      organizationId: "org-1",
      provider: "DOCUSEAL",
      baseUrl: "https://docuseal.example",
      encryptedApiKey: encrypt("organization-api-key"),
      enabled: true,
    })

    await expect(resolveDocuSealConfigFromDb({ signatureIntegration: { findUnique } }, "org-1"))
      .resolves.toEqual({
        configured: true,
        config: { baseUrl: "https://docuseal.example", apiKey: "organization-api-key" },
        providerId: "integration:integration-1",
      })
    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      select: { id: true, organizationId: true, provider: true, baseUrl: true, encryptedApiKey: true, enabled: true },
    })
  })

  it("distinguishes a broken stored integration from no organization integration", async () => {
    const brokenDb = {
      signatureIntegration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "integration-1",
          organizationId: "org-1",
          provider: "DOCUSEAL",
          baseUrl: "https://docuseal.example",
          encryptedApiKey: "not-valid-ciphertext",
          enabled: true,
        }),
      },
    }
    const emptyDb = {
      signatureIntegration: { findUnique: vi.fn().mockResolvedValue(null) },
    }

    await expect(resolveDocuSealConfigFromDb(brokenDb, "org-1"))
      .resolves.toEqual({ configured: true, config: null, providerId: "integration:integration-1" })
    await expect(resolveDocuSealConfigFromDb(emptyDb, "org-1"))
      .resolves.toEqual({ configured: false, config: null, providerId: null })
  })

  it("fails closed when an injected database returns another organization's integration", async () => {
    const db = { signatureIntegration: { findUnique: vi.fn().mockResolvedValue({
      id: "integration-other",
      organizationId: "org-other",
      provider: "DOCUSEAL",
      baseUrl: "https://docuseal.example",
      encryptedApiKey: encrypt("other-key"),
      enabled: true,
    }) } }
    await expect(resolveDocuSealConfigFromDb(db, "org-1")).resolves.toEqual({
      configured: true,
      config: null,
      providerId: null,
    })
  })
})
