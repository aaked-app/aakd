import fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/agreement-access", () => ({ isAgreementAccessEmergencyDenyAll: () => false }))

import {
  extractionPreviewResultKey,
  readExtractionPreviewResult,
  storeExtractionPreviewResult,
} from "@/lib/jobs/extraction-preview-result"

const now = Date.parse("2026-09-09T00:00:00.000Z")
const baseData = {
  jobId: "00000000-0000-4000-8000-000000000001",
  organizationId: "org-1",
  requestedByUserId: "user-1",
  requestedByMemberId: "member-1",
  storageKey: "previews/org-1/member-1/00000000-0000-4000-8000-000000000001/source",
  fileType: "pdf" as const,
  createdAt: now,
  expiresAt: now + 300_000,
}

describe("extraction preview Redis result retention", () => {
  beforeEach(() => vi.setSystemTime(now))
  afterEach(() => vi.useRealTimers())

  it("stores validated preview data with an absolute five-minute-or-earlier expiry", async () => {
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn(),
      del: vi.fn(),
    }
    const result = { counterpartyName: "TOPSECRET", contractType: "MSA" as const, confidence: {} }

    await storeExtractionPreviewResult(redis, { ...baseData, expiresAt: now + 900_000 }, result)

    expect(redis.set).toHaveBeenCalledTimes(1)
    const [key, payload, mode, expiresAt] = redis.set.mock.calls[0]
    expect(key).toBe(extractionPreviewResultKey(baseData))
    expect(JSON.parse(payload)).toEqual(result)
    expect(mode).toBe("PXAT")
    expect(expiresAt).toBe(now + 300_000)
  })

  it("returns the original validated schema and never a BullMQ wrapper", async () => {
    const result = { counterpartyName: "TOPSECRET", contractType: "MSA" as const, confidence: {} }
    const redis = {
      set: vi.fn(),
      get: vi.fn().mockResolvedValue(JSON.stringify(result)),
      del: vi.fn(),
    }

    await expect(readExtractionPreviewResult(redis, baseData)).resolves.toEqual(result)
  })

  it("deletes and withholds an expired result", async () => {
    const redis = {
      set: vi.fn(),
      get: vi.fn().mockResolvedValue(JSON.stringify({ counterpartyName: "TOPSECRET", confidence: {} })),
      del: vi.fn().mockResolvedValue(1),
    }

    await expect(readExtractionPreviewResult(redis, { ...baseData, expiresAt: now })).resolves.toBeNull()
    expect(redis.get).not.toHaveBeenCalled()
    expect(redis.del).toHaveBeenCalledWith(extractionPreviewResultKey(baseData))
  })

  it("encodes every ownership component without delimiter collisions", () => {
    fc.assert(fc.property(
      fc.tuple(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 40 }),
      ),
      ([organizationId, requestedByMemberId, jobId]) => {
        const key = extractionPreviewResultKey({ organizationId, requestedByMemberId, jobId })
        const parts = key.split(":")
        return parts.length === 5
          && decodeURIComponent(parts[2]) === organizationId
          && decodeURIComponent(parts[3]) === requestedByMemberId
          && decodeURIComponent(parts[4]) === jobId
      },
    ), { numRuns: 500 })
  })
})
