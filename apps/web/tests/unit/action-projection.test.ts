import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { projectObligationAction, projectRenewalActions } from "@/lib/actions/project"

describe("Phase 1 obligation action projection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a human-reviewed proposal for an accepted cited obligation", async () => {
    vi.mocked(prisma.contractAction.upsert).mockResolvedValueOnce({ id: "action-1" } as never)

    await projectObligationAction({
      id: "obligation-1",
      contractId: "contract-1",
      organizationId: "org-1",
      title: "Send usage report",
      description: "Send the monthly report",
      clauseReference: "Section 4",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      createdById: "user-1",
      sourceHash: "sha256:abc",
      sourceText: "Provider shall send a monthly usage report.",
      sourcePage: 3,
      confidence: 0.92,
    })

    expect(prisma.contractAction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_sourceKey: { organizationId: "org-1", sourceKey: "obligation:obligation-1" } },
      create: expect.objectContaining({
        kind: "OBLIGATION",
        status: "PROPOSED",
        reviewStatus: "reviewed",
        evidenceRequired: "completion_note",
        sourceText: "Provider shall send a monthly usage report.",
        sourcePage: 3,
      }),
    }))
  })

  it("makes manually created obligations reviewed proposals without inventing source data", async () => {
    vi.mocked(prisma.contractAction.upsert).mockResolvedValueOnce({ id: "action-2" } as never)

    await projectObligationAction({
      id: "obligation-2",
      contractId: "contract-1",
      organizationId: "org-1",
      title: "Confirm invoice recipient",
      dueDate: new Date("2026-09-02T00:00:00.000Z"),
      createdById: "user-1",
    })

    expect(prisma.contractAction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: "PROPOSED", reviewStatus: "reviewed", evidenceRequired: "completion_note" }),
    }))
    const call = vi.mocked(prisma.contractAction.upsert).mock.calls.at(-1)?.[0] as any
    expect(call.create.sourceText).toBeUndefined()
    expect(call.create.sourcePage).toBeUndefined()
  })

  it("marks an acknowledged action stale when its cited source changes", async () => {
    vi.mocked(prisma.contractAction.findUnique).mockResolvedValueOnce({
      sourceHash: "sha256:old",
      status: "ACKNOWLEDGED",
    } as never)
    vi.mocked(prisma.contractAction.upsert).mockResolvedValueOnce({ id: "action-3" } as never)

    await projectObligationAction({
      id: "obligation-3",
      contractId: "contract-1",
      organizationId: "org-1",
      title: "Review changed report",
      dueDate: new Date("2026-09-03T00:00:00.000Z"),
      sourceHash: "sha256:new",
    })

    const call = vi.mocked(prisma.contractAction.upsert).mock.calls.at(-1)?.[0] as any
    expect(call.update.status).toBe("STALE")
    expect(call.update.staleAt).toBeInstanceOf(Date)
  })
})

describe("Phase 1 reviewed renewal projection", () => {
  beforeEach(() => vi.clearAllMocks())

  const reviewedRenewal = {
    id: "contract-renewal-1",
    organizationId: "org-1",
    title: "Northwind MSA",
    ownerId: "user-1",
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    noticePeriodDays: 30,
    extractions: [
      { field: "endDate", sourceText: "Term ends December 31.", sourcePage: 4, confidence: 0.91, rawValue: "2026-12-31" },
      { field: "noticePeriodDays", sourceText: "Give notice 30 days before expiry.", sourcePage: 4, confidence: 0.89, rawValue: "30" },
      { field: "autoRenewal", sourceText: null, sourcePage: null, confidence: 1, rawValue: "true" },
    ],
  }

  it("does not invent an action when every renewal fact has not been accepted", async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([{
      ...reviewedRenewal,
      extractions: reviewedRenewal.extractions.filter((item) => item.field !== "noticePeriodDays"),
    }] as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([])

    const result = await projectRenewalActions("org-1")

    expect(result).toEqual([])
    expect(prisma.contractAction.upsert).not.toHaveBeenCalled()
  })

  it("does not rewrite an unchanged reviewed renewal action", async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([reviewedRenewal] as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([{
      id: "action-renewal-1",
      sourceKey: "renewal-notice:contract-renewal-1",
      sourceHash: "da204c72a0a36f2fd07caba0d8b03455a66d338840300fe47674c9e0c4b0c1b3",
      status: "PROPOSED",
    }] as never)

    const result = await projectRenewalActions("org-1")

    expect(result).toEqual([])
    expect(prisma.contractAction.upsert).not.toHaveBeenCalled()
  })

  it("marks a changed reviewed renewal stale and increments its version", async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([reviewedRenewal] as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([{
      id: "action-renewal-1",
      sourceKey: "renewal-notice:contract-renewal-1",
      sourceHash: "old-hash",
      status: "ACKNOWLEDGED",
    }] as never)
    vi.mocked(prisma.contractAction.upsert).mockResolvedValueOnce({ id: "action-renewal-1" } as never)

    await projectRenewalActions("org-1")

    expect(prisma.contractAction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: "STALE", version: { increment: 1 } }),
    }))
  })
})
