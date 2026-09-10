import { beforeEach, describe, expect, it, vi } from "vitest"
import fc from "fast-check"

const accessState = vi.hoisted(() => ({
  emergency: false,
  granted: true,
  lockedPermission: { contractOwnerId: "user-owner", role: "member" } as { contractOwnerId: string; role: string } | null,
}))

vi.mock("@/lib/auth/agreement-access", () => ({
  hasAgreementAccess: vi.fn(async () => accessState.granted),
  isAgreementAccessEmergencyDenyAll: vi.fn(() => accessState.emergency),
  lockCurrentAgreementPermission: vi.fn(async () => accessState.lockedPermission),
}))

import { hasAgreementAccess, lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { documentConversionReady } from "@/lib/jobs/document-convert-access"
import type { DocumentConvertJobData } from "@/lib/jobs/queues"

type State = {
  member: { id: string; userId: string; organizationId: string; role: string } | null
  contract: { id: string; organizationId: string; status: string } | null
  documentVersion: number | null
  file: { id: string; contractId: string; storageKey: string; isLatest: boolean } | null
  apiKey: {
    id: string
    organizationId: string
    createdById: string
    revokedAt: Date | null
    expiresAt: Date | null
    scopes: string[]
  } | null
}

const autoJob: DocumentConvertJobData = {
  contractId: "contract-a",
  organizationId: "org-a",
  requestedByMemberId: "member-a",
  sourceFileId: "file-a",
  storageKey: "contracts/org-a/contract-a/source.pdf",
  requestedById: "user-a",
  jobId: "file-a",
  fileType: "pdf",
  deleteSource: false,
}

const explicitJob: DocumentConvertJobData = {
  ...autoJob,
  sourceFileId: undefined,
  storageKey: "tmp/docx-imports/contract-a/import.docx",
  expectedDocumentVersion: 3,
  deleteSource: true,
}

const invalidApiKeys: Array<[string, State["apiKey"]]> = [
  ["missing", null],
  ["revoked", { id: "key-a", organizationId: "org-a", createdById: "user-a", revokedAt: new Date(), expiresAt: null, scopes: ["write"] }],
  ["expired", { id: "key-a", organizationId: "org-a", createdById: "user-a", revokedAt: null, expiresAt: new Date(0), scopes: ["write"] }],
  ["expires now", { id: "key-a", organizationId: "org-a", createdById: "user-a", revokedAt: null, expiresAt: new Date(), scopes: ["write"] }],
  ["read-only scope", { id: "key-a", organizationId: "org-a", createdById: "user-a", revokedAt: null, expiresAt: null, scopes: ["read", "text_read"] }],
  ["lookalike scope", { id: "key-a", organizationId: "org-a", createdById: "user-a", revokedAt: null, expiresAt: null, scopes: ["writer"] }],
]

function createDb(overrides: Partial<State> = {}) {
  const state: State = {
    member: { id: "member-a", userId: "user-a", organizationId: "org-a", role: "member" },
    contract: { id: "contract-a", organizationId: "org-a", status: "DRAFT" },
    documentVersion: null,
    file: {
      id: "file-a",
      contractId: "contract-a",
      storageKey: "contracts/org-a/contract-a/source.pdf",
      isLatest: true,
    },
    apiKey: null,
    ...overrides,
  }

  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    member: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const member = state.member
        return member
          && member.id === where.id
          && member.userId === where.userId
          && member.organizationId === where.organizationId
          ? { role: member.role }
          : null
      }),
    },
    contract: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const contract = state.contract
        return contract
          && contract.id === where.id
          && contract.organizationId === where.organizationId
          ? { status: contract.status }
          : null
      }),
    },
    contractDocument: {
      findUnique: vi.fn(async ({ where }: { where: { contractId: string } }) => (
        where.contractId === state.contract?.id && state.documentVersion !== null
          ? { version: state.documentVersion }
          : null
      )),
    },
    contractFile: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const file = state.file
        return file
          && file.id === where.id
          && file.contractId === where.contractId
          && file.storageKey === where.storageKey
          && file.isLatest === where.isLatest
          ? { id: file.id }
          : null
      }),
    },
    contractAccessGrant: {},
    apiKey: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const key = state.apiKey
        return key
          && key.id === where.id
          && key.organizationId === where.organizationId
          && key.createdById === where.createdById
          ? { revokedAt: key.revokedAt, expiresAt: key.expiresAt, scopes: key.scopes }
          : null
      }),
    },
  }
}

