import Link from "next/link"
import { cookies } from "next/headers"
import { FileText, Clock, CheckSquare, PenSquare, Plus, Bell } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContractStatusBadge } from "@/components/contract-status-badge"
import { Contract, ContractAlert } from "@/lib/types"
import { format, differenceInDays } from "date-fns"

async function fetchCount(params: string): Promise<number> {
  try {
    const cookieStore = await cookies()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/contracts?${params}&limit=1`,
      { headers: { cookie: cookieStore.toString() }, cache: "no-store" }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data.total ?? 0
  } catch {
    return 0
  }
}

async function fetchContracts(params: string): Promise<Contract[]> {
  try {
    const cookieStore = await cookies()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/contracts?${params}`,
      { headers: { cookie: cookieStore.toString() }, cache: "no-store" }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.contracts ?? data ?? []
  } catch {
    return []
  }
}

async function fetchUpcomingAlerts(limit = 5): Promise<ContractAlert[]> {
  try {
    const cookieStore = await cookies()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/alerts?limit=${limit}`,
      { headers: { cookie: cookieStore.toString() }, cache: "no-store" }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.alerts ?? []
  } catch {
    return []
  }
}

function StatCard({ title, value, Icon, gradient }: {
  title: string
  value: number
  Icon: React.ComponentType<{ className?: string }>
  gradient: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br ${gradient}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

const ALERT_LABELS: Record<string, string> = {
  EXPIRY_90:     "Expires in 90 days",
  EXPIRY_30:     "Expires in 30 days",
  EXPIRY_7:      "Expires in 7 days",
  RENEWAL_DUE:   "Renewal Due",
  NOTICE_PERIOD: "Notice Period",
}

export default async function DashboardPage() {
  const [activeCount, pendingCount, awaitingCount, recentContracts, upcomingAlerts] = await Promise.all([
    fetchCount("status=ACTIVE"),
    fetchCount("status=PENDING_APPROVAL"),
    fetchCount("status=AWAITING_SIGNATURE"),
    fetchContracts("limit=5"),
    fetchUpcomingAlerts(5),
  ])

  // Count contracts with EXPIRY_30 alert not yet fired
  const expiring30Count = upcomingAlerts.filter(
    (a) => a.alertType === "EXPIRY_30" && !a.firedAt
  ).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link href="/contracts/new" className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[0.8rem] font-medium rounded-[min(var(--radius-md),12px)] bg-primary text-primary-foreground transition-colors hover:opacity-90">
          <Plus className="h-3.5 w-3.5" />
          New Contract
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Contracts" value={activeCount} Icon={FileText} gradient="from-emerald-400 to-emerald-600" />
        <StatCard title="Expiring in 30 days" value={expiring30Count} Icon={Clock} gradient="from-amber-400 to-orange-500" />
        <StatCard title="Pending Approval" value={pendingCount} Icon={CheckSquare} gradient="from-blue-400 to-blue-600" />
        <StatCard title="Awaiting Signature" value={awaitingCount} Icon={PenSquare} gradient="from-violet-400 to-violet-600" />
      </div>

      {/* Renewal alerts widget */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Renewing Soon
          </h2>
          <Link href="/contracts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all contracts
          </Link>
        </div>
        {upcomingAlerts.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-8">
            <p className="text-sm text-muted-foreground">No upcoming renewals</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Contract</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Alert</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Days Until</th>
                </tr>
              </thead>
              <tbody>
                {upcomingAlerts.map((alert) => {
                  const daysUntil = differenceInDays(new Date(alert.triggerDate), new Date())
                  const urgencyColor =
                    daysUntil <= 7
                      ? "text-red-600"
                      : daysUntil <= 30
                      ? "text-amber-600"
                      : "text-emerald-600"
                  return (
                    <tr key={alert.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {alert.contract ? (
                          <Link href={`/contracts/${alert.contract.id}`} className="font-medium hover:text-primary transition-colors">
                            {alert.contract.title}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ALERT_LABELS[alert.alertType] ?? alert.alertType}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(alert.triggerDate), "MMM d, yyyy")}
                      </td>
                      <td className={`px-4 py-3 font-medium ${urgencyColor}`}>
                        {daysUntil <= 0 ? "Today" : `${daysUntil}d`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Contracts</h2>
        {recentContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No contracts yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upload your first contract to get started</p>
            </div>
            <Link href="/contracts/new" className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8rem] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              <Plus className="h-3.5 w-3.5" />
              Upload your first contract
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {recentContracts.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contracts/${c.id}`} className="font-medium hover:text-primary transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.contractType}</td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.counterpartyName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
