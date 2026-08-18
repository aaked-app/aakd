"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { ImageIcon, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveOrganization, useSession, organization } from "@/lib/auth/client"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "@/lib/utils"

type AIStatus = {
  provider: string | null
  model: string | null
  hasKey?: boolean
  source?: "org" | "env" | null
}

type AiConfigStatus = "idle" | "testing" | "tested-ok" | "tested-fail" | "saving"

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama (self-hosted)",
}

const DEFAULT_AI_MODELS = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
} as const

const TIMEZONES = [
  { value: "UTC", key: "utc" },
  { value: "America/New_York", key: "eastern" },
  { value: "America/Los_Angeles", key: "pacific" },
  { value: "Europe/Paris", key: "centralEuropean" },
  { value: "Asia/Kolkata", key: "india" },
  { value: "Asia/Tokyo", key: "japan" },
  { value: "Australia/Sydney", key: "australiaEastern" },
]

const INDUSTRIES = [
  { value: "Technology", key: "technology" },
  { value: "Healthcare", key: "healthcare" },
  { value: "Finance", key: "finance" },
  { value: "Legal", key: "legal" },
  { value: "Manufacturing", key: "manufacturing" },
  { value: "Retail", key: "retail" },
  { value: "Other", key: "other" },
]

export default function OrgSettingsPage() {
  const { data: activeOrg } = useActiveOrganization()
  const { data: session } = useSession()
  const t = useTranslations("org")
  const locale = useLocale()
  const currentRole = activeOrg?.members?.find((member) => member.userId === session?.user?.id)?.role
  const canManageOrg = currentRole === "owner" || currentRole === "admin"
  const canManageAi = canManageOrg || String(currentRole) === "legal"
  const canTestAi = canManageOrg
  const [name, setName] = useState("")
  const [domain, setDomain] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [industry, setIndustry] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [persistedLogoUrl, setPersistedLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI config inline edit state
  const [showAiForm, setShowAiForm] = useState(false)
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai">("anthropic")
  const [aiModel, setAiModel] = useState<string>(DEFAULT_AI_MODELS.anthropic)
  const [aiApiKey, setAiApiKey] = useState("")
  const [showAiKey, setShowAiKey] = useState(false)
  const [aiConfigStatus, setAiConfigStatus] = useState<AiConfigStatus>("idle")
  const [aiConfigError, setAiConfigError] = useState("")
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [orgLoadFailed, setOrgLoadFailed] = useState(false)

  useEffect(() => {
    if (activeOrg?.name) setName(activeOrg.name)
  }, [activeOrg])

  const loadOrganization = useCallback(async () => {
    setOrgLoadFailed(false)
    try {
      const response = await fetch("/api/org")
      if (!response.ok) throw new Error("organization_unavailable")
      const data = await response.json() as { name?: string; meta?: Record<string, unknown>; logo?: string | null }
      if (data.name) setName(data.name)
      if (data.meta?.domain) setDomain(data.meta.domain as string)
      if (data.meta?.timezone) setTimezone(data.meta.timezone as string)
      if (data.meta?.industry) setIndustry(data.meta.industry as string)
      const persistedLogo = data.logo ?? null
      setLogoUrl(persistedLogo)
      setPersistedLogoUrl(persistedLogo)
    } catch {
      setOrgLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((data: AIStatus) => setAiStatus(data))
      .catch(() => setAiStatus({ provider: null, model: null }))
  }, [])

  async function handleLogoFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("logoTooLarge"))
      return
    }
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/org/logo", { method: "POST", body: form })
      if (!res.ok) {
        toast.error(t("logoUploadFailed"))
        return
      }
      const data = (await res.json()) as { url: string }
      setLogoUrl(data.url)
    } catch {
      toast.error(t("logoUploadFailed"))
    } finally {
      setLogoUploading(false)
    }
  }

  function handleLogoDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleLogoFile(file)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canManageOrg) return
    setSaving(true)
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, timezone, industry, logo: logoUrl }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setPersistedLogoUrl(logoUrl)
      toast.success(t("orgUpdated"))
      if (activeOrg?.id) {
        await organization.setActive({ organizationId: activeOrg.id }).catch(() => {})
      }
    } catch {
      setLogoUrl(persistedLogoUrl)
      toast.error(t("failedToUpdate"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {orgLoadFailed ? (
        <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
          <p>{t("loadFailed")}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void loadOrganization()}>{t("retry")}</Button>
        </section>
      ) : null}

      {/* General Information card */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t("generalInfo")}</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-sm font-medium text-foreground">
                {t("orgName")}
              </Label>
              <Input
                id="orgName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManageOrg}
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgDomain" className="text-sm font-medium text-foreground">
                {t("domain")}
              </Label>
              <Input
                id="orgDomain"
                placeholder={t("domainPlaceholder")}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!canManageOrg}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgTimezone" className="text-sm font-medium text-foreground">
                {t("timezone")}
              </Label>
              <select
                id="orgTimezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!canManageOrg}
                className="flex min-h-11 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{t(`timezones.${tz.key}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgIndustry" className="text-sm font-medium text-foreground">
                {t("industry")}
              </Label>
              <select
                id="orgIndustry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={!canManageOrg}
                className="flex min-h-11 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{t("selectIndustry")}</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>{t(`industries.${ind.key}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {activeOrg?.createdAt && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">{t("created")}</Label>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(activeOrg.createdAt))}
              </p>
            </div>
          )}

          {canManageOrg && <div className="border-t border-border pt-4 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </div>}
        </form>
      </div>

      {/* Organization Logo card */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t("orgLogo")}</h2>
        {logoUrl ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={t("logoAlt")}
              className="h-16 w-16 rounded-[var(--radius)] object-cover border border-border"
            />
            {canManageOrg && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogoUrl(null)}
              >
                {t("remove")}
              </Button>
            )}
          </div>
        ) : canManageOrg ? (
          <div
            className={`border-2 border-dashed border-border rounded-[var(--radius)] p-8 flex flex-col items-center justify-center gap-2 transition-colors ${logoUploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40"}`}
            role="button"
            tabIndex={logoUploading ? -1 : 0}
            aria-disabled={logoUploading}
            onClick={() => !logoUploading && fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (!logoUploading && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { if (!logoUploading) handleLogoDrop(e) }}
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground font-medium">
              {logoUploading ? t("uploading") : t("clickToUpload")}
            </p>
            <p className="text-xs text-muted-foreground">{t("logoFormats")}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoFile(file)
              }}
            />
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-8 text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t("logoReadOnly")}</p>
          </div>
        )}
      </div>

      {/* AI Configuration */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t("aiConfig")}</h2>

        {aiStatus === null ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : aiStatus.hasKey && aiStatus.source === "env" ? (
          /* Server default — read-only */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">{t("provider")}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                {PROVIDER_LABELS[aiStatus.provider ?? ""] ?? t("unknownProvider")}
                <span className="ms-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t("serverDefault")}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">{t("model")}</span>
              {aiStatus.model ? (
                <span className="text-sm font-mono text-foreground">{aiStatus.model}</span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {t("serverDefaultDescription")}
            </p>
            {canManageAi && !showAiForm && (
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => { setAiProvider((aiStatus.provider === "openai" ? "openai" : "anthropic")); setAiModel(aiStatus.model ?? DEFAULT_AI_MODELS[aiStatus.provider === "openai" ? "openai" : "anthropic"]); setShowAiForm(true) }}>
                {t("setOrgKey")}
              </Button>
            )}
          </div>
        ) : aiStatus.hasKey && aiStatus.source === "org" ? (
          /* Org BYOK key configured */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">{t("provider")}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                {PROVIDER_LABELS[aiStatus.provider ?? ""] ?? t("unknownProvider")}
                <span className="ms-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t("connected")}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">{t("model")}</span>
              {aiStatus.model ? (
                <span className="text-sm font-mono text-foreground">{aiStatus.model}</span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            {canManageAi && !showAiForm && !showRemoveConfirm && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => { setAiProvider((aiStatus.provider === "openai" ? "openai" : "anthropic")); setAiModel(aiStatus.model ?? DEFAULT_AI_MODELS[aiStatus.provider === "openai" ? "openai" : "anthropic"]); setShowAiForm(true) }}>{t("change")}</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                  onClick={() => setShowRemoveConfirm(true)}
                >
                  {t("remove")}
                </Button>
              </div>
            )}
            {canManageAi && showRemoveConfirm && (
              <div className="flex items-center gap-3 pt-1">
                <p className="text-sm text-muted-foreground">{t("removeAiKeyPrompt")}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/org/ai-config", { method: "DELETE" })
                      if (!res.ok) throw new Error("Failed to remove AI key")
                      setShowRemoveConfirm(false)
                      setAiStatus({ provider: null, model: null, hasKey: false, source: null })
                      toast.success(t("aiKeyRemoved"))
                    } catch {
                      toast.error(t("aiRemoveFailed"))
                    }
                  }}
                >
                  {t("confirm")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowRemoveConfirm(false)}>
                  {t("cancel")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Not configured */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">{t("provider")}</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-border" />
                {t("notConfigured")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("noAiConfigured")}{" "}
              {canManageAi && <>
                {" "}<Link href="/onboarding" className="underline underline-offset-4 hover:text-foreground transition-colors">
                  {t("setupAi")}
                </Link>.
              </>}
            </p>
            {canManageAi && !showAiForm && (
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => { setAiModel(DEFAULT_AI_MODELS[aiProvider]); setShowAiForm(true) }}>
                {t("setupAi")}
              </Button>
            )}
          </div>
        )}

        {/* Inline form — shared by Change / Set up */}
        {canManageAi && showAiForm && (
          <div className="mt-5 pt-5 border-t border-border space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("provider")}</Label>
              <div className="flex gap-2">
                {(["anthropic", "openai"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setAiProvider(p); setAiConfigStatus("idle"); setAiConfigError("") }}
                    className={cn(
                      "min-h-11 flex-1 py-2 px-3 rounded-[calc(var(--radius)-1px)] border text-sm font-medium transition-all",
                      aiProvider === p
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-foreground/70 hover:border-primary/40",
                    )}
                  >
                    {p === "anthropic" ? "Anthropic / Claude" : "OpenAI / GPT-4o"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model-settings" className="text-sm font-medium">{t("model")}</Label>
              <Input
                id="ai-model-settings"
                value={aiModel}
                onChange={(e) => { setAiModel(e.target.value); setAiConfigStatus("idle"); setAiConfigError("") }}
                placeholder={DEFAULT_AI_MODELS[aiProvider]}
                className="min-h-11 font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">{t("aiModelHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-key-settings" className="text-sm font-medium">{t("apiKey")}</Label>
              <div className="relative">
                <Input
                  id="ai-key-settings"
                  type={showAiKey ? "text" : "password"}
                  placeholder={aiProvider === "anthropic" ? "sk-ant-api03-..." : "sk-proj-..."}
                  value={aiApiKey}
                  onChange={(e) => {
                    setAiApiKey(e.target.value)
                    if (aiConfigStatus === "tested-ok" || aiConfigStatus === "tested-fail") {
                      setAiConfigStatus("idle")
                      setAiConfigError("")
                    }
                  }}
                  className="min-h-11 pe-11 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="absolute end-0 top-1/2 min-h-11 min-w-11 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showAiKey ? t("hideApiKey") : t("showApiKey")}
                  onClick={() => setShowAiKey((v) => !v)}
                >
                  {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {aiConfigStatus === "tested-ok" && (
                <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> {t("keyValid")}
                </p>
              )}
              {aiConfigStatus === "tested-fail" && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" /> {aiConfigError || t("validationFailed")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canTestAi && <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!aiApiKey.trim() || aiConfigStatus === "testing" || aiConfigStatus === "saving"}
                onClick={async () => {
                  setAiConfigStatus("testing")
                  setAiConfigError("")
                  try {
                    const res = await fetch("/api/org/ai-config/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey.trim(), model: aiModel.trim() }),
                    })
                    const data = (await res.json()) as { valid: boolean; error?: string }
                    setAiConfigStatus(data.valid ? "tested-ok" : "tested-fail")
                    if (!data.valid) setAiConfigError(data.error === "Invalid API key" ? t("invalidApiKey") : (data.error ?? t("validationFailed")))
                  } catch {
                    setAiConfigStatus("tested-fail")
                    setAiConfigError(t("networkError"))
                  }
                }}
              >
                {aiConfigStatus === "testing" ? (
                  <><Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> {t("testing")}</>
                ) : t("test")}
              </Button>}
              <Button
                type="button"
                size="sm"
                disabled={!aiApiKey.trim() || aiConfigStatus === "testing" || aiConfigStatus === "saving"}
                onClick={async () => {
                  setAiConfigStatus("saving")
                  try {
                    const res = await fetch("/api/org/ai-config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey.trim(), model: aiModel.trim() }),
                    })
                    if (!res.ok) throw new Error("Save failed")
                    const data = (await res.json()) as { provider: string; model: string | null }
                    setAiStatus({ provider: data.provider, model: data.model, hasKey: true, source: "org" })
                    setShowAiForm(false)
                    setAiApiKey("")
                    setAiConfigStatus("idle")
                    toast.success(t("aiKeySaved"))
                  } catch {
                    setAiConfigStatus("tested-fail")
                    setAiConfigError(t("aiSaveFailed"))
                  }
                }}
              >
                {aiConfigStatus === "saving" ? (
                  <><Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> {t("saving")}</>
                ) : t("save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAiForm(false)
                  setAiApiKey("")
                  setAiConfigStatus("idle")
                  setAiConfigError("")
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