describe("document conversion current-access guard", () => {
  beforeEach(() => {
    accessState.emergency = false
    accessState.granted = true
    accessState.lockedPermission = { contractOwnerId: "user-owner", role: "member" }
    vi.clearAllMocks()
  })

  it("allows a current exact member with a current grant and latest immutable source", async () => {
    const db = createDb()
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(true)
    expect(db.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "member-a", userId: "user-a", organizationId: "org-a" },
    }))
    expect(hasAgreementAccess).toHaveBeenCalledWith(db, {
      organizationId: "org-a",
      memberId: "member-a",
      userId: "user-a",
    }, "contract-a")
  })

  it("property: changing any persisted identity binding always denies automatic conversion", async () => {
    const different = (expected: string) => fc.string().filter((value) => value !== expected)
    await fc.assert(fc.asyncProperty(fc.oneof(
      different(autoJob.organizationId!).map((value) => ({ organizationId: value })),
      different(autoJob.requestedByMemberId!).map((value) => ({ requestedByMemberId: value })),
      different(autoJob.requestedById).map((value) => ({ requestedById: value })),
      different(autoJob.contractId).map((value) => ({ contractId: value })),
      different(autoJob.sourceFileId!).map((value) => ({ sourceFileId: value })),
      different(autoJob.storageKey).map((value) => ({ storageKey: value })),
    ), async (mutation) => {
      await expect(documentConversionReady(createDb() as never, { ...autoJob, ...mutation })).resolves.toBe(false)
    }), { numRuns: 250 })
  })

  it("denies a removed grant at pre-read and final locked checks", async () => {
    const db = createDb()
    accessState.granted = false
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(false)
    accessState.lockedPermission = null
    await expect(documentConversionReady(db as never, autoJob, true)).resolves.toBe(false)
  })

  it("does not transfer a removed membership job to the same user after rejoin", async () => {
    const db = createDb({
      member: { id: "member-rejoined", userId: "user-a", organizationId: "org-a", role: "member" },
    })
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(false)
    expect(hasAgreementAccess).not.toHaveBeenCalled()

    accessState.lockedPermission = null
    await expect(documentConversionReady(db as never, autoJob, true)).resolves.toBe(false)
  })

  it.each(["owner", "admin", "legal", "member"])("allows current writer role %s", async (role) => {
    const db = createDb({ member: { id: "member-a", userId: "user-a", organizationId: "org-a", role } })
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(true)
    accessState.lockedPermission = { contractOwnerId: "user-owner", role }
    await expect(documentConversionReady(db as never, autoJob, true)).resolves.toBe(true)
  })

  it.each(["viewer", "guest", "", "OWNER"])("denies unsupported current role %j", async (role) => {
    const db = createDb({ member: { id: "member-a", userId: "user-a", organizationId: "org-a", role } })
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(false)
    accessState.lockedPermission = { contractOwnerId: "user-owner", role }
    await expect(documentConversionReady(db as never, autoJob, true)).resolves.toBe(false)
  })

  it("fails before any database read during emergency deny-all", async () => {
    const db = createDb()
    accessState.emergency = true
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(false)
    expect(db.member.findFirst).not.toHaveBeenCalled()
    expect(db.contract.findFirst).not.toHaveBeenCalled()
  })

  it.each([
    { organizationId: undefined },
    { organizationId: "" },
    { requestedByMemberId: undefined },
    { requestedByMemberId: "" },
  ])("fails closed for missing or empty execution identity %#", async (mutation) => {
    const db = createDb()
    await expect(documentConversionReady(db as never, { ...autoJob, ...mutation })).resolves.toBe(false)
    expect(db.member.findFirst).not.toHaveBeenCalled()
  })

  it.each(["O'Brien", "<script>alert(1)</script>", "'; DROP TABLE \"Contract\";--", "عضو\u0000🔐"])(
    "treats special-character identity %j as an exact non-match",
    async (requestedById) => {
      await expect(documentConversionReady(createDb() as never, { ...autoJob, requestedById })).resolves.toBe(false)
    },
  )

  it("fails closed on a 10 MiB forged storage key without weakening exact source binding", async () => {
    await expect(documentConversionReady(createDb() as never, {
      ...autoJob,
      storageKey: "x".repeat(10 * 1024 * 1024),
    })).resolves.toBe(false)
  })

  it("denies cross-organization membership, contract, and API-key identities", async () => {
    const membershipDb = createDb({
      member: { id: "member-a", userId: "user-a", organizationId: "org-other", role: "member" },
    })
    await expect(documentConversionReady(membershipDb as never, autoJob)).resolves.toBe(false)

    const contractDb = createDb({
      contract: { id: "contract-a", organizationId: "org-other", status: "DRAFT" },
    })
    await expect(documentConversionReady(contractDb as never, autoJob)).resolves.toBe(false)

    const apiKeyDb = createDb({
      apiKey: {
        id: "key-a", organizationId: "org-other", createdById: "user-a",
        revokedAt: null, expiresAt: null, scopes: ["write"],
      },
    })
    await expect(documentConversionReady(apiKeyDb as never, { ...autoJob, apiKeyId: "key-a" })).resolves.toBe(false)
  })

  it.each([
    ["file id", { id: "file-new", contractId: "contract-a", storageKey: autoJob.storageKey, isLatest: true }],
    ["storage key", { id: "file-a", contractId: "contract-a", storageKey: "replacement.pdf", isLatest: true }],
    ["latest flag", { id: "file-a", contractId: "contract-a", storageKey: autoJob.storageKey, isLatest: false }],
    ["contract binding", { id: "file-a", contractId: "contract-other", storageKey: autoJob.storageKey, isLatest: true }],
  ] as const)("denies automatic conversion after source %s changes", async (_label, file) => {
    const db = createDb({ file })
    await expect(documentConversionReady(db as never, autoJob)).resolves.toBe(false)
    await expect(documentConversionReady(db as never, autoJob, true)).resolves.toBe(false)
  })

  it("never lets automatic conversion overwrite an existing edited document", async () => {
    await expect(documentConversionReady(createDb({ documentVersion: 1 }) as never, autoJob)).resolves.toBe(false)
    await expect(documentConversionReady(createDb({ documentVersion: 999_999_999 }) as never, autoJob, true)).resolves.toBe(false)
  })

  it.each([null, 2, 4, 0, -1, 2_147_483_647])(
    "denies explicit import when expected version 3 changed to %s",
    async (documentVersion) => {
      await expect(documentConversionReady(createDb({ documentVersion }) as never, explicitJob)).resolves.toBe(false)
    },
  )

  it("denies explicit import without a captured expected version", async () => {
    await expect(documentConversionReady(createDb({ documentVersion: 3 }) as never, {
      ...explicitJob,
      expectedDocumentVersion: undefined,
    })).resolves.toBe(false)
  })

  it.each(["AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"])(
    "denies explicit content replacement in read-only status %s",
    async (status) => {
      await expect(documentConversionReady(createDb({ contract: { id: "contract-a", organizationId: "org-a", status }, documentVersion: 3 }) as never, explicitJob)).resolves.toBe(false)
    },
  )

  it.each(["AWAITING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED"])(
    "allows source-derived initial projection in executed status %s only while no document exists",
    async (status) => {
      const contract = { id: "contract-a", organizationId: "org-a", status }
      await expect(documentConversionReady(createDb({ contract }) as never, autoJob)).resolves.toBe(true)
      await expect(documentConversionReady(createDb({ contract, documentVersion: 1 }) as never, autoJob)).resolves.toBe(false)
    },
  )

  it("denies every conversion for an archived agreement", async () => {
    const contract = { id: "contract-a", organizationId: "org-a", status: "ARCHIVED" }
    await expect(documentConversionReady(createDb({ contract }) as never, autoJob)).resolves.toBe(false)
    await expect(documentConversionReady(createDb({ contract, documentVersion: 3 }) as never, explicitJob)).resolves.toBe(false)
  })

  it.each(invalidApiKeys)("denies %s API key at execution", async (_label, apiKey) => {
    const db = createDb({ apiKey })
    await expect(documentConversionReady(db as never, { ...autoJob, apiKeyId: "key-a" })).resolves.toBe(false)
    await expect(documentConversionReady(db as never, { ...autoJob, apiKeyId: "key-a" }, true)).resolves.toBe(false)
  })

  it("allows a current write-scoped API key and locks it during the final guard", async () => {
    const db = createDb({
      apiKey: {
        id: "key-a", organizationId: "org-a", createdById: "user-a",
        revokedAt: null, expiresAt: new Date(Date.now() + 60_000), scopes: ["read", "write"],
      },
    })
    await expect(documentConversionReady(db as never, { ...autoJob, apiKeyId: "key-a" }, true)).resolves.toBe(true)
    expect(lockCurrentAgreementPermission).toHaveBeenCalled()
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })
})
