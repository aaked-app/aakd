"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useSession, useActiveOrganization } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ─── Provider card ────────────────────────────────────────────────────────────

type Provider = "anthropic" | "openai"

function AnthropicLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.257 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017L3.674 20H0L6.57 3.52zm4.132 9.959L8.453 7.687l-2.243 5.792h4.492z" />
    </svg>
  )
}

function OpenAILogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.032.067L9.552 20.017a4.5 4.5 0 0 1-5.952-1.713zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L3.93 14.006a4.5 4.5 0 0 1-1.59-6.111zm16.55 3.864l-5.844-3.37 2.022-1.168a.08.08 0 0 1 .071 0l4.887 2.82a4.494 4.494 0 0 1-.69 8.109v-5.677a.79.79 0 0 0-.445-.714zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.356 9.24V6.908a.072.072 0 0 1 .029-.067l4.887-2.812a4.5 4.5 0 0 1 6.668 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.656 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function ProviderCard({
  provider,
  selected,
  onClick,
}: {
  provider: Provider
  selected: boolean
  onClick: () => void
}) {
  const isAnthropic = provider === "anthropic"
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-5 rounded-[var(--radius)] border-2 transition-all cursor-pointer w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <div className={cn("transition-colors", selected ? "text-primary" : "text-foreground/70")}>
        {isAnthropic ? <AnthropicLogo /> : <OpenAILogo />}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight">
          {isAnthropic ? "Anthropic" : "OpenAI"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isAnthropic ? "Claude" : "GPT-4o"}
        </p>
      </div>
    </button>
  )
}

// ─── State machine ────────────────────────────────────────────────────────────

type Status = "idle" | "testing" | "tested-ok" | "tested-fail" | "saving"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization()

  const [provider, setProvider] = useState<Provider>("anthropic")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // Role guard — only admin/legal may configure AI
  useEffect(() => {
    if (!isPending && !orgPending && activeOrg) {
      const member = (activeOrg as { members?: Array<{ userId: string; role: string }> }).members?.find(
        (m) => m.userId === session?.user?.id,
      )
      if (member && !["admin", "legal", "owner"].includes(member.role)) {
        router.replace("/dashboard")
      }
    }
  }, [isPending, orgPending, activeOrg, session, router])

  const placeholder = provider === "anthropic" ? "sk-ant-api03-..." : "sk-proj-..."

  async function handleTest() {
    if (!apiKey.trim()) return
    setStatus("testing")
    setErrorMsg("")
    try {
      const res = await fetch("/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      })
      const data = (await res.json()) as { valid: boolean; error?: string }
      if (data.valid) {
        setStatus("tested-ok")
      } else {
        setStatus("tested-fail")
        setErrorMsg(data.error ?? "Key validation failed")
      }
    } catch {
      setStatus("tested-fail")
      setErrorMsg("Network error — could not reach the validation endpoint")
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) return
    setStatus("saving")
    setErrorMsg("")
    try {
      const res = await fetch("/api/org/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus("tested-fail")
        setErrorMsg((data as { error?: string }).error ?? "Failed to save configuration")
        return
      }
      router.push("/dashboard")
    } catch {
      setStatus("tested-fail")
      setErrorMsg("Network error — could not save configuration")
    }
  }

  const isBusy = status === "testing" || status === "saving"
  const canSave = apiKey.trim().length > 0 && !isBusy

  return (
    <div className="flex min-h-screen items-start justify-center pt-16 pb-8 px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome to ClauseFlow
          </h1>
          <p className="text-sm text-muted-foreground">
            Your organization is ready. Connect an AI provider to unlock powerful contract features.
          </p>
        </div>

        {/* Feature list */}
        <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-2">
          <p className="text-sm font-medium text-foreground mb-3">Set up AI to unlock:</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {[
              "Contract extraction and Q&A",
              "Risk scoring (LOW / MEDIUM / HIGH)",
              "Obligation detection",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Provider selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">AI Provider</Label>
          <div className="grid grid-cols-2 gap-3">
            <ProviderCard
              provider="anthropic"
              selected={provider === "anthropic"}
              onClick={() => {
                setProvider("anthropic")
                setStatus("idle")
                setErrorMsg("")
              }}
            />
            <ProviderCard
              provider="openai"
              selected={provider === "openai"}
              onClick={() => {
                setProvider("openai")
                setStatus("idle")
                setErrorMsg("")
              }}
            />
          </div>
        </div>

        {/* API Key input */}
        <div className="space-y-2">
          <Label htmlFor="api-key" className="text-sm font-medium text-foreground">
            API Key
          </Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              placeholder={placeholder}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                if (status === "tested-ok" || status === "tested-fail") {
                  setStatus("idle")
                  setErrorMsg("")
                }
              }}
              className="pr-10 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Inline feedback */}
          {status === "tested-ok" && (
            <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Key is valid
            </p>
          )}
          {status === "tested-fail" && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              {errorMsg || "Key validation failed"}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={!apiKey.trim() || isBusy}
            className="min-w-[140px]"
          >
            {status === "testing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Test connection"
            )}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="min-w-[140px]"
          >
            {status === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & continue"
            )}
          </Button>
        </div>

        {/* Skip link */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Skip for now
          </Link>
        </div>

        {/* Security note */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Your key is encrypted at rest and never logged.
          You can change it anytime in{" "}
          <Link
            href="/settings/org"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Settings &rarr; Organization
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
