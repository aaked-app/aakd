import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { auth } from "@/lib/auth/config"
import { prisma } from "@/lib/db/client"
import { alertsCheckQueue, documentExportQueue } from "@/lib/jobs/queues"
import { POST as checkAlerts } from "@/app/api/alerts/route"
import { GET as connectCrm, DELETE as disconnectCrm } from "@/app/api/crm/[provider]/connect/route"
import { PATCH as updateCrm } from "@/app/api/crm/[provider]/integration/route"
import { GET as completeCrm } from "@/app/api/crm/[provider]/callback/route"
import { POST as resendInvitation, DELETE as deleteInvitation } from "@/app/api/org/invitations/[id]/route"
import { POST as acceptInvitation } from "@/app/api/org/invitations/[id]/accept/route"
import { POST as uploadLogo } from "@/app/api/org/logo/route"
import { POST as uploadAvatar } from "@/app/api/user/avatar/route"
import { PATCH as updateLocale } from "@/app/api/user/locale/route"
import { POST as markNotificationsRead } from "@/app/api/notifications/read-all/route"
import { POST as exportDocument } from "@/app/api/contracts/[id]/document/export/route"
import { GET as pollDocumentExport } from "@/app/api/contracts/[id]/document/export/[jobId]/route"

vi.mock("@/lib/auth/config", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/auth/middleware", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/middleware")>(),
  resolveAuth: vi.fn(),
}))
vi.mock("@/lib/storage", () => ({ storage: { upload: vi.fn(), getSignedDownloadUrl: vi.fn() } }))
vi.mock("@/lib/email/invitation", () => ({ sendInvitationEmail: vi.fn() }))
vi.mock("@/lib/posthog-server", () => ({ captureServerEvent: vi.fn() }))

const base = {
  userId: "owner", memberId: "member", organizationId: "org", role: "owner",
  requestId: "legacy-boundary", apiKeyId: "key",
}
const idParams = () => ({ params: Promise.resolve({ id: "agreement" }) })
const providerParams = () => ({ params: Promise.resolve({ provider: "hubspot" }) })
const routes: Array<{ name: string; method: string; invoke: (req: Request) => Promise<Response> }> = [
  { name: "alert checks", method: "POST", invoke: checkAlerts },
  { name: "CRM OAuth initiation", method: "GET", invoke: req => connectCrm(req, providerParams()) },
  { name: "CRM OAuth callback", method: "GET", invoke: req => completeCrm(req, providerParams()) },
  { name: "CRM disconnect", method: "DELETE", invoke: req => disconnectCrm(req, providerParams()) },
  { name: "CRM automation settings", method: "PATCH", invoke: req => updateCrm(req, providerParams()) },
  { name: "invitation resend", method: "POST", invoke: req => resendInvitation(req, idParams()) },
  { name: "invitation deletion", method: "DELETE", invoke: req => deleteInvitation(req, idParams()) },
  { name: "invitation acceptance", method: "POST", invoke: req => acceptInvitation(req, idParams()) },
  { name: "organization logo", method: "POST", invoke: uploadLogo },
  { name: "avatar", method: "POST", invoke: uploadAvatar },
  { name: "locale", method: "PATCH", invoke: updateLocale },
  { name: "notification acknowledgement", method: "POST", invoke: markNotificationsRead },
  { name: "document export", method: "POST", invoke: req => exportDocument(req, idParams()) },
  { name: "document export result", method: "GET", invoke: req => pollDocumentExport(req, { params: Promise.resolve({ id: "agreement", jobId: "job" }) }) },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(alertsCheckQueue.add).mockResolvedValue({ id: "job" } as never)
})

describe("legacy API-key mutation containment", () => {
  it.each([[], ["read"], ["write"], ["read", "text_read", "write"], ["action_propose"]])(
    "never upgrades legacy write or proposal capability into unrestricted mutation (%j)", (...scopes) => {
      const response = requireWriteScope({ ...base, source: "api_key", scopes: scopes as string[] })
      expect(response?.status).toBe(403)
    },
  )

  it("preserves the session path and its route-specific role checks", () => {
    expect(requireWriteScope({ ...base, source: "session" })).toBeNull()
  })
})

describe.each(routes)("session-only boundary: $name", ({ method, invoke }) => {
  it.each(["read", "write", "text_read", "action_propose"])("rejects %s keys before data or side effects", async scope => {
    vi.mocked(resolveAuth).mockResolvedValue({ ...base, source: "api_key", scopes: [scope] })
    const response = await invoke(new Request("http://localhost/api/test", {
      method,
      headers: { Authorization: "Bearer cf_live_synthetic-boundary" },
      ...(method === "GET" ? {} : { body: "invalid-json" }),
    }))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "human_session_required" })
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
    expect(prisma.invitation.findUnique).not.toHaveBeenCalled()
    expect(prisma.invitation.update).not.toHaveBeenCalled()
    expect(prisma.member.create).not.toHaveBeenCalled()
    expect(prisma.notification.updateMany).not.toHaveBeenCalled()
    expect(alertsCheckQueue.add).not.toHaveBeenCalled()
    expect(documentExportQueue.add).not.toHaveBeenCalled()
    expect(auth.api.getSession).not.toHaveBeenCalled()
  })
})

it("does not fall back to a cookie when an invalid or revoked key accepts an invitation", async () => {
  vi.mocked(resolveAuth).mockResolvedValue(null)
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "owner" } } as never)
  const response = await acceptInvitation(new Request("http://localhost/api/org/invitations/inv/accept", {
    method: "POST", headers: { Authorization: "Bearer cf_live_revoked-synthetic" },
  }), idParams())
  expect(response.status).toBe(403)
  expect(auth.api.getSession).not.toHaveBeenCalled()
  expect(prisma.invitation.findUnique).not.toHaveBeenCalled()
})
