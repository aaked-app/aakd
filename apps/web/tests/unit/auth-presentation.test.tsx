import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AcceptInvitationPage from "@/app/accept-invitation/page"
import CreateOrgPage from "@/app/(auth)/create-org/page"
import RegisterPage from "@/app/(auth)/register/page"
import LoginPage from "@/app/(auth)/login/page"
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page"
import ResetPasswordPage from "@/app/(auth)/reset-password/page"
import AuthLayout from "@/app/(auth)/layout"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const catalogs = { en, fr, de, es, ar }
let locale: keyof typeof catalogs = "en"
let searchParams = new URLSearchParams()
let sessionPending = false
let session: { user: { id: string } } | null = { user: { id: "user-1" } }

const push = vi.fn()
const replace = vi.fn()
const { createOrganization, setActiveOrganization, signInEmail, signUpEmail, resetPassword, toastError, posthogCapture } = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  setActiveOrganization: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  resetPassword: vi.fn(),
  toastError: vi.fn(),
  posthogCapture: vi.fn(),
}))

function message(namespace: string, key: string, values?: Record<string, unknown>) {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, catalogs[locale])

  if (typeof value !== "string") {
    throw new Error(`Missing message ${locale}.${namespace}.${key}`)
  }

  return Object.entries(values ?? {}).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    value,
  )
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
}))

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => message(namespace, key, values),
}))

vi.mock("@/lib/auth/client", () => ({
  signIn: { email: signInEmail },
  authClient: { resetPassword },
  signUp: { email: signUpEmail },
  organization: {
    create: createOrganization,
    setActive: setActiveOrganization,
  },
  useSession: () => ({ data: session, isPending: sessionPending }),
}))

vi.mock("posthog-js", () => ({
  default: { capture: posthogCapture },
}))

vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}))

