"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CookieConsent() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (pathname !== "/") {
      setVisible(false)
      return
    }
    const consent = localStorage.getItem("cookie_consent")
    if (!consent) setVisible(true)
  }, [pathname])

  function accept() {
    localStorage.setItem("cookie_consent", "accepted")
    posthog.opt_in_capturing()
    posthog.capture("$pageview", { $current_url: `${window.origin}/` })
    setVisible(false)
  }

  function decline() {
    localStorage.setItem("cookie_consent", "declined")
    posthog.opt_out_capturing()
    setVisible(false)
  }

  // Analytics consent belongs to the public site. Never block authenticated
  // workflows such as onboarding, uploads, approvals, or signing.
  if (!visible || pathname !== "/") return null

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg",
        "rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg p-4",
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4",
      )}
    >
      <p className="text-sm text-muted-foreground flex-1">
        We use cookies to understand how you use Aakd and improve your experience.{" "}
        <a
          href="https://github.com/aaked-app/aakd/blob/main/docs/analytics-privacy.md"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy and analytics information
        </a>
      </p>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={decline}>
          Decline
        </Button>
        <Button size="sm" onClick={accept}>
          Accept
        </Button>
      </div>
    </div>
  )
}
