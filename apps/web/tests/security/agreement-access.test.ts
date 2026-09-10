import { describe, expect, it, vi } from "vitest"
import {
  agreementAccessSql,
  agreementAccessWhere,
  authorizedAgreementRecipientIds,
  hasAgreementAccess,
  isAgreementAccessEmergencyDenyAll,
} from "@/lib/auth/agreement-access"

const ctx = {
  organizationId: "org-a",
  memberId: "member-a",
}

describe("agreement access boundary", () => {
  it("treats any non-empty value except exact false as emergency deny-all", () => {
    const original = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    try {
      delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      expect(isAgreementAccessEmergencyDenyAll()).toBe(false)
      process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "false"
      expect(isAgreementAccessEmergencyDenyAll()).toBe(false)
      process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
      expect(isAgreementAccessEmergencyDenyAll()).toBe(true)
      process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "typo"
      expect(isAgreementAccessEmergencyDenyAll()).toBe(true)
    } finally {
      if (original === undefined) delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      else process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = original
    }
  })

  it("fails every helper closed while the emergency deny-all is active", async () => {
    const original = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
    const findFirst = vi.fn().mockResolvedValue({ id: "grant-a" })
    const findMany = vi.fn().mockResolvedValue([{ member: { userId: "user-a" } }])
    try {
      expect(agreementAccessWhere(ctx)).toEqual({
        AND: [
          { organizationId: "org-a" },
          { AND: [{ id: "__denied__" }, { id: { not: "__denied__" } }] },
        ],
      })
      expect(agreementAccessSql("contract", ctx).sql).toBe("FALSE")
      await expect(hasAgreementAccess({ contractAccessGrant: { findFirst } }, ctx, "contract-a")).resolves.toBe(false)
      await expect(authorizedAgreementRecipientIds(
        { contractAccessGrant: { findMany } }, "org-a", "contract-a", ["user-a"],
      )).resolves.toEqual([])
      expect(findFirst).not.toHaveBeenCalled()
      expect(findMany).not.toHaveBeenCalled()
    } finally {
      if (original === undefined) delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      else process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = original
    }
  })

  it("ANDs caller filters with tenant and current-member grants", () => {
    expect(agreementAccessWhere(ctx, { status: "ACTIVE" })).toEqual({
      AND: [
        { organizationId: "org-a" },
        { accessGrants: { some: { organizationId: "org-a", memberId: "member-a" } } },
        { status: "ACTIVE" },
      ],
    })
  })

  it("returns false when the exact organization/member/contract grant is absent", async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    await expect(hasAgreementAccess({ contractAccessGrant: { findFirst } }, ctx, "contract-a")).resolves.toBe(false)
    expect(findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-a", memberId: "member-a", contractId: "contract-a" },
      select: { id: true },
    })
  })

  it("intersects candidate users with current membership grants", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { member: { userId: "user-b" } },
      { member: { userId: "user-a" } },
    ])
    await expect(authorizedAgreementRecipientIds(
      { contractAccessGrant: { findMany } },
      "org-a",
      "contract-a",
      ["user-z", "user-b", "user-a", "user-b"],
    )).resolves.toEqual(["user-b", "user-a"])
  })

  it("builds only closed-map parameterized SQL aliases", () => {
    const fragment = agreementAccessSql("contract", ctx)
    expect(fragment).toMatchObject({ values: ["org-a", "member-a"] })
    expect(fragment.values).toEqual(["org-a", "member-a"])
    expect(fragment.sql).toContain('access_grant."contractId" = "Contract"."id"')
    expect(() => agreementAccessSql("request-input" as never, ctx)).toThrow("Unsupported contract alias")
  })
})