describe("authentication presentation", () => {
  beforeEach(() => {
    locale = "en"
    searchParams = new URLSearchParams()
    sessionPending = false
    session = { user: { id: "user-1" } }
    createOrganization.mockReset()
    setActiveOrganization.mockReset()
    signInEmail.mockReset()
    signUpEmail.mockReset()
    resetPassword.mockReset()
    toastError.mockReset()
    posthogCapture.mockReset()
    push.mockReset()
    replace.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("frames account access as the first step of a private contract workspace", () => {
    render(<AuthLayout><LoginPage /></AuthLayout>)

    expect(screen.getByTestId("auth-workspace-frame")).toHaveClass("bg-[#f5f4ef]")
    expect(screen.getByRole("complementary", { name: "Workspace setup" })).toBeInTheDocument()
    const progress = screen.getByRole("list", { name: "Setup progress" })
    expect(progress).toHaveTextContent("Account")
    expect(progress).toHaveTextContent("Workspace")
    expect(progress).toHaveTextContent("First agreement")
    expect(screen.getByText("Your contract workspace stays under your control.")).toBeInTheDocument()
  })

  it("renders the registration form and announces each translated field error", () => {
    render(<RegisterPage />)

    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument()
    const name = screen.getByLabelText("Name")
    const email = screen.getByLabelText("Email address")
    const password = screen.getByLabelText("Password")
    const submit = screen.getByRole("button", { name: "Create account" })

    fireEvent.click(submit)
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required")
    expect(name).toHaveFocus()

    fireEvent.change(name, { target: { value: "Jane Smith" } })
    fireEvent.click(submit)
    expect(screen.getByRole("alert")).toHaveTextContent("Email address is required")
    expect(email).toHaveFocus()

    fireEvent.change(email, { target: { value: "not-an-email" } })
    fireEvent.click(submit)
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address")

    fireEvent.change(email, { target: { value: "jane@example.com" } })
    fireEvent.click(submit)
    expect(screen.getByRole("alert")).toHaveTextContent("Password is required")
    expect(password).toHaveFocus()
  })

  it("renders invitation registration copy from the active Arabic catalog", () => {
    locale = "ar"
    searchParams = new URLSearchParams("callbackURL=%2Faccept-invitation%3Fid%3Dinvite-1")

    render(<RegisterPage />)

    expect(screen.getByText("أنشئ حسابًا لقبول دعوتك بأمان.")).toBeInTheDocument()
    expect(screen.getByLabelText("الاسم")).toBeInTheDocument()
  })

  it.each([
    ["fr", "Commencez avec Aakd"],
    ["de", "Starten Sie mit Aakd"],
    ["es", "Comience con Aakd"],
    ["ar", "ابدأ مع Aakd"],
  ] as const)("keeps the Aakd product name in the %s registration copy", (language, copy) => {
    locale = language
    render(<RegisterPage />)
    expect(screen.getByText(copy)).toBeInTheDocument()
  })

  it("localizes workspace guidance and slug-conflict feedback", async () => {
    locale = "ar"
    createOrganization.mockResolvedValue({
      data: null,
      error: { status: 409, message: "Slug already exists" },
    })

    render(<CreateOrgPage />)

    expect(screen.getByText("هل تنضم إلى فريق موجود؟")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "تخطي — قبول دعوة بدلاً من ذلك" })).toHaveClass(
      "min-h-11",
    )
    expect(screen.getByLabelText("اسم المؤسسة")).toHaveClass("h-11")

    fireEvent.change(screen.getByLabelText("اسم المؤسسة"), {
      target: { value: "فريق التجربة" },
    })
    fireEvent.click(screen.getByRole("button", { name: "إنشاء المؤسسة" }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "توجد مؤسسة بهذا الاسم بالفعل. اختر اسمًا مختلفًا.",
      )
    })
  })

  it("does not expose an unknown workspace-provider failure message", async () => {
    createOrganization.mockResolvedValue({
      data: null,
      error: { status: 500, message: "database_connection_string" },
    })

    render(<CreateOrgPage />)
    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Example workspace" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to create organization")
    })
    expect(toastError).not.toHaveBeenCalledWith("database_connection_string")
  })

  it("announces invitation loading and localizes an invalid Arabic invitation", async () => {
    locale = "ar"
    sessionPending = true
    const { unmount } = render(<AcceptInvitationPage />)
    expect(screen.getByRole("status")).toHaveTextContent("جارٍ التحقق من الجلسة…")

    unmount()
    locale = "ar"
    sessionPending = false
    render(<AcceptInvitationPage />)

    expect(await screen.findByRole("heading", { name: "رابط الدعوة غير صالح" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "الانتقال إلى تسجيل الدخول" })).toHaveClass(
      "min-h-11",
    )
  })

  it("does not expose an unknown invitation failure code", async () => {
    searchParams = new URLSearchParams("id=invite-1")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "database_connection_string" }), { status: 500 }),
      ),
    )

    render(<AcceptInvitationPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to accept invitation")
    expect(screen.queryByText("database_connection_string")).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it("keeps every auth message in five-locale parity", () => {
    const englishKeys = Object.keys(en.auth).sort()
    expect(Object.keys(fr.auth).sort()).toEqual(englishKeys)
    expect(Object.keys(de.auth).sort()).toEqual(englishKeys)
    expect(Object.keys(es.auth).sort()).toEqual(englishKeys)
    expect(Object.keys(ar.auth).sort()).toEqual(englishKeys)
  })

  it("uses localized safe sign-in feedback and 44px controls", async () => {
    signInEmail.mockResolvedValue({ error: { message: "database_connection_string" } })
    render(<LoginPage />)

    expect(screen.getByLabelText("Email address")).toHaveClass("min-h-11")
    expect(screen.getByLabelText("Password")).toHaveClass("min-h-11")
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass("min-h-11")
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveClass("min-h-11")

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Authentication is temporarily unavailable. Please try again."))
    expect(toastError).not.toHaveBeenCalledWith("database_connection_string")
  })

  it("uses a safe fallback everywhere when login receives an external callback", async () => {
    searchParams = new URLSearchParams("callbackURL=https%3A%2F%2Fevil.example%2Fsteal")
    signInEmail.mockResolvedValue({ error: null })
    render(<LoginPage />)

    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute("href", "/register")
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(signInEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/dashboard" }))
  })

  it("preserves an internal invitation callback through login and its registration link", async () => {
    const callback = "/accept-invitation?id=invite-1#review"
    searchParams = new URLSearchParams(`callbackURL=${encodeURIComponent(callback)}`)
    signInEmail.mockResolvedValue({ error: null })
    render(<LoginPage />)

    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute(
      "href",
      `/register?callbackURL=${encodeURIComponent(callback)}`,
    )
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith(callback))
    expect(signInEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: callback }))
  })

  it("treats an unsafe registration callback as no invitation", async () => {
    searchParams = new URLSearchParams("callbackURL=%2F%2Fevil.example%2Fsteal")
    signUpEmail.mockResolvedValue({ error: null })
    render(<RegisterPage />)

    expect(screen.getByText("Get started with Aakd")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jane Smith" } })
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/create-org"))
    expect(signUpEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/create-org" }))
    expect(posthogCapture).toHaveBeenCalledWith("signup_completed", { hasInvite: false })
  })

  it("uses the sanitized invitation callback for registration redirect, copy, link, and telemetry", async () => {
    const callback = "/accept-invitation?id=invite-1"
    searchParams = new URLSearchParams(`callbackURL=${encodeURIComponent(callback)}`)
    signUpEmail.mockResolvedValue({ error: null })
    render(<RegisterPage />)

    expect(screen.getByText("Create an account to accept your invitation securely.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?callbackURL=${encodeURIComponent(callback)}`,
    )
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jane Smith" } })
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith(callback))
    expect(signUpEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: callback }))
    expect(posthogCapture).toHaveBeenCalledWith("signup_completed", { hasInvite: true })
  })

  it("keeps password-reset requests enumeration-resistant for completed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "unknown_account" }), { status: 404 })))
    render(<ForgotPasswordPage />)

    expect(screen.getByLabelText("Email address")).toHaveClass("min-h-11")
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "private@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }))

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument()
    expect(screen.queryByText("unknown_account")).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it("uses localized safe reset feedback without exposing the token or provider message", async () => {
    searchParams = new URLSearchParams("token=private-reset-token")
    resetPassword.mockResolvedValue({ error: { message: "database_connection_string" } })
    render(<ResetPasswordPage />)

    expect(screen.getByLabelText("New password")).toHaveClass("min-h-11")
    expect(screen.getByLabelText("Confirm password")).toHaveClass("min-h-11")
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "secret123" } })
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Reset failed — the link may have expired"))
    expect(document.body).not.toHaveTextContent("private-reset-token")
    expect(document.body).not.toHaveTextContent("database_connection_string")
  })
})
