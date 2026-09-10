import { beforeEach, describe, expect, it, vi } from "vitest"
import fc from "fast-check"

vi.mock("@/lib/auth/agreement-access", () => ({
  hasAgreementAccess: vi.fn(),
  isAgreementAccessEmergencyDenyAll: vi.fn(() => false),
  lockCurrentAgreementPermission: vi.fn(),
}))

import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import {
  authorizedDocumentExportSource,
  authorizedDocumentExportBinding,
  bindDocumentExport,
  DocumentExportAuthorizationError,
  MAX_DOCUMENT_EXPORT_CONTENT_BYTES,
  documentContentHash,
  documentExportAttemptStorageKey,
  documentExportDownloadPath,
  isOwnedDocumentExportStorageKey,
} from "@/lib/jobs/document-export-access"
import { assertDocumentExportOutputSize, DOCUMENT_EXPORT_CONTENT_LIMIT_BYTES, documentExportExpiresAt, getDocumentExportRetentionSeconds, registerRequiredDocumentExportCleanup } from "@/lib/jobs/document-export-lifecycle"
import { processDocumentExportJob } from "../../../../worker/jobs/document-export"

const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Terms" }] }] }
const hash = documentContentHash(content)
const data = {
  contractId: "contract-1",
  organizationId: "org-1",
  requestedByMemberId: "member-1",
  requestedById: "user-1",
  documentId: "document-1",
  documentVersion: 4,
  documentContentHash: hash,
  format: "docx" as const,
  jobId: "job-1",
  expiresAt: new Date("2030-01-02T00:00:00.000Z"),
}

function createDb() {
  const db: any = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
    contract: { findFirst: vi.fn().mockResolvedValue({ id: "contract-1" }) },
    contractAccessGrant: { findFirst: vi.fn().mockResolvedValue({ id: "grant-1" }) },
    contractDocument: {
      findUnique: vi.fn().mockResolvedValue({ id: "document-1", version: 4, content }),
    },
    member: { findFirst: vi.fn().mockResolvedValue({ id: "member-1" }) },
    activity: { create: vi.fn().mockResolvedValue({ id: "activity-1" }) },
  }
  return db
}

