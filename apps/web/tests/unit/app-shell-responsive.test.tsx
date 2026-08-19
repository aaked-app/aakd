import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AppLayout from "@/app/(app)/layout"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const authState = vi.hoisted(() => ({
  activeOrg: { id: "org-1", name: "Northwind Legal" } as { id: string; name: string } | null,
  activeOrgError: null as Error | null,
  locale: "en",
  organizations: [{ id: "org-1", name: "Northwind Legal" }] as Array<{ id: string; name: string }>,
  organizationsError: null as Error | null,
  pathname: "/contracts/contract-1",
  push: vi.fn(),
  replace: vi.fn(),
  refetchOrganizations: vi.fn(),
  refetchActiveOrganization: vi.fn(),
  setActive: vi.fn().mockResolvedValue(undefined),
  sessionUser: { id: "user-1", name: "Ada Legal", email: "ada@example.com" } as {
    id: string
    name: string
    email: string
  } | null,
  signOut: vi.fn(),
}))

function getMessage(messages: Record<string, unknown>, namespace: string, key: string): string {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, messages)

  return typeof value === "string" ? value : key
}

vi.mock("next/navigation", () => ({
  usePathname: () => authState.pathname,
  useRouter: () => ({ push: authState.push, replace: authState.replace }),
}))

vi.mock("next-intl", () => ({
  useLocale: () => authState.locale,
  useTranslations: (namespace: string) => (key: string) => {
    const messagesByLocale = { en, fr, de, es, ar } as Record<string, Record<string, unknown>>
    return getMessage(messagesByLocale[authState.locale] ?? en, namespace, key)
  },
}))

vi.mock("@/lib/auth/client", () => ({
  organization: { setActive: authState.setActive },
  signOut: authState.signOut,
  useActiveOrganization: () => ({
    data: authState.activeOrg,
    error: authState.activeOrgError,
    isPending: false,
    refetch: authState.refetchActiveOrganization,
  }),
  useListOrganizations: () => ({
    data: authState.organizations,
    error: authState.organizationsError,
    isPending: false,
    refetch: authState.refetchOrganizations,
  }),
  useSession: () => ({
    data: authState.sessionUser ? { user: authState.sessionUser } : null,
    isPending: false,
  }),
}))

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ identify: vi.fn() }),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}))

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}))

vi.mock("@/components/global-providers", () => ({
  GlobalProviders: () => null,
}))

