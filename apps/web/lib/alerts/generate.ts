import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"

export type ContractAlertPlan = {
  alerts: { contractId: string; alertType: string; triggerDate: Date }[]
  shouldExpire: boolean
}

export function buildContractAlertPlan(
  contractId: string,
  endDate: Date | null,
  renewalDate: Date | null,
  noticePeriodDays: number | null,
  renewalReminderEnabled = true,
  now = new Date(),
): ContractAlertPlan {
  const alerts: ContractAlertPlan["alerts"] = []
  const shouldExpire = Boolean(endDate && endDate <= now)

  if (endDate) {
    if (endDate > now) {
      const offsets: { type: string; days: number }[] = [
        { type: "EXPIRY_90", days: 90 },
        { type: "EXPIRY_30", days: 30 },
        { type: "EXPIRY_7", days: 7 },
      ]

      for (const { type, days } of offsets) {
        const triggerDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
        if (triggerDate > now) alerts.push({ contractId, alertType: type, triggerDate })
      }
    } else {
      alerts.push({ contractId, alertType: "EXPIRY_PAST", triggerDate: endDate })
    }
  }

  if (renewalReminderEnabled && renewalDate && renewalDate > now) {
    const triggerDate = new Date(renewalDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    alerts.push({ contractId, alertType: "RENEWAL_DUE", triggerDate: triggerDate > now ? triggerDate : now })
  }

  if (noticePeriodDays != null && endDate && endDate > now) {
    const triggerDate = new Date(endDate.getTime() - noticePeriodDays * 24 * 60 * 60 * 1000)
    if (triggerDate > now) alerts.push({ contractId, alertType: "NOTICE_PERIOD", triggerDate })
  }

  return { alerts, shouldExpire }
}

/**
 * Idempotently (re)generates renewal alerts for a contract.
 * Deletes all unfired alerts first, then creates new ones based on
 * endDate, renewalDate, and noticePeriodDays.
 *
 * Also immediately sets status to EXPIRED when endDate is already in the past,
 * so the contract doesn't linger in DRAFT/ACTIVE waiting for the next cron run.
 *
 * Called:
 *  - After contract creation (if endDate was provided)
 *  - After any PATCH that touches endDate, renewalDate, or noticePeriodDays
 */
export async function generateAlertsForContract(
  contractId: string,
  endDate: Date | null,
  renewalDate: Date | null,
  noticePeriodDays: number | null,
  renewalReminderEnabled = true,
): Promise<void> {
  // Step 1: delete unfired alerts so we can rebuild them cleanly
  await prisma.contractAlert.deleteMany({
    where: { contractId, firedAt: null },
  })

  const { alerts, shouldExpire } = buildContractAlertPlan(
    contractId,
    endDate,
    renewalDate,
    noticePeriodDays,
    renewalReminderEnabled,
  )

  if (shouldExpire) {
    const current = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { status: true },
    })
    if (current && !["ARCHIVED", "TERMINATED", "EXPIRED"].includes(current.status)) {
      await prisma.contract.update({ where: { id: contractId }, data: { status: "EXPIRED" } })
      await writeActivity(
        contractId,
        null,
        "STATUS_CHANGED",
        "Contract end date is in the past — status automatically set to EXPIRED",
        { from: current.status, to: "EXPIRED" },
      )
    }
  }

  // Step 5: batch create all alerts
  if (alerts.length > 0) {
    await prisma.contractAlert.createMany({ data: alerts })
  }
}
