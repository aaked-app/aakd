import { describe, expect, it } from "vitest"
import fc from "fast-check"

import {
  ActionApprovalRequestPreviewInputSchema,
  ActionProposalPreviewInputSchema,
  actionApprovalRequestDigest,
  actionProposalDigest,
} from "@/lib/actions/agent-proposal-schema"

const proposal = {
  contractId: "contract-1",
  kind: "OBLIGATION" as const,
  title: "  Send service report  ",
  description: "  Quarterly report. ",
  condition: null,
  dueDate: "2026-10-01T00:00:00.000Z",
  evidenceRequired: " delivery_receipt ",
  source: {
    fileId: "file-1",
    fileVersion: 2,
    page: 3,
    excerpt: "The supplier shall send a quarterly report.",
    excerptHash: "b".repeat(64),
  },
  idempotencyKey: "9de8f38f-e135-47ff-95c6-d27293658a74",
}

describe("agent action proposal schemas", () => {
  it("normalizes intent deterministically without preview lifecycle data", () => {
    const parsed = ActionProposalPreviewInputSchema.parse(proposal)
    const digest = actionProposalDigest(parsed)

    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(actionProposalDigest({ ...parsed, title: "Send service report" })).toBe(digest)
    expect(actionProposalDigest({ ...parsed, title: "Send a different report" })).not.toBe(digest)
  })

  it("uses a closed schema and rejects invalid source identity", () => {
    expect(ActionProposalPreviewInputSchema.safeParse({ ...proposal, unexpected: true }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({ ...proposal, source: { ...proposal.source, fileVersion: 0 } }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({ ...proposal, source: { ...proposal.source, excerptHash: "bad" } }).success).toBe(false)
  })

  it("rejects action kinds with missing or contradictory notice semantics", () => {
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      kind: "RENEWAL_NOTICE",
      noticeDate: null,
    }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      kind: "RENEWAL_NOTICE",
      dueDate: "2026-10-01T00:00:00.000Z",
      noticeDate: "2026-11-01T00:00:00.000Z",
    }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      kind: "OBLIGATION",
      noticeDate: "2026-09-01T00:00:00.000Z",
    }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      kind: "RENEWAL_NOTICE",
      dueDate: "2026-10-01T00:00:00.000Z",
      noticeDate: "2026-09-01T00:00:00.000Z",
    }).success).toBe(true)
  })

  it("accepts renewal notice dates exactly when they do not follow the due date", () => {
    const schemaDate = fc.date().filter(date => date.toISOString().length === "1970-01-01T00:00:00.000Z".length)
    fc.assert(fc.property(schemaDate, schemaDate, (noticeDate, dueDate) => {
      const parsed = ActionProposalPreviewInputSchema.safeParse({
        ...proposal,
        kind: "RENEWAL_NOTICE",
        dueDate: dueDate.toISOString(),
        noticeDate: noticeDate.toISOString(),
      })
      expect(parsed.success).toBe(noticeDate.getTime() <= dueDate.getTime())
    }))
  })

  it("accepts a clause-sized citation boundary and rejects oversized citations and opaque IDs", () => {
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      source: { ...proposal.source, excerpt: "x".repeat(8192) },
    }).success).toBe(true)
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      source: { ...proposal.source, excerpt: "x".repeat(8193) },
    }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({ ...proposal, contractId: "x".repeat(201) }).success).toBe(false)
    expect(ActionProposalPreviewInputSchema.safeParse({
      ...proposal,
      source: { ...proposal.source, fileId: "x".repeat(201) },
    }).success).toBe(false)
  })

  it("binds approval-request replay to action, version, reviewer, and comment", () => {
    const parsed = ActionApprovalRequestPreviewInputSchema.parse({
      actionId: "action-1",
      assignedToId: "reviewer-1",
      expectedVersion: 4,
      comment: " Please review. ",
      idempotencyKey: "016290f2-94ea-42cb-944f-1ea0d015c921",
    })

    expect(actionApprovalRequestDigest(parsed)).toMatch(/^[0-9a-f]{64}$/)
    expect(actionApprovalRequestDigest({ ...parsed, comment: "Please review." })).toBe(actionApprovalRequestDigest(parsed))
    expect(actionApprovalRequestDigest({ ...parsed, expectedVersion: 5 })).not.toBe(actionApprovalRequestDigest(parsed))
  })
})
