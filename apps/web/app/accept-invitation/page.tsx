"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Shield, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { organization, useSession } from "@/lib/auth/client"
import { useTranslations } from "next-intl"

type State = "loading" | "accepting" | "success" | "no_id" | "error"

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, isPending: sessionLoading } = useSession()
  const t = useTranslations("auth.invitation")
  const [state, setState] = useState<State>("loading")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [orgName, setOrgName] = useState<string>("")
  const hasStartedAcceptance = useRef(false)

  const invitationId = searchParams.get("id")

  useEffect(() => {
    if (sessionLoading) return

    if (!invitationId) {
      setState("no_id")
      return
    }

    // Not logged in → send to login with callbackURL pointing back here
    if (!session) {
      const callbackURL = `/accept-invitation?id=${encodeURIComponent(invitationId)}`
      router.replace(`/login?callbackURL=${encodeURIComponent(callbackURL)}`)
      return
    }

    // Setting the invited organization active updates the session and can
    // re-run this effect. Accept an invitation at most once per page visit.
    if (hasStartedAcceptance.current) return
    hasStartedAcceptance.current = true

    // Logged in — call our own accept endpoint (not Better Auth's, which
    // has quirks with manually-created invitations and returns spurious errors).
    setState("accepting")

    fetch(`/api/org/invitations/${invitationId}/accept`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
          const friendlyMessages: Record<string, string> = {
            already_accepted: t("alreadyAccepted"),
            expired: t("expired"),
            email_mismatch: t("emailMismatch"),
          }
          setErrorMsg(friendlyMessages[body?.error] ?? t("failed"))
          setState("error")
          return
        }

        // Set the accepted org as active in the session so the app layout
        // doesn't redirect to /create-org.
        const orgId: string | undefined = body.organizationId
        if (orgId) {
          await organization.setActive({ organizationId: orgId }).catch(() => {})

          // Fetch org name to show in the success message
          const orgRes = await fetch(`/api/org`).catch(() => null)
          if (orgRes?.ok) {
            const orgData = await orgRes.json().catch(() => ({}))
            setOrgName(orgData?.name ?? "")
          }
        }

        setState("success")
        setTimeout(() => router.replace("/dashboard"), 1800)
      })
      .catch(() => {
        setErrorMsg(t("failed"))
        setState("error")
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, session, invitationId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-zinc-900">Aakd</span>
        </div>

        <div
          aria-busy={state === "loading" || state === "accepting"}
          className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8"
        >
          {(state === "loading" || state === "accepting") && (
            <div role="status" aria-live="polite">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-500" />
              <h1 className="text-base font-semibold text-zinc-900">
                {state === "loading" ? t("checkingSession") : t("accepting")}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">{t("justMoment")}</p>
            </div>
          )}

          {state === "success" && (
            <>
              <CheckCircle className="mx-auto mb-4 h-8 w-8 text-green-500" />
              <h1 className="text-base font-semibold text-zinc-900">{t("acceptedTitle")}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {orgName ? t("welcome", { organization: orgName }) : t("acceptedRedirect")}
              </p>
            </>
          )}

          {state === "error" && (
            <div>
              <XCircle className="mx-auto mb-4 h-8 w-8 text-red-500" />
              <h1 className="text-base font-semibold text-zinc-900">{t("errorTitle")}</h1>
              <p role="alert" aria-live="assertive" className="mt-1 text-sm text-zinc-500">
                {errorMsg}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full justify-center")}>
                  {t("dashboard")}
                </Link>
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "min-h-11 w-full justify-center")}>
                  {t("differentAccount")}
                </Link>
              </div>
            </div>
          )}

          {state === "no_id" && (
            <>
              <XCircle className="mx-auto mb-4 h-8 w-8 text-zinc-400" />
              <h1 className="text-base font-semibold text-zinc-900">{t("invalidTitle")}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {t("invalidDescription")}
              </p>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "mt-6 min-h-11 w-full justify-center")}>
                {t("signIn")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  )
}
