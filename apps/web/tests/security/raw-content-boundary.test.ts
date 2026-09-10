import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveAuth } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/client"
import { GET as upload } from "@/app/api/contracts/[id]/upload/route"
import { GET as document } from "@/app/api/contracts/[id]/document/route"
import { GET as snapshot } from "@/app/api/contracts/[id]/snapshots/[snapshotId]/route"
import { GET as compare } from "@/app/api/contracts/[id]/snapshots/compare/route"
import { GET as risk } from "@/app/api/contracts/[id]/risk-score/route"
import { GET as comments } from "@/app/api/contracts/[id]/comments/route"
import { GET as signing } from "@/app/api/contracts/[id]/signing/route"
import { GET as template } from "@/app/api/templates/[id]/route"
import { GET as suggestions } from "@/app/api/contracts/[id]/obligations/extract/route"
import { GET as detail } from "@/app/api/contracts/[id]/route"
import { GET as extractions } from "@/app/api/contracts/[id]/extractions/route"
import { GET as activities } from "@/app/api/activities/route"
import { GET as notifications } from "@/app/api/notifications/route"
import { GET as approvals } from "@/app/api/contracts/[id]/approvals/route"
import { GET as contracts } from "@/app/api/contracts/route"
import { actionDetailSelect, toActionDetail } from "@/lib/actions/dto"
import { GET as importJob } from "@/app/api/import/[jobId]/route"

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(), requireWriteScope: vi.fn() }))
vi.mock("@/lib/storage", () => ({ storage: { download: vi.fn() } }))
const principal = { userId: "user", memberId: "member", organizationId: "org", role: "viewer", requestId: "raw-boundary" }
const req = () => new Request("http://localhost/api/test")
const params = () => ({ params: Promise.resolve({ id: "allowed", snapshotId: "snapshot" }) })
const rawRoutes = [upload, document, snapshot, compare, risk, comments]
const sessionRoutes = [signing, template, suggestions]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant" } as never)
  vi.mocked(prisma.contract.findUnique).mockResolvedValue({ id: "allowed", organizationId: "org" } as never)
  vi.mocked(prisma.contract.count).mockResolvedValue(1)
})

describe.each(rawRoutes)("raw document boundary %s", route => {
  it.each([[], ["read"], ["write"], ["action_propose"]])("requires explicit text scope (%j)", async (...scopes) => {
    vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: scopes as string[] })
    const response = await route(req(), params())
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "text_read scope required" })
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })
  it.each(["session", "api_key"] as const)("preserves %s text reads but still requires an exact grant", async source => {
    vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source, scopes: ["read", "text_read"] })
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue(null)
    const response = await route(req(), params())
    expect(response.status).toBe(404)
    expect(prisma.contractAccessGrant.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org", memberId: "member", contractId: "allowed" }, select: { id: true },
    })
  })
})

describe.each(sessionRoutes)("human-only boundary %s", route => {
  it.each(["read", "write", "text_read", "action_propose"])("does not grant %s keys human capability", async scope => {
    vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: [scope] })
    const response = await route(req(), params())
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "human_session_required" })
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })
})

it.each(["read", "text_read"])("contract %s never exposes signing capabilities", async scope => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: [scope] })
  vi.mocked(prisma.contract.findUnique).mockResolvedValue({ id: "allowed", title: "Agreement", organizationId: "org", signingUrl: "https://sign.test/secret", docusealSubmissionId: "provider-secret", notes: "private notes", versions: [{ id: "v", version: 1, changeNote: "private change" }], activities: [{ id: "a", action: "UPDATED", detail: "private detail", metadata: { excerpt: "private clause" } }] } as never)
  const body = await (await detail(req(), params())).json()
  expect(body.signingUrl).toBeUndefined()
  expect(body.docusealSubmissionId).toBeUndefined()
  expect(body.title).toBe("Agreement")
  if (scope === "read") {
    expect(body.notes).toBeUndefined()
    expect(body.versions[0].changeNote).toBeUndefined()
    expect(body.activities[0].detail).toBeUndefined()
    expect(body.activities[0].metadata).toBeUndefined()
  } else expect(body.notes).toBe("private notes")
})

it("metadata extraction reads omit raw value and source text", async () => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: ["read"] })
  vi.mocked(prisma.aIExtraction.findMany).mockResolvedValue([{ id: "fact", field: "governingLaw", status: "pending", rawValue: "clause", sourceText: "full private clause", confidence: 0.9 }] as never)
  const body = await (await extractions(req(), params())).json()
  expect(body.extractions[0].field).toBe("governingLaw")
  expect(body.extractions[0].rawValue).toBeUndefined()
  expect(body.extractions[0].sourceText).toBeUndefined()
})

it.each(["session", "api_key"] as const)("organization activity requires exact grants for %s", async source => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source, scopes: ["read"] })
  vi.mocked(prisma.activity.findMany).mockResolvedValue([])
  vi.mocked(prisma.activity.count).mockResolvedValue(0)
  await activities(req())
  const where = vi.mocked(prisma.activity.findMany).mock.calls[0][0]?.where
  expect(where).toMatchObject({ contract: { AND: [{ organizationId: "org" }, { accessGrants: { some: { organizationId: "org", memberId: "member" } } }] } })
  expect(vi.mocked(prisma.activity.count).mock.calls[0][0]?.where).toEqual(where)
})

