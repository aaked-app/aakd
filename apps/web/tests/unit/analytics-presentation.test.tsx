import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AnalyticsClient, formatApprovalDecisionRate } from "@/components/analytics/analytics-client"
import { AnalyticsError } from "@/components/analytics/analytics-error"
import en from "@/messages/en.json"

const refresh = vi.fn()
let locale = "en-US"

function lookup(namespace: string, key: string): string {
  const value = `${namespace}.${key}`.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, en)
  return typeof value === "string" ? value : key
}

function format(template: string, values?: Record<string, unknown>) {
  return Object.entries(values ?? {}).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => format(lookup(namespace, key), values),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const Element = ({ children }: { children?: ReactNode }) => <>{children}</>
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    PieChart: Container,
    Bar: Element,
    Pie: Element,
    Cell: Element,
    XAxis: Element,
    YAxis: Element,
    CartesianGrid: Element,
    Tooltip: Element,
  }
})

const completeData = {
  expiringSoon: {
    next30: 1,
    next60: 2,
    next90: 3,
    contracts: [{
      id: "contract-1",
      title: "Northwind MSA",
      endDate: "2026-09-10T00:00:00.000Z",
      counterpartyName: "Northwind",
      contractType: "UNMAPPED_TYPE",
      daysUntilExpiry: 24,
    }],
  },
  byStatus: [{ status: "ACTIVE", count: 4 }],
  monthlyVolume: [{ month: "2026-08", count: 2 }],
  valueByType: [{ contractType: "UNMAPPED_TYPE", totalValue: 1250, count: 1 }],
  approvalFunnel: { totalRequested: 6, approved: 3, rejected: 1, pending: 2 },
  obligations: { overdue: 2, dueSoon: 1 },
}

describe("Analytics presentation", () => {
  afterEach(() => {
    locale = "en-US"
    vi.clearAllMocks()
  })

  it("states exact populations and removes misleading controls and currency totals", () => {
    render(<AnalyticsClient data={completeData} />)

    expect(screen.getAllByText("Active contracts expiring").length).toBeGreaterThan(0)
    expect(screen.getByText("Approval decision rate")).toBeInTheDocument()
    expect(screen.getByText("3 approved of 4 decided")).toBeInTheDocument()
    expect(screen.getByText("Recorded values by contract type")).toBeInTheDocument()
    expect(screen.getByText(/not currency-converted/i)).toBeInTheDocument()
    expect(screen.getAllByText("UNMAPPED_TYPE").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /30 days|90 days|12 months|ytd/i })).not.toBeInTheDocument()
    expect(screen.queryByText("Total Value")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain("$")
  })

  it("shows unavailable obligations as unavailable instead of zero", () => {
    render(<AnalyticsClient data={{ ...completeData, obligations: null }} />)

    const section = screen.getByRole("region", { name: "Obligations needing attention" })
    expect(within(section).getByText("Unavailable")).toBeInTheDocument()
    expect(within(section).queryByText("0")).not.toBeInTheDocument()
  })

  it("renders useful empty states and numeric equivalents for charts", () => {
    render(<AnalyticsClient data={{
      expiringSoon: { next30: 0, next60: 0, next90: 0, contracts: [] },
      byStatus: [],
      monthlyVolume: [],
      valueByType: [],
      approvalFunnel: { totalRequested: 0, approved: 0, rejected: 0, pending: 0 },
      obligations: { overdue: 0, dueSoon: 0 },
    }} />)

    expect(screen.getByText("No active contracts expire in the next 90 days.")).toBeInTheDocument()
    expect(screen.getByText("No contracts have been created in the last 12 months.")).toBeInTheDocument()
    expect(screen.getByText("No recorded contract values are available.")).toBeInTheDocument()
    expect(screen.getByText("No approval decisions are available yet.")).toBeInTheDocument()
  })

  it("keeps pending approval requests visible when no decision has been made", () => {
    render(<AnalyticsClient data={{
      ...completeData,
      approvalFunnel: { totalRequested: 3, approved: 0, rejected: 0, pending: 3 },
    }} />)

    const section = screen.getByRole("region", { name: "Approval decisions" })
    expect(within(section).getByText("Pending")).toBeInTheDocument()
    expect(within(section).getByText("3")).toBeInTheDocument()
    expect(within(section).getByText("No approval decisions are available yet.")).toBeInTheDocument()
  })

  it("keeps the page usable when an expiry date is malformed", () => {
    render(<AnalyticsClient data={{
      ...completeData,
      expiringSoon: {
        ...completeData.expiringSoon,
        contracts: [{ ...completeData.expiringSoon.contracts[0], endDate: "not-a-date" }],
      },
    }} />)

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument()
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })

  it("renders each expiring contract once and discloses the ten-item soonest limit", () => {
    const contracts = Array.from({ length: 10 }, (_, index) => ({
      ...completeData.expiringSoon.contracts[0],
      id: `contract-${index}`,
      title: `Contract ${index}`,
      daysUntilExpiry: index + 1,
    }))
    render(<AnalyticsClient data={{
      ...completeData,
      expiringSoon: { next30: 12, next60: 14, next90: 14, contracts },
    }} />)

    expect(screen.getAllByRole("link", { name: "Contract 0" })).toHaveLength(1)
    expect(screen.getByText("Showing the 10 soonest of 14 active contracts expiring within 90 days.")).toBeInTheDocument()
  })

  it("localizes every valid contract status independently of chart colors", () => {
    render(<AnalyticsClient data={{
      ...completeData,
      byStatus: [
        { status: "AWAITING_SIGNATURE", count: 2 },
        { status: "TERMINATED", count: 1 },
      ],
    }} />)

    expect(screen.getByText("Awaiting signature")).toBeInTheDocument()
    expect(screen.getByText("Terminated")).toBeInTheDocument()
    expect(screen.queryByText("AWAITING_SIGNATURE")).not.toBeInTheDocument()
    expect(screen.queryByText("TERMINATED")).not.toBeInTheDocument()
  })

  it("formats approval and status percentages with the active Arabic locale", () => {
    locale = "ar-EG"
    render(<AnalyticsClient data={{
      ...completeData,
      byStatus: [{ status: "ACTIVE", count: 1 }, { status: "DRAFT", count: 3 }],
    }} />)

    const percent = new Intl.NumberFormat("ar-EG", { style: "percent", maximumFractionDigits: 0 })
    expect(screen.getAllByText(percent.format(0.75)).length).toBeGreaterThan(0)
    expect(screen.getByText(percent.format(0.25))).toBeInTheDocument()
  })

  it("keeps approval percentage outputs within the locale's zero-to-one range", () => {
    const cases = [[0, 1], [1, 1], [1, 3], [3, 1], [Number.MAX_SAFE_INTEGER, 1]] as const
    const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 })
    for (const [approved, rejected] of cases) {
      const result = formatApprovalDecisionRate(approved, rejected, "en-US")
      expect(result).toBe(percent.format(approved / (approved + rejected)))
      expect(result).not.toContain("-")
    }
  })

  it("describes due-soon obligations using the API's inclusive cutoff", () => {
    render(<AnalyticsClient data={completeData} />)

    expect(screen.getByText("Due on or before the 7-day cutoff")).toBeInTheDocument()
    expect(screen.getByText(/pending or in-progress records due on or before the 7-day cutoff/i)).toBeInTheDocument()
  })

  it("retries a failed load without leaving the page", () => {
    render(<AnalyticsError />)

    const button = screen.getByRole("button", { name: "Try again" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(refresh).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
  })
})
