"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import posthog from "posthog-js"
import { signUp } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "next-intl"
import { safeCallbackPath } from "@/lib/auth/safe-callback"
import { authErrorMessageKey } from "@/lib/auth/error-message"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // If the user arrived via an invitation link, callbackURL points back to
  // /accept-invitation?id=... — skip /create-org entirely and go accept.
  const callbackURL = safeCallbackPath(searchParams.get("callbackURL"))
  const t = useTranslations("auth")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState<{ field: "name" | "email" | "password"; message: string } | null>(null)
  const [formError, setFormError] = useState("")

  const destination = callbackURL ?? "/create-org"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    if (!name.trim()) {
      setFieldError({ field: "name", message: t("nameRequired") })
      document.getElementById("name")?.focus()
      return
    }
    if (!email.trim()) {
      setFieldError({ field: "email", message: t("emailRequired") })
      document.getElementById("email")?.focus()
      return
    }
    const normalizedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFieldError({ field: "email", message: t("emailInvalid") })
      document.getElementById("email")?.focus()
      return
    }
    if (!password) {
      setFieldError({ field: "password", message: t("passwordRequired") })
      document.getElementById("password")?.focus()
      return
    }
    if (password.length < 8) {
      setFieldError({ field: "password", message: t("passwordTooShort") })
      document.getElementById("password")?.focus()
      return
    }
    setFieldError(null)
    setLoading(true)
    try {
      const result = await signUp.email({
        name,
        email: normalizedEmail,
        password,
        callbackURL: destination,
      })
      if (result.error) {
        setFormError(t(authErrorMessageKey(result.error)))
      } else {
        // Fire activation signal — PostHog respects consent (no-op if user opted out).
        // Identify happens later in (app)/layout.tsx once session resolves.
        try {
          posthog.capture("signup_completed", {
            hasInvite: !!callbackURL,
          })
        } catch {
          // Never block the redirect on a telemetry failure.
        }
        router.push(destination)
      }
    } catch (error) {
      setFormError(t(authErrorMessageKey(error as { code?: string; message?: string })))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">{t("register")}</h1>
        <p className="text-sm text-zinc-500">
          {callbackURL ? t("registerSubtitleInviteSecure") : t("registerSubtitle")}
        </p>
      </div>
      <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("fullName")}</Label>
          <Input
            id="name"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => { setName(e.target.value); if (fieldError?.field === "name") setFieldError(null); if (formError) setFormError("") }}
            required
            autoComplete="name"
            disabled={loading}
            aria-invalid={fieldError?.field === "name"}
            aria-describedby={fieldError?.field === "name" ? "name-error" : undefined}
            className="h-11"
          />
          {fieldError?.field === "name" && <p id="name-error" role="alert" aria-live="polite" className="text-sm text-destructive">{fieldError.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (fieldError?.field === "email") setFieldError(null); if (formError) setFormError("") }}
            required
            autoComplete="email"
            disabled={loading}
            aria-invalid={fieldError?.field === "email"}
            aria-describedby={fieldError?.field === "email" ? "register-email-error" : undefined}
            className="h-11"
          />
          {fieldError?.field === "email" && <p id="register-email-error" role="alert" aria-live="polite" className="text-sm text-destructive">{fieldError.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (fieldError?.field === "password") setFieldError(null); if (formError) setFormError("") }}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
            aria-invalid={fieldError?.field === "password"}
            aria-describedby={fieldError?.field === "password" ? "register-password-error" : undefined}
            className="h-11"
          />
          {fieldError?.field === "password" && <p id="register-password-error" role="alert" aria-live="polite" className="text-sm text-destructive">{fieldError.message}</p>}
        </div>
        {formError && <p role="alert" aria-live="polite" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? t("creatingAccount") : t("register")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-500">
        {t("hasAccount")}{" "}
        <Link
          href={callbackURL ? `/login?callbackURL=${encodeURIComponent(callbackURL)}` : "/login"}
          className="inline-flex min-h-11 items-center text-primary hover:underline"
        >
          {t("login")}
        </Link>
      </p>
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
