import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { ContractAlertWithContract } from "@/lib/email"
import { emailQueue } from "@/lib/jobs/queues"
import { sendSlackAlert, sendTeamsAlert } from "@/lib/notifications/webhooks"
import { enqueueNotification } from "@/lib/notifications/fanout"

const FANOUT_EXPIRY_TYPES = new Set(["EXPIRY_7", "EXPIRY_30", "EXPIRY_90"])

const ALERT_DETAIL: Record<string, string> = {
  EXPIRY_90:     "Expiry warning: contract expires in 90 days",
  EXPIRY_30:     "Expiry warning: contract expires in 30 days",
  EXPIRY_7:      "Expiry warning: contract expires in 7 days",
  RENEWAL_DUE:   "Renewal due alert: renewal date is approaching",
  NOTICE_PERIOD: "Notice period alert: notice deadline is approaching",
}

/**
 * Finds all unfired alerts whose triggerDate has passed, fires them
 * (writes activity + sends email), then marks them firedAt = now.
 *
 * Designed to be called from a BullMQ job (alerts.check queue) or a
 * Next.js cron route. Safe to call multiple times — already-fired alerts
 * are skipped by the firedAt: null filter.
 */
export async function checkAndFireAlerts(): Promise<{ fired: number; errors: number }> {
  const due = await prisma.contractAlert.findMany({
    where: {
      firedAt: null,
      triggerDate: { lte: new Date() },
    },
    include: {
      contract: {
        include: { organization: true },
      },
    },
  })

  if (due.length === 0) return { fired: 0, errors: 0 }

  const firedIds: string[] = []
  let errors = 0

  for (const alert of due as ContractAlertWithContract[]) {
    try {
      // Hand off to the email worker — never block the alerts pipeline on SMTP.
      await emailQueue.add("send", { kind: "alert", alertId: alert.id }).catch((err) => {
        console.error(`[alerts] enqueue email failed for alert ${alert.id}:`, err)
        errors++
      })

      // Fire Slack + Teams in parallel — failures are logged inside the helpers
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.BETTER_AUTH_URL ??
        "http://localhost:3000"
      const daysUntilExpiry = alert.contract.endDate
        ? Math.max(0, Math.ceil((new Date(alert.contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0
      await Promise.allSettled([
        sendSlackAlert({
          contractTitle: alert.contract.title,
          counterpartyName: alert.contract.counterpartyName ?? null,
          daysUntilExpiry,
          contractId: alert.contract.id,
          appUrl,
        }),
        sendTeamsAlert({
          contractTitle: alert.contract.title,
          counterpartyName: alert.contract.counterpartyName ?? null,
          daysUntilExpiry,
          contractId: alert.contract.id,
          appUrl,
        }),
      ])

      // Write immutable audit entry
      const detail = ALERT_DETAIL[alert.alertType] ?? `Alert fired: ${alert.alertType}`
      await writeActivity(alert.contractId, null, "ALERT_FIRED", detail)

      firedIds.push(alert.id)
    } catch (err) {
      console.error(`[alerts] failed to process alert ${alert.id}:`, err)
      errors++
    }
  }

  // Batch-mark all successfully processed alerts as fired
  if (firedIds.length > 0) {
    await prisma.contractAlert.updateMany({
      where: { id: { in: firedIds } },
      data: { firedAt: new Date() },
    })

    // Fan out lifecycle notifications only after firedAt is committed —
    // guard against double-fire on retried jobs.
    for (const alert of due as ContractAlertWithContract[]) {
      if (!firedIds.includes(alert.id)) continue

      if (FANOUT_EXPIRY_TYPES.has(alert.alertType)) {
        const daysUntilExpiry = alert.contract.endDate
          ? Math.max(
              0,
              Math.ceil(
                (new Date(alert.contract.endDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0
        await enqueueNotification("contract.expiring_soon", alert.contractId, null, {
          alertType: alert.alertType,
          daysUntilExpiry,
        })
      } else if (alert.alertType === "EXPIRY_PAST") {
        await enqueueNotification("contract.expired", alert.contractId, null, {
          alertType: "EXPIRY_PAST",
        })
      }
    }
  }

  return { fired: firedIds.length, errors }
}
