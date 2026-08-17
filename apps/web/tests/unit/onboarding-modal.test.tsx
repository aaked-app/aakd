import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { OnboardingModal } from "@/components/onboarding-modal"

let pathname = "/dashboard"

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
  "steps.welcome.title": "Welcome to Aakd",
  "steps.welcome.description": "Let's set up your workspace. This only takes a minute.",
  "steps.contract.title": "Create your first contract",
  "steps.contract.description": "Start from scratch, use a template, or create with AI assistance.",
  "steps.tools.title": "Connect your tools",
  "steps.tools.description": "Link your CRM, e-signature, and storage providers.",
  "steps.team.title": "Invite your team",
  "steps.team.description": "Add team members and assign roles to collaborate effectively.",
  "actions.skip": "Skip",
  "actions.next": "Next",
  "actions.getStarted": "Get started",
  progress: "Step {current} of {total}",
}

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const value = copy[key] ?? key
    if (!values) return value
    return Object.entries(values).reduce(
      (result, [name, replacement]) => result.replace(`{${name}}`, String(replacement)),
      value,
    )
  },
}))

describe("OnboardingModal", () => {
  beforeEach(() => {
    pathname = "/dashboard"
    vi.stubGlobal("localStorage", memoryStorage())
    localStorage.clear()
  })

  it("preserves all four steps and stores completion on get started", async () => {
    render(<OnboardingModal />)

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Welcome to Aakd" })).toBeInTheDocument()
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("heading", { name: "Create your first contract" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("heading", { name: "Connect your tools" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("heading", { name: "Invite your team" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Get started" }))
    expect(localStorage.getItem("cf_onboarding_done")).toBe("1")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("stores completion when skipped", async () => {
    render(<OnboardingModal />)

    fireEvent.click(await screen.findByRole("button", { name: "Skip" }))
    expect(localStorage.getItem("cf_onboarding_done")).toBe("1")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("stays suppressed on the onboarding path and when completion is stored", async () => {
    pathname = "/onboarding"
    const { rerender } = render(<OnboardingModal />)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    pathname = "/dashboard"
    localStorage.setItem("cf_onboarding_done", "1")
    rerender(<OnboardingModal />)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
