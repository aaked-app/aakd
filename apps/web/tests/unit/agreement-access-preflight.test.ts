import { describe, expect, it } from "vitest"
import { buildAgreementAccessPreflightReport } from "@/lib/auth/agreement-access-preflight"

const schema = { hasGrantTable: true, hasBriefAudienceMemberId: true }

describe("agreement-access production preflight", () => {
  it("produces deterministic owner grants without inferring legacy Brief access", () => {
    const input = {
      schema,
      contracts: [
        { contractId: "contract-b", organizationId: "org-a", ownerUserId: "user-b", memberId: "member-b" },
        { contractId: "contract-a", organizationId: "org-a", ownerUserId: "user-a", memberId: "member-a" },
      ],
      briefs: [
        { briefId: "brief-current", organizationId: "org-a", audienceUserId: "user-a", audienceMemberId: "member-a", currentBindingMemberId: null },
        { briefId: "brief-left", organizationId: "org-a", audienceUserId: "user-left", audienceMemberId: null, currentBindingMemberId: null },
      ],
      existingGrants: [{ contractId: "contract-b", memberId: "member-b" }],
    }
    const first = buildAgreementAccessPreflightReport(input)
    const second = buildAgreementAccessPreflightReport({ ...input, contracts: [...input.contracts].reverse() })

    expect(first.readyForReviewedBackfill).toBe(true)
    expect(first.counts).toEqual({
      contracts: 2,
      ownerMissing: 0,
      ownerDuplicate: 0,
      ownerGrantsToInsert: 1,
      briefs: 2,
      briefAudienceMissing: 1,
      briefAudienceDuplicate: 0,
      briefAudienceUnbound: 1,
      briefAudienceBindingInvalid: 0,
      briefBindingsToChange: 0,
    })
    expect(first.contracts.map((row) => [row.contractId, row.ownerMemberIds, row.ownerGrantExists])).toEqual([
      ["contract-a", ["member-a"], false],
      ["contract-b", ["member-b"], true],
    ])
    expect(first.briefs[1]).toMatchObject({
      briefId: "brief-left",
      plannedAudienceMemberId: null,
      status: "audience_missing",
      bindingChangeRequired: false,
    })
    expect(second.mappingSha256).toBe(first.mappingSha256)
  })

  it("fails closed for missing and cross-organization owner memberships", () => {
    const report = buildAgreementAccessPreflightReport({
      schema,
      contracts: [
        { contractId: "contract-orphan", organizationId: "org-a", ownerUserId: "user-b", memberId: null },
      ],
      briefs: [],
      existingGrants: [],
    })
    expect(report.readyForReviewedBackfill).toBe(false)
    expect(report.counts.ownerMissing).toBe(1)
    expect(report.counts.ownerGrantsToInsert).toBe(0)
  })

  it("fails closed rather than inferring a member when duplicate matches exist", () => {
    const report = buildAgreementAccessPreflightReport({
      schema,
      contracts: [
        { contractId: "contract-a", organizationId: "org-a", ownerUserId: "user-a", memberId: "member-new" },
        { contractId: "contract-a", organizationId: "org-a", ownerUserId: "user-a", memberId: "member-old" },
      ],
      briefs: [
        { briefId: "brief-a", organizationId: "org-a", audienceUserId: "user-a", audienceMemberId: "member-new", currentBindingMemberId: "member-old" },
        { briefId: "brief-a", organizationId: "org-a", audienceUserId: "user-a", audienceMemberId: "member-old", currentBindingMemberId: "member-old" },
      ],
      existingGrants: [],
    })
    expect(report.readyForReviewedBackfill).toBe(false)
    expect(report.contracts[0]).toMatchObject({
      ownerMemberIds: ["member-new", "member-old"],
      status: "owner_duplicate",
    })
    expect(report.briefs[0]).toMatchObject({
      currentAudienceMemberIds: ["member-new", "member-old"],
      plannedAudienceMemberId: null,
      status: "audience_duplicate",
      bindingChangeRequired: true,
    })
  })

  it("does not restore a deleted membership binding after the user rejoins", () => {
    const report = buildAgreementAccessPreflightReport({
      schema,
      contracts: [],
      briefs: [
        { briefId: "brief-a", organizationId: "org-a", audienceUserId: "user-a", audienceMemberId: "member-rejoined", currentBindingMemberId: null },
      ],
      existingGrants: [],
    })
    expect(report.briefs[0]).toMatchObject({
      currentBindingMemberId: null,
      plannedAudienceMemberId: null,
      bindingChangeRequired: false,
      status: "audience_unbound",
    })
  })

  it.each([
    { current: "member-a", member: "member-a", planned: "member-a", status: "ready", changed: false },
    { current: "member-old", member: "member-rejoined", planned: null, status: "audience_binding_invalid", changed: true },
    { current: "member-other-org", member: null, planned: null, status: "audience_missing", changed: true },
  ])("preserves only exact current identity: $status", ({ current, member, planned, status, changed }) => {
    const report = buildAgreementAccessPreflightReport({ schema, contracts: [], existingGrants: [], briefs: [
      { briefId: "brief-a", organizationId: "org-a", audienceUserId: "user-a", audienceMemberId: member, currentBindingMemberId: current },
    ] })
    expect(report.briefs[0]).toMatchObject({ plannedAudienceMemberId: planned, status, bindingChangeRequired: changed })
    expect(report.counts.briefBindingsToChange).toBe(Number(changed))
  })
})
