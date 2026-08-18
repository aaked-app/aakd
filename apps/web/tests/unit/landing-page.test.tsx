import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import LandingPage, * as LandingModule from "@/app/page"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

function getMessage(messages: Record<string, unknown>, key: string): string {
  const value = key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, messages.landing)

  return typeof value === "string" ? value : key
}

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => getMessage(en as Record<string, unknown>, key),
}))

describe("LandingPage", () => {
  it("makes the CLM category and governed operating model explicit", () => {
    render(<LandingPage />)

    expect(screen.getByRole("banner")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Run your contract lifecycle with evidence, ownership, and control.",
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByText("Open-source contract lifecycle management")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Bring agreements into one self-hosted workspace. Review cited contract intelligence, assign obligation work, and keep approvals, renewals, and activity visible to the people accountable for them.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Self-hostable AGPL core. AI is optional, cited, and reviewed by people."),
    ).toBeInTheDocument()

    expect(screen.getByRole("heading", { name: "Built for contract operations" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Useful to agents. Governed by people." })).toBeInTheDocument()
    expect(
      screen.getByText(
        "Aakd does not claim autonomous legal decisions, unrestricted agent execution, or delegated approval authority. Granular delegated controls are later-phase work.",
      ),
    ).toBeInTheDocument()
  })

  it("renders the approved Northwind proof as one static, reviewable artifact", () => {
    render(<LandingPage />)

    const artifact = screen.getByRole("figure", { name: "Static contract operations example" })
    const proof = within(artifact)

    expect(proof.getByText("Northwind Services Agreement · PDF")).toBeInTheDocument()
    expect(proof.getByText("Source verified")).toBeInTheDocument()
    expect(proof.getByText("Quarterly service report")).toBeInTheDocument()
    expect(proof.getByText("Page 8 · Section 4.2")).toBeInTheDocument()
    expect(proof.getByText("Ready for review")).toBeInTheDocument()
    expect(proof.getByText("Send quarterly service report")).toBeInTheDocument()
    expect(proof.getByText("Operations")).toBeInTheDocument()
    expect(proof.getByText("Due in 10 days")).toBeInTheDocument()
    expect(proof.getByText("Open")).toBeInTheDocument()
    expect(proof.getByText("Owner assigned · review recorded")).toBeInTheDocument()
    expect(proof.getByText("Scoped API/MCP context")).toBeInTheDocument()
    expect(proof.getByText("Cited source")).toBeInTheDocument()
    expect(proof.getByText("Human review")).toBeInTheDocument()
    expect(proof.getByText("Activity trail")).toBeInTheDocument()
    expect(proof.queryByRole("button")).not.toBeInTheDocument()
    expect(proof.queryByRole("link")).not.toBeInTheDocument()
  })

  it("does not present confidence scores or unavailable product assurances", () => {
    const { container } = render(<LandingPage />)
    const copy = container.textContent ?? ""

    expect(copy).not.toContain("High confidence")
    expect(copy).not.toMatch(/\b\d{1,3}% confidence\b/i)
    expect(copy).not.toContain("Enterprise-ready")
    expect(copy).not.toContain("SOC 2 certified")
    expect(copy).not.toContain("SSO available")
    expect(copy).not.toContain("AI legal advice")
  })

  it("uses working destinations for every public call to action", () => {
    const { container } = render(<LandingPage />)

    expect(screen.getAllByRole("link", { name: "Create workspace" })[0]).toHaveAttribute(
      "href",
      "/register",
    )
    expect(screen.getAllByRole("link", { name: "View on GitHub" })[0]).toHaveAttribute(
      "href",
      "https://github.com/aaked-app/aakd",
    )
    expect(screen.getByRole("link", { name: "Read the self-hosting guide" })).toHaveAttribute(
      "href",
      "https://github.com/aaked-app/aakd/blob/main/docs/self-hosting.md",
    )

    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0)
  })

  it("keeps the complete landing copy contract in every supported locale", () => {
    const locales = [fr, de, es, ar] as Array<Record<string, unknown>>
    const englishKeys = flattenKeys(en.landing)

    for (const locale of locales) {
      expect(flattenKeys(locale.landing)).toEqual(englishKeys)
    }
  })

  it("publishes contract-specific metadata without overclaiming", () => {
    expect(LandingModule).toHaveProperty("metadata")
    expect(LandingModule.metadata).toMatchObject({
      title: "Aakd | Open-source contract lifecycle management",
      description:
        "Self-hostable contract lifecycle management for agreements, cited review, obligations, renewals, approvals, and governed agent access.",
      openGraph: {
        title: "Aakd | Open-source contract lifecycle management",
        description:
          "Self-hostable contract lifecycle management for agreements, cited review, obligations, renewals, approvals, and governed agent access.",
      },
    })
  })
})

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix]

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}
