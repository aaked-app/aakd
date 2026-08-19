import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import OnboardingPage from "@/app/(app)/onboarding/page"

const push = vi.fn()
const replace = vi.fn()
let role = "admin"

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  }
}

const copy: Record<string, string> = {
  "provider.anthropic.subtitle": "Claude models",
  "provider.openai.subtitle": "GPT models",
  "provider.ollama.subtitle": "Local / self-hosted",
  "fields.apiKey": "API key",
  "fields.model": "Model",
  "fields.ollamaUrl": "Ollama base URL",
  "fields.ollamaModel": "Model name",
  "models.anthropic.haiku": "Claude Haiku (fastest)",
  "models.openai.mini": "GPT-4o Mini (fastest)",
  "actions.upload": "Upload a contract",
  "actions.skip": "Skip for now",
  "actions.test": "Test connection",
  "actions.save": "Save & continue",
  "actions.showKey": "Show key",
  "actions.hideKey": "Hide key",
  "feedback.success": "Connection successful",
  "feedback.failed": "Connection test failed",
  "feedback.testNetworkError": "Network error — could not reach the validation endpoint",
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => copy[key] ?? key,
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } }, isPending: false }),
  useActiveOrganization: () => ({
    data: { members: [{ userId: "user-1", role }] },
    isPending: false,
  }),
}))

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage())
    localStorage.clear()
    role = "admin"
    push.mockReset()
    replace.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("switches providers with an accessible selected state and preserves conditional actions", () => {
    render(<OnboardingPage />)

    const anthropic = screen.getByRole("button", { name: /Anthropic/i })
    const ollama = screen.getByRole("button", { name: /Ollama/i })

    expect(anthropic).toHaveAttribute("aria-pressed", "true")
    expect(ollama).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByLabelText("API key")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled()

    fireEvent.click(ollama)

    expect(ollama).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Ollama base URL")).toHaveValue("http://localhost:11434")
    expect(screen.getByLabelText("Model name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Save & continue" })).toBeDisabled()
  })

  it("announces successful and failed connection feedback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: ["claude-haiku-4-5"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: ["claude-haiku-4-5"] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: false, error: "Invalid credentials" })),
      )
    vi.stubGlobal("fetch", fetchMock)

    render(<OnboardingPage />)
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "secret" } })

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Connection successful")

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials")
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("preserves cloud defaults and exact test/save payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: ["claude-haiku-4-5"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(<OnboardingPage />)
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue("claude-haiku-4-5")
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "  secret  " } })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await screen.findByRole("status")

    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      provider: "anthropic",
      apiKey: "secret",
      model: "claude-haiku-4-5",
    })

    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toEqual({
      provider: "anthropic",
      apiKey: "secret",
      model: "claude-haiku-4-5",
    })

    fireEvent.click(screen.getByRole("button", { name: /OpenAI/i }))
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue("gpt-4o-mini")
  })

  it("preserves exact Ollama test/save payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: ["llama3.2"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(<OnboardingPage />)
    fireEvent.click(screen.getByRole("button", { name: /Ollama/i }))
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await screen.findByRole("status")
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "",
    })

    fireEvent.change(screen.getByLabelText("Model name"), { target: { value: "  llama3.2  " } })
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toEqual({
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    })
  })

  it("announces rejected requests and keeps key visibility keyboard-operable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    render(<OnboardingPage />)

    const keyInput = screen.getByLabelText("API key")
    const visibilityButton = screen.getByRole("button", { name: "Show key" })
    expect(keyInput).toHaveAttribute("type", "password")
    visibilityButton.focus()
    expect(visibilityButton).toHaveFocus()
    fireEvent.click(visibilityButton, { detail: 0 })
    expect(keyInput).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Hide key" })).toBeInTheDocument()

    fireEvent.change(keyInput, { target: { value: "secret" } })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network error — could not reach the validation endpoint",
    )
  })

  it("marks onboarding complete when uploading or skipping", () => {
    const { unmount } = render(<OnboardingPage />)

    fireEvent.click(screen.getByRole("link", { name: "Upload a contract" }))
    expect(localStorage.getItem("cf_onboarding_done")).toBe("1")

    localStorage.clear()
    unmount()
    render(<OnboardingPage />)
    fireEvent.click(screen.getByRole("link", { name: "Skip for now" }))
    expect(localStorage.getItem("cf_onboarding_done")).toBe("1")
  })

  it("keeps the existing role guard", async () => {
    role = "member"
    render(<OnboardingPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"))
  })
})
