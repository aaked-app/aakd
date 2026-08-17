import { prisma } from "@/lib/db/client"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"

/**
 * Compensate an initial queue failure. Delete only the job created by the
 * current request and its exact newly-created objects. If deletion itself
 * fails, mark the job FAILED and retain storage so an administrator can
 * inspect/retry it without a dangling reference.
 */
export async function compensateFailedImportStart(
  jobId: string,
  storageKeys: string[],
  logLabel: string,
): Promise<void> {
  try {
    await prisma.importJob.delete({ where: { id: jobId } })
  } catch (err) {
    logger.error({ err, importJobId: jobId }, `[${logLabel}] job compensation delete failed`)
    try {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: "FAILED", completedAt: new Date() },
      })
    } catch (updateErr) {
      logger.error({ err: updateErr, importJobId: jobId }, `[${logLabel}] job compensation status failed`)
    }
    return
  }

  for (const storageKey of storageKeys) {
    try {
      await storage.delete(storageKey)
    } catch (err) {
      logger.error({ err, storageKey }, `[${logLabel}] storage compensation failed`)
    }
  }
}
