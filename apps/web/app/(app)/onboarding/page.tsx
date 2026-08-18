"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Server, FileUp, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useSession, useActiveOrganization } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const PROVIDER_META: Record<Provider, { name: string; subtitleKey: string }> = {
  anthropic: { name: "Anthropic", subtitleKey: "provider.anthropic.subtitle" },
  openai: { name: "OpenAI", subtitleKey: "provider.openai.subtitle" },
  ollama: { name: "Ollama", subtitleKey: "provider.ollama.subtitle" },
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
  subtitle,
}: {
  provider: Provider
  selected: boolean
  onClick: () => void
  subtitle: string
}) {
  const meta = PROVIDER_META[provider]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-20 w-full items-center gap-3 rounded-[var(--radius)] border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[480px]:min-h-28 min-[480px]:flex-col min-[480px]:justify-center min-[480px]:text-center",
        selected
          ? "border-primary bg-primary/5 text-primary shadow-sm"
          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <div className={cn("transition-colors", selected ? "text-primary" : "text-foreground/70")}>
        {provider === "anthropic" && <AnthropicLogo />}
        {provider === "openai" && <OpenAILogo />}
        {provider === "ollama" && <Server className="h-7 w-7" />}
      </div>
      <div className="min-w-0 min-[480px]:text-center">
        <p className="text-sm font-semibold leading-tight">{meta.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  )
}

// ─── State machine ─────────────────────────────────────────────────────────────

type Status = "idle" | "testing" | "tested-ok" | "tested-fail" | "saving"

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const t = useTranslations("onboarding")
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
  const [availableModels, setAvailableModels] = useState<string[]>([])

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
      setAvailableModels([])
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
          ? { provider, baseUrl: ollamaUrl.trim(), model: ollamaModel.trim() }
          : { provider, apiKey: apiKey.trim(), model: model.trim() }

      const modelsResponse = await fetch("/api/org/ai-config/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider === "ollama"
          ? { provider, baseUrl: ollamaUrl.trim() }
          : { provider, apiKey: apiKey.trim() }),
      })
      if (modelsResponse.ok) {
        const modelsData = (await modelsResponse.json()) as { models?: string[] }
        setAvailableModels(modelsData.models ?? [])
      }

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
        setErrorMsg(data.error ?? t("feedback.failed"))
      }
    } catch {
      setStatus("tested-fail")
      setErrorMsg(t("feedback.testNetworkError"))
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
        setErrorMsg((data as { error?: string }).error ?? t("feedback.saveFailed"))
        return
      }
      router.push("/dashboard")
    } catch {
      setStatus("tested-fail")
      setErrorMsg(t("feedback.saveNetworkError"))
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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:py-14">
      <header className="max-w-2xl space-y-2">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <section
          aria-labelledby="first-contract-title"
          className="min-w-0 rounded-xl border border-primary/25 bg-primary/5 p-5 shadow-sm sm:p-6"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-2">
            <h2 id="first-contract-title" className="text-lg font-semibold text-foreground">
              {t("firstContract.title")}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("firstContract.description")}
            </p>
          </div>
          <Link
            href="/contracts/new"
            onClick={() => localStorage.setItem("cf_onboarding_done", "1")}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
          >
            {t("actions.upload")}
          </Link>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t("firstContract.formats")}
          </p>
        </section>

        <section
          aria-labelledby="ai-setup-title"
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="ai-setup-title" className="text-lg font-semibold text-foreground">
                  {t("ai.title")}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {t("ai.optional")}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("ai.description")}
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            {["extraction", "risk", "obligations"].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t(`ai.features.${feature}`)}</span>
              </li>
            ))}
          </ul>

          <div className="my-6 border-t border-border" />

          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-foreground">{t("provider.legend")}</legend>
            <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
              {(["anthropic", "openai", "ollama"] as Provider[]).map((p) => (
                <ProviderCard
                  key={p}
                  provider={p}
                  selected={provider === p}
                  subtitle={t(PROVIDER_META[p].subtitleKey)}
                  onClick={() => switchProvider(p)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-6 min-w-0">
            {provider === "ollama" ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ollama-url">{t("fields.ollamaUrl")}</Label>
                  <Input
                    id="ollama-url"
                    type="url"
                    placeholder="http://localhost:11434"
                    value={ollamaUrl}
                    onChange={(e) => { setOllamaUrl(e.target.value); resetFeedback() }}
                    className="h-11 min-w-0 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="break-words text-xs leading-5 text-muted-foreground">
                    {t("fields.ollamaUrlHelp")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ollama-model">{t("fields.ollamaModel")}</Label>
                  <Input
                    id="ollama-model"
                    type="text"
                    placeholder="llama3.2, mistral, mxbai-embed-large, ..."
                    value={ollamaModel}
                    onChange={(e) => { setOllamaModel(e.target.value); resetFeedback() }}
                    className="h-11 min-w-0 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="break-words text-xs leading-5 text-muted-foreground">
                    {t("fields.ollamaModelHelp")} <code className="font-mono">ollama pull &lt;model&gt;</code>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ai-model">{t("fields.model")}</Label>
                  <Input
                    id="ai-model"
                    type="text"
                    value={model}
                    onChange={(e) => { setModel(e.target.value); resetFeedback() }}
                    list="available-ai-models"
                    className="h-11 w-full min-w-0 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <datalist id="available-ai-models">
                    {availableModels.map((item) => <option key={item} value={item} />)}
                  </datalist>
                  <p className="break-words text-xs leading-5 text-muted-foreground">
                    {t("fields.modelHelp")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-key">{t("fields.apiKey")}</Label>
                  <div className="relative min-w-0">
                    <Input
                      id="api-key"
                      type={showKey ? "text" : "password"}
                      placeholder={apiKeyPlaceholder}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); resetFeedback() }}
                      className="h-11 min-w-0 pe-11 font-mono text-sm"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="absolute end-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setShowKey((value) => !value)}
                      aria-label={showKey ? t("actions.hideKey") : t("actions.showKey")}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {status === "tested-ok" && (
            <p role="status" aria-live="polite" className="mt-5 flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t("feedback.success")}
            </p>
          )}
          {status === "tested-fail" && (
            <p role="alert" aria-live="assertive" className="mt-5 flex items-start gap-2 break-words text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg || t("feedback.failed")}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!canTest}
              className="h-11 w-full sm:w-auto sm:min-w-36"
            >
              {status === "testing" ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("actions.testing")}
                </>
              ) : t("actions.test")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="h-11 w-full sm:w-auto sm:min-w-36"
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("actions.saving")}
                </>
              ) : t("actions.save")}
            </Button>
          </div>

          <p className="mt-5 break-words text-xs leading-5 text-muted-foreground">
            {provider === "ollama" ? t("security.ollama") : t("security.cloud")} {t("security.changePrefix")}{" "}
            <Link href="/settings/org" className="font-medium underline underline-offset-4 hover:text-foreground">
              {t("security.settingsLink")}
            </Link>
            {t("security.suffix")}
          </p>
        </section>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/dashboard"
          onClick={() => localStorage.setItem("cf_onboarding_done", "1")}
          className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("actions.skip")}
        </Link>
      </div>
    </main>
  )
}
