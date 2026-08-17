import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import LandingPage from "@/app/page"
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
  it("presents the trusted agreement-to-action journey with semantic navigation", () => {
    render(<LandingPage />)

    expect(screen.getByRole("banner")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Know what your agreements require next." }),
    ).toBeInTheDocument()

    expect(screen.getByText("Synthetic example")).toBeInTheDocument()
    expect(screen.getByText("Exact source")).toBeInTheDocument()
    expect(screen.getByText("Review required")).toBeInTheDocument()
    expect(screen.getByText("Commercial operations")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Useful to agents. Governed by people." })).toBeInTheDocument()
    expect(getMessage(en as Record<string, unknown>, "features.i0title")).toBe("Cited extraction review")
    expect(getMessage(en as Record<string, unknown>, "features.i1title")).toBe("Contract repository")
    expect(getMessage(en as Record<string, unknown>, "dd.0eyebrow")).toBe("Reviewable intelligence")
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
})

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix]

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}
