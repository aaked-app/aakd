import { beforeEach, describe, expect, it, vi } from "vitest"

const memberFindFirst = vi.fn()
const getObject = vi.fn()
const deleteObject = vi.fn()
const parsePdf = vi.fn()
const runExtractionPreviewAi = vi.fn()
const captureServerEvent = vi.fn()
const extractRawText = vi.fn()
const sanitizeZipBuffer = vi.fn((buffer: Buffer) => buffer)

vi.mock("@/lib/db/worker-client", () => ({
  getWorkerPrisma: () => ({ member: { findFirst: memberFindFirst } }),
}))
vi.mock("@/lib/storage", () => ({
  storage: { getObject, delete: deleteObject },
}))
vi.mock("@/lib/pdf", () => ({ parsePdf }))
vi.mock("@/lib/ai/extraction-preview", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ai/extraction-preview")>(),
  runExtractionPreviewAi,
}))
vi.mock("@/lib/posthog-server", () => ({ captureServerEvent }))
vi.mock("@/lib/import/zip-safety", () => ({ sanitizeZipBuffer }))
vi.mock("mammoth", () => ({ default: { extractRawText } }))

const jobId = "00000000-0000-4000-8000-000000000001"
const data = {
  jobId,
  organizationId: "org-1",
  requestedByUserId: "user-1",
  requestedByMemberId: "member-1",
  storageKey: `previews/org-1/member-1/${jobId}/source`,
  fileType: "pdf" as const,
  createdAt: Date.now(),
  expiresAt: Date.now() + 300_000,
}

describe("extraction preview worker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memberFindFirst.mockResolvedValue({ id: "member-1" })
    getObject.mockResolvedValue({ body: Buffer.from("%PDF-1.4") })
    deleteObject.mockResolvedValue(undefined)
    parsePdf.mockResolvedValue({ text: "Ordinary contract text" })
    runExtractionPreviewAi.mockResolvedValue({ contractType: "MSA", confidence: {} })
    extractRawText.mockResolvedValue({ value: "DOCX contract text" })
  })

  it("requires the exact current member before reading and before calling AI", async () => {
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview(data)).resolves.toMatchObject({ contractType: "MSA" })
    expect(memberFindFirst).toHaveBeenCalledTimes(2)
    expect(memberFindFirst).toHaveBeenCalledWith({
      where: { id: "member-1", userId: "user-1", organizationId: "org-1" },
      select: { id: true },
    })
  })

  it("deletes the source and makes no provider call when membership was revoked", async () => {
    memberFindFirst.mockResolvedValueOnce(null)
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview(data)).rejects.toThrow("no longer authorized")
    expect(getObject).not.toHaveBeenCalled()
    expect(runExtractionPreviewAi).not.toHaveBeenCalled()
    expect(deleteObject).toHaveBeenCalledWith(data.storageKey)
  })

  it("re-checks membership after parsing so mid-job revocation prevents AI disclosure", async () => {
    memberFindFirst.mockResolvedValueOnce({ id: "member-1" }).mockResolvedValueOnce(null)
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview(data)).rejects.toThrow("no longer authorized")
    expect(parsePdf).toHaveBeenCalled()
    expect(runExtractionPreviewAi).not.toHaveBeenCalled()
    expect(deleteObject).toHaveBeenCalledWith(data.storageKey)
  })

  it("preserves deterministic explicit renewal terms over provider output", async () => {
    parsePdf.mockResolvedValueOnce({
      text: "This agreement automatically renews unless either party gives 45 days written notice.",
    })
    runExtractionPreviewAi.mockResolvedValueOnce({
      autoRenewal: false,
      noticePeriodDays: 0,
      confidence: {},
    })
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview(data)).resolves.toMatchObject({
      autoRenewal: true,
      noticePeriodDays: 45,
    })
    expect(deleteObject).toHaveBeenCalledWith(data.storageKey)
  })

  it("sanitizes DOCX containers before extraction", async () => {
    getObject.mockResolvedValueOnce({ body: Buffer.from("PK\u0003\u0004word/document.xml") })
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview({ ...data, fileType: "docx" })).resolves.toMatchObject({
      contractType: "MSA",
    })
    expect(sanitizeZipBuffer).toHaveBeenCalled()
    expect(extractRawText).toHaveBeenCalled()
  })

  it("does not turn conditional renewal wording into an affirmative result", async () => {
    parsePdf.mockResolvedValueOnce({
      text: "This agreement may automatically renew with written consent.",
    })
    runExtractionPreviewAi.mockResolvedValueOnce({ autoRenewal: true, confidence: {} })
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    const result = await processExtractionPreview(data)
    expect(result.autoRenewal).toBeUndefined()
  })

  it("returns a minimized partial result on parse or provider failure and always cleans up", async () => {
    parsePdf.mockRejectedValueOnce(new Error("document contents"))
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview(data)).resolves.toEqual({
      error: "text_extraction_failed",
      partial: true,
      confidence: {},
    })
    expect(deleteObject).toHaveBeenCalledWith(data.storageKey)

    vi.clearAllMocks()
    memberFindFirst.mockResolvedValue({ id: "member-1" })
    getObject.mockResolvedValue({ body: Buffer.from("%PDF-1.4") })
    parsePdf.mockResolvedValue({ text: "Ordinary contract text" })
    deleteObject.mockResolvedValue(undefined)
    runExtractionPreviewAi.mockRejectedValueOnce(new Error("private provider body"))
    await expect(processExtractionPreview(data)).resolves.toEqual({
      error: "ai_unavailable",
      partial: true,
      confidence: {},
    })
    expect(deleteObject).toHaveBeenCalledWith(data.storageKey)
  })

  it("does not read an expired source and still deletes it", async () => {
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview({ ...data, expiresAt: Date.now() - 1 }))
      .rejects.toThrow("expired")
    expect(getObject).not.toHaveBeenCalled()
    expect(deleteObject).toHaveBeenCalledWith(data.storageKey)
  })

  it("rejects an arbitrary storage key without deleting it", async () => {
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview({ ...data, storageKey: "orgs/other/private" }))
      .rejects.toThrow("Invalid extraction preview storage key")
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it("retries source deletion locally before returning success", async () => {
    deleteObject
      .mockRejectedValueOnce(new Error("temporary storage outage"))
      .mockRejectedValueOnce(new Error("temporary storage outage"))
      .mockResolvedValueOnce(undefined)
    const { processExtractionPreview } = await import("@/lib/jobs/extraction-preview-processor")
    await expect(processExtractionPreview(data)).resolves.toMatchObject({ contractType: "MSA" })
    expect(deleteObject).toHaveBeenCalledTimes(3)
  })
})
