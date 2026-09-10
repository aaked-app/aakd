import { describe, expect, it, vi } from "vitest"
import { assertAgreementBackfillActor } from "@/lib/auth/agreement-backfill-actor"
import { buildAgreementAccessPreflightReport } from "@/lib/auth/agreement-access-preflight"

function report() {
  return buildAgreementAccessPreflightReport({
    schema: { hasGrantTable: true, hasBriefAudienceMemberId: true }, existingGrants: [], briefs: [],
    contracts: ["org-a", "org-b"].map(organizationId => ({ organizationId, contractId: `${organizationId}-contract`, ownerUserId: "owner", memberId: `${organizationId}-owner` })),
  })
}

describe("reviewed backfill actor authorization", () => {
  it.each([
    { name: "unrelated user", rows: [] },
    { name: "only one affected organization", rows: [{ organizationId: "org-a", role: "owner" }] },
    { name: "downgraded role", rows: [{ organizationId: "org-a", role: "owner" }, { organizationId: "org-b", role: "member" }] },
    { name: "duplicate membership", rows: [{ organizationId: "org-a", role: "owner" }, { organizationId: "org-b", role: "owner" }, { organizationId: "org-b", role: "admin" }] },
  ])("rejects $name", async ({ rows }) => {
    const query = vi.fn().mockResolvedValue({ rows })
    await expect(assertAgreementBackfillActor({ query }, "operator", report())).rejects.toThrow("current owner/admin membership")
  })

  it("requires an exact current privileged membership in every affected org", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ organizationId: "org-a", role: "owner" }, { organizationId: "org-b", role: "admin" }] })
    await expect(assertAgreementBackfillActor({ query }, "operator", report())).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"userId" = $1'), ["operator", ["org-a", "org-b"]])
  })

  it("includes Brief-only invalid-binding revocations in the actor boundary", async () => {
    const mapping = buildAgreementAccessPreflightReport({
      schema: { hasGrantTable: true, hasBriefAudienceMemberId: true }, existingGrants: [], contracts: [],
      briefs: [{ briefId: "brief", organizationId: "org-b", audienceUserId: "recipient", audienceMemberId: "new-member", currentBindingMemberId: "old-member" }],
    })
    await expect(assertAgreementBackfillActor({ query: vi.fn().mockResolvedValue({ rows: [] }) }, "operator", mapping)).rejects.toThrow("current owner/admin membership")
  })
})
