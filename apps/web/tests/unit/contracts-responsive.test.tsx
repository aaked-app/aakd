import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ContractsPage from "@/app/(app)/contracts/page"

const push = vi.fn()
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
const intl = vi.hoisted(() => {
  const state = { locale: "en" }
  const messages: Record<string, Record<string, string>> = {
    en: {
      title: "Contracts",
      tableRisk: "Risk",
      selectAll: "Select all contracts",
      deselectAll: "Deselect all contracts",
      selectContract: "Select {title}",
      deselectContract: "Deselect {title}",
      riskLow: "Low",
      riskHigh: "High",
      riskNotScored: "Not scored",
      riskUnknown: "Unknown",
      loading: "Loading contracts",
      failedToLoad: "Failed to load contracts",
      retry: "Retry",
      noContracts: "No contracts",
      createFirst: "Build your contract repository by adding the first agreement.",
      newContract: "New contract",
      repositorySetup: "Repository setup",
      repositoryWorkflow: "Repository workflow",
      repositoryUploadTitle: "Add an agreement",
      repositoryReviewTitle: "Review cited details",
      repositoryOrganizeTitle: "Track ownership",
      repositoryTrust: "Suggested details remain reviewable before they become workspace truth.",
    },
    de: {
      title: "Verträge",
      tableRisk: "Risiko",
      selectAll: "Alle Verträge auswählen",
      deselectAll: "Auswahl aller Verträge aufheben",
      selectContract: "{title} auswählen",
      deselectContract: "Auswahl von {title} aufheben",
      riskLow: "Niedrig",
      riskHigh: "Hoch",
      riskNotScored: "Nicht bewertet",
      riskUnknown: "Unbekannt",
    },
    ar: {
      title: "العقود",
      tableRisk: "المخاطر",
      selectAll: "تحديد جميع العقود",
      deselectAll: "إلغاء تحديد جميع العقود",
      selectContract: "تحديد {title}",
      deselectContract: "إلغاء تحديد {title}",
      riskLow: "منخفض",
      riskHigh: "مرتفع",
      riskNotScored: "غير مقيّم",
      riskUnknown: "غير معروف",
      previousPage: "الصفحة السابقة",
      nextPage: "الصفحة التالية",
      pageOf: "الصفحة {page} من {totalPages}",
    },
  }

  return {
    state,
    translate(key: string, values?: Record<string, string>) {
      const template = messages[state.locale]?.[key] ?? key
      return Object.entries(values ?? {}).reduce(
        (result, [name, value]) => result.replace(`{${name}}`, String(value)),
        template,
      )
    },
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next-intl", () => ({
  useLocale: () => intl.state.locale,
  useTranslations: () => intl.translate,
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}))

vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}))

async function waitForContracts() {
  await waitFor(() => {
    expect(screen.getAllByText("Northwind master agreement")).toHaveLength(2)
  })
}

