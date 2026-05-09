/**
 * Entry point for firing notification events from API routes and workers.
 *
 * Callers do not contact any channel inline. enqueueNotification puts a
 * single `notification.fanout` job on the queue and returns immediately.
 * The fanout worker (worker.ts) resolves recipients, builds payloads,
 * computes HMAC signatures, and enqueues every downstream delivery.
 */
import { notificationFanoutQueue } from "@/lib/jobs/queues"

export type NotificationEventName =
  | "contract.uploaded"
  | "contract.extracted"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "contract.sent_for_signing"
  | "contract.signed"
  | "contract.expiring_soon"
  | "contract.expired"
  | "contract.archived"

export const NOTIFICATION_EVENT_NAMES: ReadonlyArray<NotificationEventName> = [
  "contract.uploaded",
  "contract.extracted",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "contract.sent_for_signing",
  "contract.signed",
  "contract.expiring_soon",
  "contract.expired",
  "contract.archived",
]

export const HUMAN_EVENT_LABELS: Record<NotificationEventName, string> = {
  "contract.uploaded": "Contract file uploaded",
  "contract.extracted": "AI metadata extracted",
  "approval.requested": "Approval request assigned to me",
  "approval.approved": "Approval decision: approved",
  "approval.rejected": "Approval decision: rejected",
  "contract.sent_for_signing": "Contract sent for signing",
  "contract.signed": "Contract signed",
  "contract.expiring_soon": "Contract expiring soon",
  "contract.expired": "Contract expired",
  "contract.archived": "Contract archived",
}

export const DEFAULT_EMAIL_ENABLED: Record<NotificationEventName, boolean> = {
  "contract.uploaded": false,
  "contract.extracted": false,
  "approval.requested": true,
  "approval.approved": true,
  "approval.rejected": true,
  "contract.sent_for_signing": false,
  "contract.signed": true,
  "contract.expiring_soon": true,
  "contract.expired": true,
  "contract.archived": false,
}

export const WEBHOOK_API_VERSION = "2026-05-01"

/**
 * Enqueue a fan-out job for a single contract lifecycle event. Returns
 * immediately — the worker handles channel resolution, payload construction,
 * signing, and delivery. Failures to enqueue are logged but never thrown so
 * the caller's primary action is never blocked.
 */
export async function enqueueNotification(
  eventName: NotificationEventName,
  contractId: string,
  actorId: string | null,
  metadata: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  try {
    await notificationFanoutQueue.add("fanout", {
      eventName,
      contractId,
      actorId,
      metadata,
    })
  } catch (err) {
    console.error(
      `[notifications] failed to enqueue fanout for ${eventName} contract=${contractId}:`,
      err,
    )
  }
}