function createDependencies(db = createDb()) {
  return {
    db,
    storage: {
      upload: vi.fn().mockResolvedValue("ok"),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    toDocx: vi.fn().mockResolvedValue(Buffer.from("docx")),
    toPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
  }
}

describe("document export authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(lockCurrentAgreementPermission).mockResolvedValue({ contractOwnerId: "owner-1", role: "member" })
    vi.mocked(hasAgreementAccess).mockResolvedValue(true)
  })

  it("binds the exact document id, version, and content hash under the permission lock", async () => {
    const db = createDb()
    await expect(bindDocumentExport(db, {
      organizationId: "org-1", memberId: "member-1", userId: "user-1",
    }, "contract-1")).resolves.toEqual({
      documentId: "document-1",
      documentVersion: 4,
      documentContentHash: hash,
    })
    expect(lockCurrentAgreementPermission).toHaveBeenCalledOnce()
  })

  it("hashes JSON content independently of PostgreSQL JSONB object-key order", () => {
    const reverseObjectKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseObjectKeys)
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]))
      }
      return value
    }
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      expect(documentContentHash(value as never)).toBe(documentContentHash(reverseObjectKeys(value) as never))
    }))
  })

  it("distinguishes a transaction-time authorization loss from a missing document", async () => {
    vi.mocked(lockCurrentAgreementPermission).mockResolvedValueOnce(null)
    const db = createDb()
    await expect(bindDocumentExport(db, {
      organizationId: "org-1", memberId: "member-1", userId: "user-1",
    }, "contract-1")).rejects.toBeInstanceOf(DocumentExportAuthorizationError)
    expect(db.contractDocument.findUnique).not.toHaveBeenCalled()
  })

  it("rejects source content above the existing editor payload boundary", async () => {
    const db = createDb()
    db.contractDocument.findUnique.mockResolvedValueOnce({
      id: "document-1",
      version: 4,
      content: { type: "doc", text: "x".repeat(MAX_DOCUMENT_EXPORT_CONTENT_BYTES) },
    })
    await expect(bindDocumentExport(db, {
      organizationId: "org-1", memberId: "member-1", userId: "user-1",
    }, "contract-1")).resolves.toBeNull()
  })

  it("fails closed for legacy unbound jobs without querying document content", async () => {
    const db = createDb()
    await expect(authorizedDocumentExportSource(db, {
      contractId: "contract-1", format: "docx", requestedById: "user-1", jobId: "job-1",
    } as never, false)).resolves.toBeNull()
    expect(db.contractDocument.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ["document id", { documentId: "other" }],
    ["version", { documentVersion: 5 }],
    ["hash", { documentContentHash: "0".repeat(64) }],
    ["member", { requestedByMemberId: "other" }],
  ])("rejects a mismatched %s binding", async (_label, override) => {
    const db = createDb()
    if ("requestedByMemberId" in override) db.member.findFirst.mockResolvedValue(null)
    await expect(authorizedDocumentExportSource(db, { ...data, ...override }, false)).resolves.toBeNull()
  })

  it("derives only the exact private object key and same-origin download path", () => {
    const key = documentExportAttemptStorageKey(data, "attempt-1")
    expect(key).toBe("exports/org-1/contract-1/job-1/attempt-1.docx")
    expect(isOwnedDocumentExportStorageKey(key, data)).toBe(true)
    expect(isOwnedDocumentExportStorageKey(`${key}/escape`, data)).toBe(false)
    expect(documentExportDownloadPath(data.contractId, data.jobId)).toBe("/api/contracts/contract-1/document/export/job-1?download=1")
  })

  it("encodes organization, contract, and job path segments", () => {
    const special = { ...data, organizationId: "org /?#", contractId: "contract /?#", jobId: "job /?#" }
    expect(documentExportAttemptStorageKey(special, "attempt /?#")).toBe(
      "exports/org%20%2F%3F%23/contract%20%2F%3F%23/job%20%2F%3F%23/attempt%20%2F%3F%23.docx",
    )
    expect(documentExportDownloadPath(special.contractId, special.jobId)).toBe(
      "/api/contracts/contract%20%2F%3F%23/document/export/job%20%2F%3F%23?download=1",
    )
  })

  it("rejects unsafe numeric document versions before database access", async () => {
    const db = createDb()
    await expect(authorizedDocumentExportSource(db, {
      ...data,
      documentVersion: Number.MAX_SAFE_INTEGER + 1,
    }, false)).resolves.toBeNull()
    expect(db.member.findFirst).not.toHaveBeenCalled()
  })

  it("checks only document identity and version while an export is pending", async () => {
    const db = createDb()
    await expect(authorizedDocumentExportBinding(db, data)).resolves.toBe(true)
    expect(db.contractDocument.findUnique).toHaveBeenCalledWith({
      where: { contractId: "contract-1" },
      select: { id: true, version: true },
    })
  })
})

describe("document export lifecycle bounds", () => {
  it("rejects legacy or over-bound queue payloads before database or egress", async () => {
    const dependencies = createDependencies()
    await expect(processDocumentExportJob({ id: "job-1", data: { jobId: "job-1", contractId: "contract-1" } as never }, dependencies as any)).rejects.toThrow("unbound")
    expect(dependencies.db.$transaction).not.toHaveBeenCalled()
    expect(dependencies.storage.upload).not.toHaveBeenCalled()
  })

  it("uses the approved 24-hour default and rejects malformed retention", () => {
    expect(getDocumentExportRetentionSeconds(undefined)).toBe(86_400)
    expect(documentExportExpiresAt(new Date("2030-01-01T00:00:00.000Z"), 86_400).toISOString()).toBe("2030-01-02T00:00:00.000Z")
    expect(() => getDocumentExportRetentionSeconds("0")).toThrow("positive")
    expect(() => getDocumentExportRetentionSeconds(" 86400")).toThrow("positive")
    expect(() => getDocumentExportRetentionSeconds("1.5")).toThrow("positive")
  })

  it("accepts the exact output cap and rejects one byte above it", () => {
    expect(() => assertDocumentExportOutputSize(Buffer.alloc(DOCUMENT_EXPORT_CONTENT_LIMIT_BYTES))).not.toThrow()
    expect(() => assertDocumentExportOutputSize(Buffer.alloc(DOCUMENT_EXPORT_CONTENT_LIMIT_BYTES + 1))).toThrow("size limit")
  })

  it("requires retention schedule registration to succeed before startup is considered safe", async () => {
    const failure = new Error("synthetic Redis outage")
    const add = vi.fn().mockRejectedValue(failure)
    await expect(registerRequiredDocumentExportCleanup({ add }, new Date("2030-01-01T00:00:00.000Z"))).rejects.toBe(failure)
    expect(add).toHaveBeenCalledWith(
      "retention-sweep",
      { triggeredAt: "2030-01-01T00:00:00.000Z" },
      { repeat: { pattern: "*/5 * * * *" }, jobId: "document-export-retention" },
    )
  })
})
