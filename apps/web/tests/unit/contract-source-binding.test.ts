import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

import {
  clearExtractedSourceBinding,
  didBoundExtractedSourceChange,
  extractedSourceBinding,
  hasCurrentAgentActionSource,
  hasExactExtractedSourceBinding,
  invalidateAgentActionsForSourceChange,
} from "@/lib/contracts/source-binding"

describe("contract extracted source binding", () => {
  it("binds persisted text to the exact file id, version, and complete-text digest", () => {
    const text = "Service credits apply after two consecutive outages.\fNotice must be written."

    expect(extractedSourceBinding({ id: "file-1", version: 7 }, text)).toEqual({
      extractedSourceFileId: "file-1",
      extractedSourceFileVersion: 7,
      extractedSourceHash: createHash("sha256").update(text).digest("hex"),
    })
  })

  it("clears every binding field together when text no longer has file provenance", () => {
    expect(clearExtractedSourceBinding()).toEqual({
      extractedSourceFileId: null,
      extractedSourceFileVersion: null,
      extractedSourceHash: null,
    })
  })

  it("rejects partial, stale, and text-mismatched bindings", () => {
    const text = "Current terms"
    const valid = { ...extractedSourceBinding({ id: "file-1", version: 2 }, text), extractedText: text }

    expect(hasExactExtractedSourceBinding(valid, { id: "file-1", version: 2 })).toBe(true)
    expect(hasExactExtractedSourceBinding({ ...valid, extractedSourceFileId: null }, { id: "file-1", version: 2 })).toBe(false)
    expect(hasExactExtractedSourceBinding(valid, { id: "file-2", version: 2 })).toBe(false)
    expect(hasExactExtractedSourceBinding(valid, { id: "file-1", version: 3 })).toBe(false)
    expect(hasExactExtractedSourceBinding({ ...valid, extractedText: "Changed terms" }, { id: "file-1", version: 2 })).toBe(false)
  })

  it("marks only live agent-authored actions stale when canonical source changes", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 })

    await expect(invalidateAgentActionsForSourceChange({ contractAction: { updateMany } } as never, "org-1", "contract-1"))
      .resolves.toEqual({ count: 2 })
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        contractId: "contract-1",
        proposedByPrincipalType: { not: null },
        status: { notIn: ["COMPLETED", "DISMISSED", "STALE"] },
      },
      data: { status: "STALE", staleAt: expect.any(Date), version: { increment: 1 } },
    })
  })

  it("requires agent-authored actions, but not legacy human actions, to match the current bound file", () => {
    const text = "Current terms"
    const contract = { extractedText: text, ...extractedSourceBinding({ id: "file-1", version: 2 }, text) }
    const agentAction = { proposedByPrincipalType: "api_key", sourceFileId: "file-1", sourceFileVersion: 2, sourceHash: contract.extractedSourceHash }

    expect(hasCurrentAgentActionSource(agentAction, contract, { id: "file-1", version: 2 })).toBe(true)
    expect(hasCurrentAgentActionSource({ ...agentAction, sourceFileVersion: 1 }, contract, { id: "file-1", version: 2 })).toBe(false)
    expect(hasCurrentAgentActionSource(agentAction, { ...contract, extractedSourceHash: null }, { id: "file-1", version: 2 })).toBe(false)
    expect(hasCurrentAgentActionSource({ ...agentAction, proposedByPrincipalType: null }, contract, null)).toBe(true)
  })

  it("invalidates worker results only when an already-bound canonical source actually changes", () => {
    const first = extractedSourceBinding({ id: "file-1", version: 2 }, "Same text")

    expect(didBoundExtractedSourceChange(first, extractedSourceBinding({ id: "file-1", version: 2 }, "Same text"))).toBe(false)
    expect(didBoundExtractedSourceChange(first, extractedSourceBinding({ id: "file-1", version: 2 }, "Changed text"))).toBe(true)
    expect(didBoundExtractedSourceChange({ extractedSourceFileId: null, extractedSourceFileVersion: null, extractedSourceHash: null }, first)).toBe(false)
  })
})
