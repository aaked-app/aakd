"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Server } from "lucide-react"
import { useSession, useActiveOrganization } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ─── Logos ────────────────────────────────────────────────────────────────────

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

// ─── Provider definitions ──────────────────────────────────────────────────────

type Provider = "anthropic" | "openai" | "ollama"

const PROVIDER_META: Record<Provider, { name: string; subtitle: string }> = {
  anthropic: { name: "Anthropic", subtitle: "Claude models" },
  openai: { name: "OpenAI", subtitle: "GPT models" },
  ollama: { name: "Ollama", subtitle: "Local / self-hosted" },
}

const CLOUD_MODELS: Record<"anthropic" | "openai", { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-haiku-4-5", label: "Claude Haiku (fastest)" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet (balanced)" },
    { value: "claude-opus-4-5", label: "Claude Opus (most capable)" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (fastest)" },
    { value: "gpt-4o", label: "GPT-4o (balanced)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo (powerful)" },
  ],
}

const DEFAULT_MODEL: Record<"anthropic" | "openai", string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
}

// ─── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  selected,
  onClick,
}: {
  provider: Provider
  selected: boolean
  onClick: () => void
}) {
  const meta = PROVIDER_META[provider]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-4 rounded-[var(--radius)] border-2 transition-all cursor-pointer w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <div className={cn("transition-colors", selected ? "text-primary" : "text-foreground/70")}>
        {provider === "anthropic" && <AnthropicLogo />}
        {provider === "openai" && <OpenAILogo />}
        {provider === "ollama" && <Server className="h-7 w-7" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight">{meta.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
      </div>
    </button>
  )
}

// ─── State machine ─────────────────────────────────────────────────────────────

type Status = "idle" | "testing" | "tested-ok" | "tested-fail" | "saving"

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization()

  const [provider, setProvider] = useState<Provider>("anthropic")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState<string>(DEFAULT_MODEL["anthropic"])
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [ollamaModel, setOllamaModel] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // Role guard — only admin/legal/owner may configure AI
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

  function switchProvider(p: Provider) {
    setProvider(p)
    setStatus("idle")
    setErrorMsg("")
    if (p !== "ollama") {
      setModel(DEFAULT_MODEL[p])
    }
  }

  function resetFeedback() {
    if (status === "tested-ok" || status === "tested-fail") {
      setStatus("idle")
      setErrorMsg("")
    }
  }

  async function handleTest() {
    setStatus("testing")
    setErrorMsg("")
    try {
      const body =
        provider === "ollama"
          ? { provider, baseUrl: ollamaUrl.trim() }
          : { provider, apiKey: apiKey.trim() }

      const res = await fetch("/api/org/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { valid: boolean; error?: string }
      if (data.valid) {
        setStatus("tested-ok")
      } else {
        setStatus("tested-fail")
        setErrorMsg(data.error ?? "Connection test failed")
      }
    } catch {
      setStatus("tested-fail")
      setErrorMsg("Network error — could not reach the validation endpoint")
    }
  }

  async function handleSave() {
    setStatus("saving")
    setErrorMsg("")
    try {
      const body =
        provider === "ollama"
          ? { provider, baseUrl: ollamaUrl.trim(), model: ollamaModel.trim() }
          : { provider, apiKey: apiKey.trim(), model }

      const res = await fetch("/api/org/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  // Readiness checks per provider
  const isOllamaReady = ollamaUrl.trim().length > 0 && ollamaModel.trim().length > 0
  const isCloudReady = apiKey.trim().length > 0
  const canTest = !isBusy && (provider === "ollama" ? ollamaUrl.trim().length > 0 : isCloudReady)
  const canSave = !isBusy && (provider === "ollama" ? isOllamaReady : isCloudReady)

  const apiKeyPlaceholder = provider === "anthropic" ? "sk-ant-api03-..." : "sk-proj-..."

  return (
    <div className="flex min-h-screen items-start justify-center pt-16 pb-8 px-4">
      <div className="w-full max-w-lg space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome to Aakd
          </h1>
          <p className="text-sm text-muted-foreground">
            Your organisation is ready. Connect an AI provider to unlock powerful contract features.
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

        {/* Provider selector — 3-column grid */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">AI Provider</Label>
          <div className="grid grid-cols-3 gap-3">
            {(["anthropic", "openai", "ollama"] as Provider[]).map((p) => (
              <ProviderCard
                key={p}
                provider={p}
                selected={provider === p}
                onClick={() => switchProvider(p)}
              />
            ))}
          </div>
        </div>

        {/* Ollama-specific fields */}
        {provider === "ollama" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ollama-url" className="text-sm font-medium text-foreground">
                Ollama base URL
              </Label>
              <Input
                id="ollama-url"
                type="url"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => { setOllamaUrl(e.target.value); resetFeedback() }}
                className="font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Default is <code className="font-mono">http://localhost:11434</code>. Change this
                if Ollama runs on a different host or port.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ollama-model" className="text-sm font-medium text-foreground">
                Model name
              </Label>
              <Input
                id="ollama-model"
                type="text"
                placeholder="llama3.2, mistral, mxbai-embed-large, ..."
                value={ollamaModel}
                onChange={(e) => { setOllamaModel(e.target.value); resetFeedback() }}
                className="font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Enter any model you have pulled locally with{" "}
                <code className="font-mono">ollama pull &lt;model&gt;</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cloud model selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Model</Label>
              <Select
                value={model}
                onValueChange={(v) => { if (v) { setModel(v); resetFeedback() } }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {CLOUD_MODELS[provider as "anthropic" | "openai"].map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  placeholder={apiKeyPlaceholder}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); resetFeedback() }}
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
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline feedback */}
        {status === "tested-ok" && (
          <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Connection successful
          </p>
        )}
        {status === "tested-fail" && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {errorMsg || "Connection test failed"}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={!canTest}
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
          {provider === "ollama"
            ? "Your Ollama URL is encrypted at rest. No data leaves your server."
            : "Your key is encrypted at rest and never logged."}{" "}
          You can change it anytime in{" "}
          <Link
            href="/settings/org"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Settings &rarr; Organisation
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
