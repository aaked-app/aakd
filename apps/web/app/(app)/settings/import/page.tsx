"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { CsvImportTab } from "@/components/import/csv-import-tab"
import { BatchImportTab } from "@/components/import/batch-import-tab"
import { GoogleDriveTab } from "@/components/import/gdrive-tab"
import { PandaDocTab } from "@/components/import/pandadoc-tab"
import { ClmExportTab } from "@/components/import/clm-export-tab"
import { ImportHistory } from "@/components/import/import-history"
import { useTranslations } from "next-intl"
import { useActiveOrganization, useSession } from "@/lib/auth/client"
import { Skeleton } from "@/components/ui/skeleton"

const VALID_TABS = new Set(["csv", "batch", "gdrive", "pandadoc", "clm"])
const DRIVE_ERRORS = new Set(["not_configured", "unauthenticated", "forbidden", "missing_params", "state_mismatch", "exchange_failed", "missing_refresh_token"])

function ImportPageBody() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab")
  const defaultTab = initialTab && VALID_TABS.has(initialTab) ? initialTab : "csv"
  const t = useTranslations("import")
  const { data: session, isPending: sessionPending } = useSession()
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization()
  const currentRole = activeOrg?.members?.find((member) => member.userId === session?.user?.id)?.role as string | undefined
  const roleLoading = sessionPending || orgPending || !currentRole
  const isViewer = (currentRole as string | undefined) === "viewer"
  const canManageDrive = currentRole === "owner" || currentRole === "admin"

  const [historyKey, setHistoryKey] = useState(0)
  const [tab, setTab] = useState(defaultTab)
  const refreshHistory = () => setHistoryKey((k) => k + 1)

  useEffect(() => {
    if (roleLoading || isViewer) return
    if (searchParams.get("connected") === "true") {
      toast.success(t("driveConnected"))
    }
    const err = searchParams.get("error")
    if (err) {
      const safeError = DRIVE_ERRORS.has(err) ? err : "unknown"
      toast.error(t(`driveErrors.${safeError}`))
    }
  }, [isViewer, roleLoading, searchParams, t])

  if (roleLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6 lg:px-8" aria-label={t("loadingPermissions")}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  if (isViewer) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <div role="alert" className="mt-5 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          {t("viewerDenied")}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3" aria-label={t("sequence.label")}>
        {["choose", "review", "monitor"].map((step, index) => (
          <li key={step} className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-semibold text-primary">{index + 1}</span>
            <p className="mt-1 text-sm font-medium text-foreground">{t(`sequence.${step}.title`)}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(`sequence.${step}.body`)}</p>
          </li>
        ))}
      </ol>

      <Tabs value={tab} onValueChange={setTab}>
        <label className="block md:hidden">
          <span className="sr-only">{t("sourceSelector")}</span>
          <select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={tab} onChange={(event) => setTab(event.target.value)}>
            {["csv", "batch", "gdrive", "pandadoc", "clm"].map((value) => <option key={value} value={value}>{t(`tabs.${value}`)}</option>)}
          </select>
        </label>
        <TabsList className="hidden h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/60 p-1 md:flex">
          <TabsTrigger value="csv">{t("tabs.csv")}</TabsTrigger>
          <TabsTrigger value="batch">{t("tabs.batch")}</TabsTrigger>
          <TabsTrigger value="gdrive">{t("tabs.gdrive")}</TabsTrigger>
          <TabsTrigger value="pandadoc">{t("tabs.pandadoc")}</TabsTrigger>
          <TabsTrigger value="clm">{t("tabs.clm")}</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <CsvImportTab onJobCreated={refreshHistory} />
          </div>
        </TabsContent>

        <TabsContent value="batch" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <BatchImportTab onJobCreated={refreshHistory} />
          </div>
        </TabsContent>

        <TabsContent value="gdrive" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <GoogleDriveTab onJobCreated={refreshHistory} canManageConnection={canManageDrive} />
          </div>
        </TabsContent>

        <TabsContent value="pandadoc" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <PandaDocTab onJobCreated={refreshHistory} />
          </div>
        </TabsContent>

        <TabsContent value="clm" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <ClmExportTab onJobCreated={refreshHistory} />
          </div>
        </TabsContent>
      </Tabs>

      <ImportHistory refreshKey={historyKey} />
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportPageBody />
    </Suspense>
  )
}
