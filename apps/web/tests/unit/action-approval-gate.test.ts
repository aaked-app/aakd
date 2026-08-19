import { describe, expect, it } from "vitest"
import { actionApprovalState } from "@/lib/actions/approval-gate"

describe("actionApprovalState", () => {
  it("allows only approved required approvals for the current action version", () => {
    expect(actionApprovalState([{ required: true, status: "approved", actionVersion: 4 }], 4)).toBe("allowed")
    expect(actionApprovalState([{ required: true, status: "approved", actionVersion: 3 }], 4)).toBe("pending")
    expect(actionApprovalState([{ required: true, status: "pending", actionVersion: 4 }], 4)).toBe("pending")
    expect(actionApprovalState([{ required: true, status: "rejected", actionVersion: 4 }], 4)).toBe("rejected")
  })

  it("does not let optional approvals block an action", () => {
    expect(actionApprovalState([{ required: false, status: "rejected", actionVersion: 1 }], 9)).toBe("allowed")
  })
})