it("emergency deny-all cannot be bypassed by searching the organization feed", async () => {
  vi.stubEnv("AGREEMENT_ACCESS_EMERGENCY_DENY_ALL", "true")
  try {
    vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: ["text_read"] })
    vi.mocked(prisma.activity.findMany).mockResolvedValue([])
    vi.mocked(prisma.activity.count).mockResolvedValue(0)
    await activities(new Request("http://localhost/api/activities?search=private"))
    expect(vi.mocked(prisma.activity.findMany).mock.calls[0][0]?.where).toMatchObject({
      contract: { AND: [{ organizationId: "org" }, { AND: [{ id: "__denied__" }, { id: { not: "__denied__" } }] }] },
    })
  } finally { vi.unstubAllEnvs() }
})

it.each(["session", "api_key"] as const)("authorized %s document reads retain document content", async source => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source, scopes: ["read", "text_read"] })
  vi.mocked(prisma.contractDocument.findUnique).mockResolvedValue({ id: "doc", content: { type: "doc", content: [{ type: "text", text: "source clause" }] }, version: 1 } as never)
  const response = await document(req(), params())
  expect(response.status).toBe(200)
  expect((await response.json()).document.content.content[0].text).toBe("source clause")
})

it("metadata activity reads retain action identity, not free text or payload", async () => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: ["read"] })
  vi.mocked(prisma.activity.findMany).mockResolvedValue([{ id: "a", action: "UPDATED", detail: "private", metadata: { excerpt: "private" }, actorLabel: "arbitrary private text", contractId: "allowed" }] as never)
  vi.mocked(prisma.activity.count).mockResolvedValue(1)
  const body = await (await activities(req())).json()
  expect(body.activities[0]).toEqual({ id: "a", action: "UPDATED", contractId: "allowed" })
})

it("an organization key cannot read invitations from another organization", async () => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: ["read"] })
  vi.mocked(prisma.contractAccessGrant.findMany).mockResolvedValue([])
  vi.mocked(prisma.notification.findMany).mockResolvedValue([])
  vi.mocked(prisma.notification.count).mockResolvedValue(0)
  await notifications(req())
  const where = vi.mocked(prisma.notification.findMany).mock.calls[0][0]?.where
  expect(where?.AND).toEqual(expect.arrayContaining([{ userId: "user" }, { OR: [{ organizationId: "org" }] }]))
  expect(JSON.stringify(where)).not.toContain("org.invited")
})

it("contract listing does not select notes for plain read keys", async () => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: ["read"] })
  vi.mocked(prisma.contract.findMany).mockResolvedValue([])
  await contracts(req())
  expect(vi.mocked(prisma.contract.findMany).mock.calls[0][0]?.select?.notes).toBe(false)
})

it.each(["read", "text_read"])("%s approval reads omit internal replay identity", async scope => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, source: "api_key", scopes: [scope] })
  vi.mocked(prisma.approval.findMany).mockResolvedValue([{ id: "approval", status: "pending", comment: "private comment", requestPrincipalId: "key", requestIdempotencyHash: "hash", requestDigest: "digest" }] as never)
  const body = await (await approvals(req(), params())).json()
  expect(body.approvals[0].id).toBe("approval")
  expect(body.approvals[0].requestPrincipalId).toBeUndefined()
  expect(body.approvals[0].requestIdempotencyHash).toBeUndefined()
  expect(body.approvals[0].requestDigest).toBeUndefined()
  expect(body.approvals[0].comment).toBe(scope === "text_read" ? "private comment" : undefined)
})

it("action metadata excludes evidence and review payloads in query and serialization", () => {
  const selection = actionDetailSelect(false)
  expect(selection.evidence.select.note).toBe(false)
  expect(selection.evidence.select.sourceUrl).toBe(false)
  expect(selection.evidence.select.reviews.select.comment).toBe(false)
  expect(selection.activities.select.detail).toBe(false)
  expect(selection.approvals.select.comment).toBe(false)
  const row = {
    id: "action", sourceText: "private", evidence: [{ id: "evidence", note: "private", sourceUrl: "https://private.test", reviews: [{ id: "review", comment: "private" }] }],
    activities: [{ id: "activity", detail: "private", actorLabel: "private" }], approvals: [{ id: "approval", comment: "private" }], deliveries: [],
  } as never
  expect(JSON.stringify(toActionDetail(row, false))).not.toContain("private")
  expect(JSON.stringify(toActionDetail(row, true))).toContain("private")
})

it("import status exposes report availability, never storage keys or configuration", async () => {
  vi.mocked(resolveAuth).mockResolvedValue({ ...principal, role: "member", source: "api_key", scopes: ["read", "text_read"] })
  vi.mocked(prisma.importJob.findUnique).mockResolvedValue({ id: "job", organizationId: "org", createdById: "user", source: "CSV", status: "FAILED", totalRows: 1, errorReportKey: "private/report", storageKey: "private/upload", driveFileIds: ["private-id"], mappingJson: { secret: "private" } } as never)
  vi.mocked(prisma.importRow.findMany).mockResolvedValue([])
  const response = await importJob(req(), { params: Promise.resolve({ jobId: "job" }) })
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.job.hasErrorReport).toBe(true)
  expect(JSON.stringify(body)).not.toContain("private")
  expect(body.job.errorReportKey).toBeUndefined()
  expect(body.job.mappingJson).toBeUndefined()
})
