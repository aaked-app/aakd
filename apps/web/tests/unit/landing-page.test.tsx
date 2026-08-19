import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LandingPage, * as LandingModule from "@/app/page"
import ar from "@/messages/ar.json"
import de from "@/messages/de.json"
import en from "@/messages/en.json"
import es from "@/messages/es.json"
import fr from "@/messages/fr.json"

const capturePublicMarketingEvent = vi.hoisted(() => vi.fn())

vi.mock("@/components/providers/posthog-provider", () => ({
  capturePublicMarketingEvent,
}))

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
  beforeEach(() => {
    capturePublicMarketingEvent.mockClear()
  })

  it("leads with the reviewed-action outcome and names the CLM category", () => {
    render(<LandingPage />)

    expect(screen.getByRole("banner")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn agreements into reviewed, owned action.",
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByText("Open-source contract lifecycle management")).toBeInTheDocument()
    expect(
      screen.getByText(/one contract workspace/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Self-hostable AGPL core. AI is optional, cited, and reviewed by people."),
    ).toBeInTheDocument()

    expect(screen.getByText(/solo operators, small teams, and larger organizations/i)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Review the source before the work moves." })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Give every obligation an owner and an ending." })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Useful to agents. Governed by people." })).toBeInTheDocument()
    expect(
      screen.getByText(
        "Aakd does not claim autonomous legal decisions, unrestricted agent execution, or delegated approval authority. Granular delegated controls are later-phase work.",
      ),
    ).toBeInTheDocument()
  })

  it("presents the lifecycle as an operational sequence instead of feature cards", () => {
    render(<LandingPage />)

    const workflow = screen.getByRole("list", { name: "Contract operations workflow" })
    const steps = within(workflow).getAllByRole("listitem")

    expect(steps).toHaveLength(4)
    expect(within(steps[0]).getByText("Upload agreement")).toBeInTheDocument()
    expect(within(steps[1]).getByText("Review source")).toBeInTheDocument()
    expect(within(steps[2]).getByText("Assign action")).toBeInTheDocument()
    expect(within(steps[3]).getByText("Prove completion")).toBeInTheDocument()
  })

  it("uses an enterprise editorial system without decorative AI effects", () => {
    const { container } = render(<LandingPage />)
    const classNames = Array.from(container.querySelectorAll("[class]"))
      .map((element) => element.getAttribute("class") ?? "")
      .join(" ")

    expect(classNames).not.toMatch(/gradient/i)
    expect(classNames).not.toMatch(/backdrop-blur|blur-/i)
    expect(classNames).not.toMatch(/shadow-/i)
    expect(container.querySelector("table")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Professional CLM, without the theatre." })).toBeInTheDocument()
  })

  it("keeps the capability matrix contained on narrow and RTL viewports", () => {
    render(<LandingPage />)

    expect(screen.getByRole("table", { name: "Professional CLM, without the theatre." })).toHaveClass(
      "hidden",
      "md:table",
    )
    expect(screen.getByRole("list", { name: "Professional CLM, without the theatre." })).toHaveClass(
      "md:hidden",
    )
  })

  it("contains the self-hosting terminal inside the viewport", () => {
    render(<LandingPage />)

    const section = screen.getByRole("link", { name: "Read the self-hosting guide" }).closest("section")
    expect(section?.querySelector("pre")).toHaveClass("max-w-full")
    expect(section?.querySelectorAll(".min-w-0")).toHaveLength(2)
  })

  it("renders the approved Northwind proof as one static, reviewable artifact", () => {
    render(<LandingPage />)

    const artifact = screen.getByRole("figure", { name: "Static contract operations example" })
    const proof = within(artifact)

    expect(proof.getByText("Static contract operations example")).toBeVisible()
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

  it("instruments every high-intent registration and GitHub destination once at the link", () => {
    const { container } = render(<LandingPage />)
    const githubLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="https://github.com/"]'))

    for (const link of githubLinks) fireEvent.click(link)
    for (const link of screen.getAllByRole("link", { name: "Create workspace" })) fireEvent.click(link)

    expect(githubLinks).toHaveLength(7)
    expect(capturePublicMarketingEvent.mock.calls).toEqual([
      ["hero_view_github"],
      ["self_hosting_guide"],
      ["final_view_github"],
      ["footer_self_hosting"],
      ["footer_api_reference"],
      ["footer_security"],
      ["footer_view_github"],
      ["header_create_workspace"],
      ["menu_create_workspace"],
      ["hero_create_workspace"],
      ["final_create_workspace"],
    ])
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
      title: { absolute: "Aakd | Open-source contract lifecycle management" },
      description:
        "Self-hostable contract lifecycle management for agreements, cited review, obligations, renewals, approvals, and governed agent access.",
      alternates: { canonical: "/" },
      openGraph: {
        title: "Aakd | Open-source contract lifecycle management",
        description:
          "Self-hostable contract lifecycle management for agreements, cited review, obligations, renewals, approvals, and governed agent access.",
        url: "/",
        siteName: "Aakd",
        type: "website",
      },
      twitter: { card: "summary" },
    })
  })

  it("publishes factual software identity for search and answer engines", () => {
    const { container } = render(<LandingPage />)
    const script = container.querySelector('script[type="application/ld+json"]')

    expect(script).not.toBeNull()
    expect(JSON.parse(script?.textContent ?? "")).toMatchObject({
      "@graph": expect.arrayContaining([
        expect.objectContaining({ "@type": "WebSite", name: "Aakd", url: "https://aakd.app" }),
        expect.objectContaining({
          "@type": "SoftwareApplication",
          name: "Aakd",
          url: "https://aakd.app",
          sameAs: ["https://github.com/aaked-app/aakd"],
        }),
      ]),
    })
  })
})

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix]

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}
