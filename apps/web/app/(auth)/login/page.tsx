"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { signIn } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "next-intl"
import { safeCallbackPath } from "@/lib/auth/safe-callback"
import { authErrorMessageKey } from "@/lib/auth/error-message"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackURL = safeCallbackPath(searchParams.get("callbackURL")) ?? "/dashboard"
  const t = useTranslations("auth")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    setLoading(true)
    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL,
      })
      if (result.error) {
        const message = t(authErrorMessageKey(result.error))
        setFormError(message)
        toast.error(message)
      } else {
        router.push(callbackURL)
      }
    } catch (error) {
      const message = t(authErrorMessageKey(error as { code?: string; message?: string }))
      setFormError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{t("accessEyebrow")}</p>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-zinc-950">{t("login")}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{t("loginSubtitle")}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-800 hover:underline">
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="min-h-11"
          />
        </div>
        {formError && <p role="alert" aria-live="polite" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="min-h-11 w-full" disabled={loading}>
          {loading ? t("signingIn") : t("login")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-500">
        {t("noAccount")}{" "}
        <Link
          href={callbackURL !== "/dashboard" ? `/register?callbackURL=${encodeURIComponent(callbackURL)}` : "/register"}
          className="inline-flex min-h-11 items-center font-medium text-emerald-800 hover:underline"
        >
          {t("createOne")}
        </Link>
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
