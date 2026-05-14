/**
 * Unit tests for lib/ai/resolve.ts
 *
 * These tests mock both the Prisma OrgAiConfig lookup and the
 * lib/notifications/crypto module so nothing real is called.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ── Mocks must be declared before the module under test is imported ────────────

vi.mock("@/lib/db/client", () => ({
  prisma: {
    orgAiConfig: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/notifications/crypto", () => ({
  decrypt: vi.fn((ct: string) => ct.replace("enc:", "")),
}))

import { resolveAiConfig } from "@/lib/ai/resolve"
import { prisma } from "@/lib/db/client"

const mockFindUnique = prisma.orgAiConfig.findUnique as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearEnv() {
  delete process.env.AI_PROVIDER
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.OLLAMA_BASE_URL
  delete process.env.OLLAMA_MODEL
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("resolveAiConfig", () => {
  beforeEach(() => {
    clearEnv()
    mockFindUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
    clearEnv()
  })

  describe("org-level BYOK takes priority", () => {
    it("returns org anthropic config when OrgAiConfig exists", async () => {
      mockFindUnique.mockResolvedValue({
        provider: "anthropic",
        encryptedKey: "enc:sk-ant-secret",
        model: "claude-3-5-sonnet-latest",
      })

      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBe("anthropic")
      expect(result.apiKey).toBe("sk-ant-secret")
      expect(result.model).toBe("claude-3-5-sonnet-latest")
      expect(result.source).toBe("org")
    })

    it("returns org openai config when OrgAiConfig exists", async () => {
      mockFindUnique.mockResolvedValue({
        provider: "openai",
        encryptedKey: "enc:sk-openai-key",
        model: null,
      })

      process.env.ANTHROPIC_API_KEY = "env-anthropic-key"

      const result = await resolveAiConfig("org-456")

      expect(result.provider).toBe("openai")
      expect(result.apiKey).toBe("sk-openai-key")
      expect(result.model).toBeNull()
      expect(result.source).toBe("org")
    })

    it("org config takes priority over env vars", async () => {
      mockFindUnique.mockResolvedValue({
        provider: "anthropic",
        encryptedKey: "enc:org-key",
        model: null,
      })
      process.env.OPENAI_API_KEY = "env-openai-key"
      process.env.AI_PROVIDER = "openai"

      const result = await resolveAiConfig("org-789")

      expect(result.provider).toBe("anthropic")
      expect(result.apiKey).toBe("org-key")
      expect(result.source).toBe("org")
    })
  })

  describe("env var fallback", () => {
    it("falls back to anthropic env var when no org config", async () => {
      process.env.ANTHROPIC_API_KEY = "env-ant-key"

      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBe("anthropic")
      expect(result.apiKey).toBe("env-ant-key")
      expect(result.model).toBe("claude-haiku-4-5")
      expect(result.source).toBe("env")
    })

    it("uses ANTHROPIC_MODEL override from env", async () => {
      process.env.ANTHROPIC_API_KEY = "env-ant-key"
      process.env.ANTHROPIC_MODEL = "claude-opus-4"

      const result = await resolveAiConfig("org-123")

      expect(result.model).toBe("claude-opus-4")
    })

    it("falls back to openai env var when no org config and no anthropic key", async () => {
      process.env.OPENAI_API_KEY = "env-openai-key"

      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBe("openai")
      expect(result.apiKey).toBe("env-openai-key")
      expect(result.model).toBe("gpt-4o-mini")
      expect(result.source).toBe("env")
    })

    it("respects AI_PROVIDER=openai when both keys present", async () => {
      process.env.AI_PROVIDER = "openai"
      process.env.ANTHROPIC_API_KEY = "env-ant-key"
      process.env.OPENAI_API_KEY = "env-openai-key"

      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBe("openai")
      expect(result.source).toBe("env")
    })

    it("falls back to ollama when OLLAMA_BASE_URL is set", async () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434"

      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBe("ollama")
      expect(result.apiKey).toBeNull()
      expect(result.source).toBe("env")
    })
  })

  describe("no provider configured", () => {
    it("returns null provider when no org config and no env vars", async () => {
      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBeNull()
      expect(result.apiKey).toBeNull()
      expect(result.model).toBeNull()
      expect(result.source).toBeNull()
    })
  })

  describe("error handling", () => {
    it("falls back to env vars when OrgAiConfig DB lookup throws", async () => {
      mockFindUnique.mockRejectedValue(new Error("DB connection failed"))
      process.env.ANTHROPIC_API_KEY = "env-fallback-key"

      const result = await resolveAiConfig("org-123")

      expect(result.provider).toBe("anthropic")
      expect(result.source).toBe("env")
    })
  })
})
