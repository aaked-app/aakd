import { render, screen, within, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ContractsPage from "@/app/(app)/contracts/page"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}))

describe("ContractsPage responsive contract representations", () => {
  beforeEach(() => {
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
                organizationId: "org-1",
                createdAt: "2026-08-01T00:00:00.000Z",
                updatedAt: "2026-08-01T00:00:00.000Z",
              },
            ],
            total: 1,
          }),
        )
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("renders the fetched contract in both the desktop table and mobile list", async () => {
    render(<ContractsPage />)

    await waitFor(() => {
      expect(screen.queryByText("noContracts")).not.toBeInTheDocument()
    })

    const desktopTable = screen.getByRole("table")
    const mobileList = screen.getByRole("list", { name: "title" })

    expect(within(desktopTable).getByText("Northwind master agreement")).toBeInTheDocument()
    expect(within(mobileList).getByText("Northwind master agreement")).toBeInTheDocument()
    expect(within(mobileList).getByText("Northwind")).toBeInTheDocument()
  })
})