describe("authenticated application shell", () => {
  beforeEach(() => {
    authState.activeOrg = { id: "org-1", name: "Northwind Legal" }
    authState.activeOrgError = null
    authState.locale = "en"
    authState.organizations = [{ id: "org-1", name: "Northwind Legal" }]
    authState.organizationsError = null
    authState.pathname = "/contracts/contract-1"
    authState.sessionUser = { id: "user-1", name: "Ada Legal", email: "ada@example.com" }
    authState.setActive.mockReset().mockResolvedValue(undefined)
    authState.refetchActiveOrganization.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("exposes named desktop and mobile navigation with a localized active route", async () => {
    render(<AppLayout><p>Contract workspace</p></AppLayout>)

    const desktopNav = screen.getByRole("navigation", { name: "Primary navigation" })
    expect(within(desktopNav).getByRole("link", { name: "Contracts" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("main")).toHaveClass("min-w-0", "overflow-x-hidden")
    expect(screen.getByRole("main").parentElement).toHaveClass("min-w-0", "overflow-hidden")

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" })
    expect(menuButton).toHaveClass("size-11")
    fireEvent.click(menuButton)

    const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" })
    expect(within(mobileNav).getByRole("link", { name: "Contracts" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    const sheet = mobileNav.closest('[data-slot="sheet-content"]')
    await waitFor(() => {
      expect(sheet).toContainElement(document.activeElement as HTMLElement)
    })
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeInTheDocument()

    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" })
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument()
    })
  })

  it("localizes the sign-out affordance and preserves the existing sign-out flow", () => {
    render(<AppLayout><p>Dashboard</p></AppLayout>)

    const signOutButton = screen.getByRole("button", { name: "Sign out" })
    expect(signOutButton).toHaveAttribute("title", "Sign out")
    expect(signOutButton).toHaveClass("size-11")

    fireEvent.click(signOutButton)
    expect(authState.signOut).toHaveBeenCalledTimes(1)
    const signOutOptions = authState.signOut.mock.calls[0]?.[0] as {
      fetchOptions: { onSuccess: () => void }
    }
    signOutOptions.fetchOptions.onSuccess()
    expect(authState.push).toHaveBeenCalledWith("/login")
  })

  it("gives a new user a clear workspace setup brief without changing organization behavior", () => {
    authState.activeOrg = null
    authState.organizations = []

    render(<AppLayout><p>Hidden workspace</p></AppLayout>)

    expect(screen.getByRole("main")).toHaveAccessibleName("Workspace unavailable")
    expect(screen.getByRole("heading", { name: "Create your contract workspace" })).toBeInTheDocument()
    expect(screen.getByText("A focused place for agreements, ownership, and the work that follows.")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Workspace setup steps" })).toBeInTheDocument()
    expect(screen.getByText("Add an agreement")).toBeInTheDocument()
    expect(screen.getByText("Invite your team")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }))
    expect(authState.push).toHaveBeenCalledWith("/create-org")

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(authState.signOut).toHaveBeenCalledTimes(1)
  })

  it("opens the mobile sheet from the logical RTL edge for Arabic", () => {
    authState.locale = "ar"
    const { container } = render(<AppLayout><p>Dashboard</p></AppLayout>)

    fireEvent.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }))
    expect(container.ownerDocument.querySelector('[data-slot="sheet-content"]')).toHaveAttribute(
      "data-side",
      "right",
    )
  })

  it("keeps the workspace setup brief localized and contained for Arabic", () => {
    authState.locale = "ar"
    authState.activeOrg = null
    authState.organizations = []

    const { container } = render(<AppLayout><p>Hidden workspace</p></AppLayout>)

    expect(screen.getByRole("heading", { name: "أنشئ مساحة عمل العقود الخاصة بك" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "خطوات إعداد مساحة العمل" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "إنشاء مساحة العمل" })).toHaveClass("min-h-11")
    expect(container.querySelector("section")).toHaveClass("min-w-0")
    expect(container.querySelector("aside")).toHaveClass("min-w-0", "lg:border-s")
  })

  it("keeps resolving a user's existing organization before showing the empty state", async () => {
    authState.activeOrg = null
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]

    render(<AppLayout><p>Hidden workspace</p></AppLayout>)

    expect(screen.queryByRole("heading", { name: "No organization yet" })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(authState.setActive).toHaveBeenCalledWith({ organizationId: "org-2" })
    })
  })

  it("does not present a membership loading failure as an empty organization", () => {
    authState.activeOrg = null
    authState.organizations = []
    authState.organizationsError = new Error("network unavailable")

    render(<AppLayout><p>Hidden workspace</p></AppLayout>)

    expect(screen.queryByRole("heading", { name: "No organization yet" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "We couldn't load your workspace" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(authState.refetchOrganizations).toHaveBeenCalledTimes(1)
  })

  it("shows the retry state when a failed organization refetch retains cached memberships", () => {
    authState.activeOrg = null
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]
    authState.organizationsError = new Error("network unavailable")

    render(<AppLayout><p>Hidden workspace</p></AppLayout>)

    expect(screen.getByRole("heading", { name: "We couldn't load your workspace" })).toBeInTheDocument()
    expect(screen.queryByText("Hidden workspace")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(authState.refetchOrganizations).toHaveBeenCalledTimes(1)
  })

  it("shows the same retry state when automatic organization activation fails", async () => {
    authState.activeOrg = null
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]
    authState.setActive.mockRejectedValueOnce(new Error("activation unavailable"))

    render(<AppLayout><p>Hidden workspace</p></AppLayout>)

    expect(
      await screen.findByRole("heading", { name: "We couldn't load your workspace" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => {
      expect(authState.setActive).toHaveBeenCalledTimes(2)
    })
    expect(authState.refetchOrganizations).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Hidden workspace")).not.toBeInTheDocument()
  })

  it("shows the retry state for a resolved activation error and recovers after retry", async () => {
    authState.activeOrg = null
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]
    authState.setActive
      .mockResolvedValueOnce({
        data: null,
        error: { status: 503, statusText: "Service Unavailable" },
      })
      .mockResolvedValueOnce({ data: { id: "org-2" }, error: null })

    const { rerender } = render(<AppLayout><p>Recovered workspace</p></AppLayout>)

    expect(
      await screen.findByRole("heading", { name: "We couldn't load your workspace" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => {
      expect(authState.setActive).toHaveBeenCalledTimes(2)
    })
    expect(authState.refetchOrganizations).toHaveBeenCalledTimes(1)

    authState.activeOrg = { id: "org-2", name: "Acme Legal" }
    rerender(<AppLayout><p>Recovered workspace</p></AppLayout>)

    expect(await screen.findByText("Recovered workspace")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "We couldn't load your workspace" }),
    ).not.toBeInTheDocument()
  })

  it("localizes an active-organization query failure, retries it once, and recovers without auto-activation", async () => {
    authState.activeOrg = null
    authState.locale = "fr"
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]

    const { rerender } = render(<AppLayout><p>Espace restauré</p></AppLayout>)

    await waitFor(() => {
      expect(authState.setActive).toHaveBeenCalledTimes(1)
    })

    authState.activeOrgError = new Error("active organization unavailable")
    rerender(<AppLayout><p>Espace restauré</p></AppLayout>)

    expect(
      screen.getByRole("heading", { name: "Impossible de charger votre espace de travail" }),
    ).toBeInTheDocument()
    expect(authState.setActive).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))

    expect(authState.refetchActiveOrganization).toHaveBeenCalledTimes(1)
    expect(authState.refetchOrganizations).toHaveBeenCalledTimes(1)
    expect(authState.setActive).toHaveBeenCalledTimes(1)

    authState.activeOrgError = null
    authState.activeOrg = { id: "org-2", name: "Acme Legal" }
    rerender(<AppLayout><p>Espace restauré</p></AppLayout>)

    expect(await screen.findByText("Espace restauré")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Impossible de charger votre espace de travail" }),
    ).not.toBeInTheDocument()
    expect(authState.setActive).toHaveBeenCalledTimes(1)
  })

  it("preserves the existing unauthenticated redirect boundary", async () => {
    authState.sessionUser = null

    render(<AppLayout><p>Protected workspace</p></AppLayout>)

    expect(screen.queryByText("Protected workspace")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(authState.replace).toHaveBeenCalledWith("/login")
    })
  })

  it("does not activate a cached organization without an authenticated session", async () => {
    authState.activeOrg = null
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]
    authState.sessionUser = null

    render(<AppLayout><p>Protected workspace</p></AppLayout>)

    await waitFor(() => {
      expect(authState.replace).toHaveBeenCalledWith("/login")
    })
    expect(authState.setActive).not.toHaveBeenCalled()
  })

  it("does not carry an activation failure into a different authenticated session", async () => {
    authState.activeOrg = null
    authState.organizations = [{ id: "org-2", name: "Acme Legal" }]
    authState.setActive.mockRejectedValueOnce(new Error("activation unavailable"))

    const { rerender } = render(<AppLayout><p>Protected workspace</p></AppLayout>)
    expect(
      await screen.findByRole("heading", { name: "We couldn't load your workspace" }),
    ).toBeInTheDocument()

    authState.sessionUser = { id: "user-2", name: "Grace Legal", email: "grace@example.com" }
    rerender(<AppLayout><p>Protected workspace</p></AppLayout>)

    await waitFor(() => {
      expect(authState.setActive).toHaveBeenCalledTimes(2)
    })
  })

  it("keeps the shell copy contract complete in all five supported locales", () => {
    const requiredKeys = [
      "soon",
      "signOut",
      "primaryNavigation",
      "mobileNavigation",
      "openNavigation",
      "closeNavigation",
      "userAvatar",
      "noOrganizationTitle",
      "noOrganizationDescription",
      "createOrganization",
      "invitationHint",
      "workspaceSetupEyebrow",
      "workspaceSetupTitle",
      "workspaceSetupDescription",
      "workspaceSetupSteps",
      "setupStepWorkspace",
      "setupStepAgreement",
      "setupStepTeam",
      "setupStepWorkspaceDescription",
      "setupStepAgreementDescription",
      "setupStepTeamDescription",
      "createWorkspace",
      "invitationTitle",
      "invitationDescription",
      "workspaceUnavailable",
      "organizationLoadErrorTitle",
      "organizationLoadErrorDescription",
      "retryOrganization",
    ]

    for (const messages of [en, fr, de, es, ar] as Array<Record<string, unknown>>) {
      for (const key of requiredKeys) {
        expect(getMessage(messages, "nav", key), key).not.toBe(key)
      }
    }
  })
})