describe("ContractsPage responsive contract representations", () => {
  beforeEach(() => {
    intl.state.locale = "en"
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === "/api/org/members") {
          return new Response(JSON.stringify([{ userId: "user-1", role: "member" }]))
        }

        return new Response(
          JSON.stringify({
            contracts: [
              {
                id: "contract-1",
                title: "Northwind master agreement",
                contractType: "MSA",
                status: "ACTIVE",
                ownerId: "user-1",
                owner: {
                  id: "user-1",
                  name: "Alex Johnson",
                  email: "alex@example.com",
                  image: null,
                },
                counterpartyName: "Northwind",
                value: 25000,
                currency: "USD",
                endDate: "2027-06-30T00:00:00.000Z",
                riskScore: "LOW",
                organizationId: "org-1",
                createdAt: "2026-08-01T00:00:00.000Z",
                updatedAt: "2026-08-01T00:00:00.000Z",
              },
              {
                id: "contract-2",
                title: "Contoso services order",
                contractType: "SOW",
                status: "DRAFT",
                ownerId: null,
                owner: null,
                counterpartyName: "Contoso",
                value: 1200,
                currency: null,
                endDate: null,
                riskScore: "UNKNOWN",
                organizationId: "org-1",
                createdAt: "2026-08-01T00:00:00.000Z",
                updatedAt: "2026-08-01T00:00:00.000Z",
              },
            ],
            total: 2,
          }),
        )
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("renders contract and owner context in both desktop and mobile representations", async () => {
    render(<ContractsPage />)

    await waitForContracts()

    const desktopTable = screen.getByRole("table")
    const mobileList = screen.getByRole("list", { name: "Contracts" })

    expect(within(desktopTable).getByText("Northwind master agreement")).toBeInTheDocument()
    expect(within(desktopTable).getByTitle("Alex Johnson")).toBeInTheDocument()
    expect(within(mobileList).getByText("Northwind master agreement")).toBeInTheDocument()
    expect(within(mobileList).getByText("Northwind")).toBeInTheDocument()
    expect(within(mobileList).getByText("Alex Johnson")).toBeInTheDocument()
  })

  it("uses the active locale for dates, values, and visible risk text without inventing a currency", async () => {
    intl.state.locale = "de"
    render(<ContractsPage />)

    await waitForContracts()
    const desktopTable = screen.getByRole("table")

    expect(within(desktopTable).getByRole("columnheader", { name: "Risiko" })).toBeInTheDocument()
    expect(within(desktopTable).getByText("Niedrig")).toBeInTheDocument()
    expect(within(desktopTable).getByText("Unbekannt")).toBeInTheDocument()
    expect(within(desktopTable).getByText("30. Juni 2027")).toBeInTheDocument()
    expect(within(desktopTable).getByText(/25\.000.*\$/)).toBeInTheDocument()
    expect(within(desktopTable).getByText("1.200")).toBeInTheDocument()
  })

  it("names selection controls and exposes the partial-selection state in both representations", async () => {
    render(<ContractsPage />)

    await waitForContracts()
    const desktopTable = screen.getByRole("table")
    const mobileList = screen.getByRole("list", { name: "Contracts" })
    const desktopMaster = within(desktopTable).getByRole("checkbox", { name: "Select all contracts" })
    const desktopNorthwind = within(desktopTable).getByRole("checkbox", {
      name: "Select Northwind master agreement",
    })
    const mobileNorthwind = within(mobileList).getByRole("checkbox", {
      name: "Select Northwind master agreement",
    })

    expect(desktopMaster).not.toBeChecked()
    expect(desktopMaster).toHaveProperty("indeterminate", false)
    expect(mobileNorthwind).not.toBeChecked()

    await act(async () => {
      fireEvent.click(desktopNorthwind)
    })

    expect(desktopNorthwind).toHaveAccessibleName("Deselect Northwind master agreement")
    expect(desktopMaster).not.toBeChecked()
    expect(desktopMaster).toHaveProperty("indeterminate", true)

    await act(async () => {
      fireEvent.click(desktopMaster)
    })

    expect(desktopMaster).toBeChecked()
    expect(desktopMaster).toHaveAccessibleName("Deselect all contracts")
    expect(desktopMaster).toHaveProperty("indeterminate", false)
  })

  it("keeps the existing list endpoint and hides archive actions from members", async () => {
    render(<ContractsPage />)

    await waitForContracts()
    const desktopTable = screen.getByRole("table")
    await act(async () => {
      fireEvent.click(within(desktopTable).getByRole("checkbox", {
        name: "Select Northwind master agreement",
      }))
    })

    expect(fetch).toHaveBeenCalledWith("/api/contracts?limit=20&page=1", {
      signal: expect.any(AbortSignal),
    })
    expect(screen.queryByRole("button", { name: "archive" })).not.toBeInTheDocument()
  })

  it("shows a retryable error instead of the ordinary empty state after a failed request", async () => {
    let contractsAttempts = 0
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/org/members") {
        return new Response(JSON.stringify([{ userId: "user-1", role: "member" }]))
      }

      contractsAttempts += 1
      if (contractsAttempts === 1) return new Response(null, { status: 503 })
      return new Response(JSON.stringify({
        contracts: [{
          id: "contract-recovered",
          title: "Recovered agreement",
          contractType: "MSA",
          status: "ACTIVE",
          ownerId: null,
          owner: null,
          counterpartyName: "Northwind",
          value: null,
          currency: null,
          endDate: null,
          riskScore: null,
          organizationId: "org-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        }],
        total: 1,
      }))
    }))

    render(<ContractsPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load contracts")
    expect(screen.queryByRole("status", { name: "Loading contracts" })).not.toBeInTheDocument()
    expect(screen.queryByText("No contracts")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findAllByText("Recovered agreement")).toHaveLength(2)
    expect(contractsAttempts).toBe(2)
  })

  it("turns the empty repository into a guided, reviewable setup state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/org/members") {
        return new Response(JSON.stringify([{ userId: "user-1", role: "member" }]))
      }
      return new Response(JSON.stringify({ contracts: [], total: 0 }))
    }))

    render(<ContractsPage />)

    expect(await screen.findByText("Repository setup")).toBeInTheDocument()
    const workflow = screen.getByRole("list", { name: "Repository workflow" })
    expect(within(workflow).getByText("Add an agreement")).toBeInTheDocument()
    expect(within(workflow).getByText("Review cited details")).toBeInTheDocument()
    expect(within(workflow).getByText("Track ownership")).toBeInTheDocument()
    expect(screen.getByText("Suggested details remain reviewable before they become workspace truth.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "New contract" }))
    expect(push).toHaveBeenCalledWith("/contracts/new")
  })

  it("ignores a superseded response and keeps the newer request loading until it settles", async () => {
    const resolvers: Array<(response: Response) => void> = []
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/org/members") {
        return new Response(JSON.stringify([{ userId: "user-1", role: "member" }]))
      }

      return new Promise<Response>((resolve) => resolvers.push(resolve))
    }))

    render(<ContractsPage />)
    await waitFor(() => expect(resolvers).toHaveLength(1))

    fireEvent.click(screen.getByRole("button", { name: "filterActive" }))
    await waitFor(() => expect(resolvers).toHaveLength(2))

    await act(async () => {
      resolvers[0](new Response(JSON.stringify({
        contracts: [{
          id: "contract-stale",
          title: "Stale agreement",
          contractType: "MSA",
          status: "ACTIVE",
          ownerId: null,
          owner: null,
          counterpartyName: "Old counterparty",
          value: null,
          currency: null,
          endDate: null,
          riskScore: null,
          organizationId: "org-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        }],
        total: 1,
      })))
    })

    expect(screen.getByRole("status", { name: "Loading contracts" })).toBeInTheDocument()
    expect(screen.queryByText("Stale agreement")).not.toBeInTheDocument()

    await act(async () => {
      resolvers[1](new Response(JSON.stringify({
        contracts: [{
          id: "contract-current",
          title: "Current agreement",
          contractType: "MSA",
          status: "ACTIVE",
          ownerId: null,
          owner: null,
          counterpartyName: "Current counterparty",
          value: null,
          currency: null,
          endDate: null,
          riskScore: null,
          organizationId: "org-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        }],
        total: 1,
      })))
    })

    expect(await screen.findAllByText("Current agreement")).toHaveLength(2)
    expect(screen.queryByRole("status", { name: "Loading contracts" })).not.toBeInTheDocument()
  })

  it("shows the existing bulk archive action to an administrator", async () => {
    const loadedFetch = fetch as typeof fetch
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/org/members") {
          return new Response(JSON.stringify([{ userId: "user-1", role: "admin" }]))
        }
        return loadedFetch(input, init)
      }),
    )

    render(<ContractsPage />)
    await waitForContracts()

    const desktopTable = screen.getByRole("table")
    fireEvent.click(within(desktopTable).getByRole("checkbox", {
      name: "Select Northwind master agreement",
    }))

    expect(await screen.findByRole("button", { name: "archive" })).toBeInTheDocument()
  })

  it("uses Arabic labels and logical pagination directions in RTL", async () => {
    intl.state.locale = "ar"
    const loadedFetch = fetch as typeof fetch
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await loadedFetch(input, init)
        if (String(input) === "/api/org/members") return response
        const data = await response.json()
        return new Response(JSON.stringify({ ...data, total: 21 }))
      }),
    )

    render(<ContractsPage />)
    await waitForContracts()

    const desktopTable = screen.getByRole("table")
    expect(within(desktopTable).getByRole("columnheader", { name: "المخاطر" })).toBeInTheDocument()
    expect(within(desktopTable).getByText("منخفض")).toBeInTheDocument()

    const previous = screen.getByRole("button", { name: "الصفحة السابقة" })
    const next = screen.getByRole("button", { name: "الصفحة التالية" })
    expect(previous.querySelector(".lucide-chevron-right")).toBeInTheDocument()
    expect(next.querySelector(".lucide-chevron-left")).toBeInTheDocument()
  })

  it("announces the loading state while the contracts request is pending", async () => {
    let resolveContracts: ((response: Response) => void) | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/org/members") {
          return new Response(JSON.stringify([{ userId: "user-1", role: "member" }]))
        }

        return new Promise<Response>((resolve) => {
          resolveContracts = resolve
        })
      }),
    )

    render(<ContractsPage />)

    expect(screen.getByRole("status", { name: "Loading contracts" })).toHaveAttribute("aria-busy", "true")

    await act(async () => {
      resolveContracts?.(new Response(JSON.stringify({ contracts: [], total: 0 })))
    })
  })
})
