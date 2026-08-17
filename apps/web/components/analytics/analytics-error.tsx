"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function AnalyticsError() {
  const router = useRouter()
  const t = useTranslations("analytics")
  const [retrying, setRetrying] = useState(false)

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="max-w-md rounded-[var(--radius)] border border-border bg-card p-6 text-center">
        <h2 className="text-base font-semibold">{t("loadErrorTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("failedToLoad")}</p>
        <button
          type="button"
          onClick={() => {
            setRetrying(true)
            router.refresh()
          }}
          disabled={retrying}
          className="mt-5 min-h-11 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  )
}
