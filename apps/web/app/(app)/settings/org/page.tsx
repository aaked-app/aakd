"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ImageIcon, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveOrganization, organization } from "@/lib/auth/client"
import { useTranslations } from "next-intl"
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

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "EST — Eastern" },
  { value: "America/Los_Angeles", label: "PST — Pacific" },
  { value: "Europe/Paris", label: "CET — Central European" },
  { value: "Asia/Kolkata", label: "IST — India" },
  { value: "Asia/Tokyo", label: "JST — Japan" },
  { value: "Australia/Sydney", label: "AEST — Australia Eastern" },
]

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Legal",
  "Manufacturing",
  "Retail",
  "Other",
]

export default function OrgSettingsPage() {
  const { data: activeOrg } = useActiveOrganization()
  const t = useTranslations("org")
  const [name, setName] = useState("")
  const [domain, setDomain] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [industry, setIndustry] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI config inline edit state
  const [showAiForm, setShowAiForm] = useState(false)
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai">("anthropic")
  const [aiApiKey, setAiApiKey] = useState("")
  const [showAiKey, setShowAiKey] = useState(false)
  const [aiConfigStatus, setAiConfigStatus] = useState<AiConfigStatus>("idle")
  const [aiConfigError, setAiConfigError] = useState("")
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  useEffect(() => {
    if (activeOrg?.name) setName(activeOrg.name)
  }, [activeOrg])

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data: { name?: string; meta?: Record<string, unknown>; logo?: string | null }) => {
        if (data.name) setName(data.name)
        if (data.meta?.domain) setDomain(data.meta.domain as string)
        if (data.meta?.timezone) setTimezone(data.meta.timezone as string)
        if (data.meta?.industry) setIndustry(data.meta.industry as string)
        if (data.logo) setLogoUrl(data.logo)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((data: AIStatus) => setAiStatus(data))
      .catch(() => setAiStatus({ provider: null, model: null }))
  }, [])

  async function handleLogoFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB")
      return
    }
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/org/logo", { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? "Failed to upload logo")
        return
      }
      const data = (await res.json()) as { url: string }
      setLogoUrl(data.url)
    } catch {
      toast.error("Failed to upload logo")
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
    setSaving(true)
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, timezone, industry, logo: logoUrl }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success(t("orgUpdated"))
      if (activeOrg?.id) {
        await organization.setActive({ organizationId: activeOrg.id }).catch(() => {})
      }
    } catch {
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

      {/* General Information card */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t("generalInfo")}</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-sm font-medium text-foreground">
                {t("orgName")}
              </Label>
              <Input
                id="orgName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgDomain" className="text-sm font-medium text-foreground">
                {t("domain")}
              </Label>
              <Input
                id="orgDomain"
                placeholder="yourcompany.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
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
                className="flex h-9 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
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
                className="flex h-9 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{t("selectIndustry")}</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
          </div>

          {activeOrg?.createdAt && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">{t("created")}</Label>
              <p className="text-sm text-muted-foreground">
                {format(new Date(activeOrg.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
          )}

          <div className="border-t border-border pt-4 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </div>
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
              alt="Organization logo"
              className="h-16 w-16 rounded-[var(--radius)] object-cover border border-border"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoUrl(null)}
            >
              {t("remove")}
            </Button>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed border-border rounded-[var(--radius)] p-8 flex flex-col items-center justify-center gap-2 transition-colors ${logoUploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40"}`}
            onClick={() => !logoUploading && fileInputRef.current?.click()}
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
                {PROVIDER_LABELS[aiStatus.provider ?? ""] ?? aiStatus.provider}
                <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Server default</span>
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
              Using server-level AI credentials. You can override with your own key below.
            </p>
            {!showAiForm && (
              <Button variant="outline" size="sm" onClick={() => setShowAiForm(true)}>
                Set org key
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
                {PROVIDER_LABELS[aiStatus.provider ?? ""] ?? aiStatus.provider}
                <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Connected</span>
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
            {!showAiForm && !showRemoveConfirm && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowAiForm(true)}>Change</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                  onClick={() => setShowRemoveConfirm(true)}
                >
                  Remove
                </Button>
              </div>
            )}
            {showRemoveConfirm && (
              <div className="flex items-center gap-3 pt-1">
                <p className="text-sm text-muted-foreground">Remove your org AI key?</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await fetch("/api/org/ai-config", { method: "DELETE" })
                    setShowRemoveConfirm(false)
                    setAiStatus({ provider: null, model: null, hasKey: false, source: null })
                    toast.success("AI key removed")
                  }}
                >
                  Confirm
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowRemoveConfirm(false)}>
                  Cancel
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
              No AI key configured — AI features are disabled.{" "}
              <Link href="/onboarding" className="underline underline-offset-4 hover:text-foreground transition-colors">
                Set up AI
              </Link>
              .
            </p>
            {!showAiForm && (
              <Button variant="outline" size="sm" onClick={() => setShowAiForm(true)}>
                Set up AI
              </Button>
            )}
          </div>
        )}

        {/* Inline form — shared by Change / Set up */}
        {showAiForm && (
          <div className="mt-5 pt-5 border-t border-border space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Provider</Label>
              <div className="flex gap-2">
                {(["anthropic", "openai"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setAiProvider(p); setAiConfigStatus("idle"); setAiConfigError("") }}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-[calc(var(--radius)-1px)] border text-sm font-medium transition-all",
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
              <Label htmlFor="ai-key-settings" className="text-sm font-medium">API Key</Label>
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
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAiKey((v) => !v)}
                >
                  {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {aiConfigStatus === "tested-ok" && (
                <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Key is valid
                </p>
              )}
              {aiConfigStatus === "tested-fail" && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" /> {aiConfigError || "Validation failed"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
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
                      body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey.trim() }),
                    })
                    const data = (await res.json()) as { valid: boolean; error?: string }
                    setAiConfigStatus(data.valid ? "tested-ok" : "tested-fail")
                    if (!data.valid) setAiConfigError(data.error ?? "Validation failed")
                  } catch {
                    setAiConfigStatus("tested-fail")
                    setAiConfigError("Network error")
                  }
                }}
              >
                {aiConfigStatus === "testing" ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Testing...</>
                ) : "Test"}
              </Button>
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
                      body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey.trim() }),
                    })
                    if (!res.ok) throw new Error("Save failed")
                    const data = (await res.json()) as { provider: string; model: string | null }
                    setAiStatus({ provider: data.provider, model: data.model, hasKey: true, source: "org" })
                    setShowAiForm(false)
                    setAiApiKey("")
                    setAiConfigStatus("idle")
                    toast.success("AI key saved")
                  } catch {
                    setAiConfigStatus("tested-fail")
                    setAiConfigError("Failed to save")
                  }
                }}
              >
                {aiConfigStatus === "saving" ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
                ) : "Save"}
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
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
