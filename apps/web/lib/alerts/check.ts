import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { sendAlertEmail, ContractAlertWithContract } from "@/lib/email"

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
      // Send email first — wrapped so a failure doesn't skip the activity write
      await sendAlertEmail(alert).catch((err) => {
        console.error(`[alerts] email failed for alert ${alert.id}:`, err)
        errors++
      })

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
  }

  return { fired: firedIds.length, errors }
}
