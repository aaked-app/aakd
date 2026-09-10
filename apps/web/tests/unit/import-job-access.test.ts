import { describe, expect, it, vi } from "vitest"
import { hasImportJobAccess } from "@/lib/auth/import-job-access"

const ctx = { organizationId: "org-a", memberId: "member-a", userId: "user-a" }

function db(rows: Array<{ contractId: string | null }>, granted: string[]) {
  return {
    importRow: { findMany: vi.fn().mockResolvedValue(rows) },
    contractAccessGrant: {
      findMany: vi.fn().mockResolvedValue(granted.map((contractId) => ({ contractId }))),
    },
  }
}

describe("import job agreement access", () => {
  it.each([
    { rows: [{ contractId: "contract-a" }] },
    { rows: [{ contractId: "contract-a" }, { contractId: null }] },
  ])("denies a creator after any represented agreement grant is revoked", async ({ rows }) => {
    await expect(hasImportJobAccess(db(rows, []), ctx, { id: "job-a", createdById: ctx.userId })).resolves.toBe(false)
  })

  it("denies a missing current membership even for an empty creator job", async () => {
    await expect(hasImportJobAccess(db([], []), { ...ctx, memberId: undefined }, { id: "job-a", createdById: ctx.userId })).resolves.toBe(false)
  })

  it("denies even the creator while emergency deny-all is active", async () => {
    const original = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
    const client = db([], [])
    try {
      await expect(hasImportJobAccess(
        client,
        ctx,
        { id: "job-a", createdById: "user-a" },
      )).resolves.toBe(false)
      expect(client.importRow.findMany).not.toHaveBeenCalled()
      expect(client.contractAccessGrant.findMany).not.toHaveBeenCalled()
    } finally {
      if (original === undefined) delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      else process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = original
    }
  })

  it("requires every represented contract grant", async () => {
    await expect(hasImportJobAccess(
      db([{ contractId: "contract-a" }, { contractId: "contract-b" }], ["contract-a"]),
      ctx,
      { id: "job-a", createdById: "user-other" },
    )).resolves.toBe(false)
  })

  it("allows a fully granted job without granting access to unbound rows", async () => {
    await expect(hasImportJobAccess(
      db([{ contractId: "contract-a" }, { contractId: "contract-b" }], ["contract-a", "contract-b"]),
      ctx,
      { id: "job-a", createdById: "user-other" },
    )).resolves.toBe(true)
  })

  it.each([
    { rows: [] },
    { rows: [{ contractId: "contract-a" }, { contractId: null }] },
  ])("keeps empty or unbound job details creator-only", async ({ rows }) => {
    await expect(hasImportJobAccess(
      db(rows, ["contract-a"]),
      ctx,
      { id: "job-a", createdById: "user-other" },
    )).resolves.toBe(false)
    await expect(hasImportJobAccess(
      db(rows, ["contract-a"]),
      ctx,
      { id: "job-a", createdById: "user-a" },
    )).resolves.toBe(true)
  })
})
