import type { EmailJobData } from "@/lib/jobs/queues"

type ActionDeliveryJob = Extract<EmailJobData, { kind: "action_delivery" }>

type DeliveryDb = {
  contractActionDelivery: {
    update(args: {
      where: { id: string }
      data: Record<string, unknown>
      select?: Record<string, unknown>
    }): Promise<{ actionId: string; action: { contractId: string; title: string } }>
  }
  activity: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>
  }
}

export async function processActionDelivery(
  job: ActionDeliveryJob,
  dependencies: {
    db: DeliveryDb
    send: (job: ActionDeliveryJob) => Promise<void>
  },
): Promise<void> {
  try {
    await dependencies.send(job)
  } catch (error) {
    await dependencies.db.contractActionDelivery.update({
      where: { id: job.deliveryId },
      data: { status: "failed", errorCode: "email_delivery_failed" },
    }).catch(() => undefined)
    throw error
  }

  // SMTP is not idempotent. Once send succeeds, never label the attempt failed
  // or retry it merely because reconciliation later fails: that could duplicate
  // an external email. A reconciliation failure leaves the durable row queued
  // for an operator to inspect.
  const delivery = await dependencies.db.contractActionDelivery.update({
    where: { id: job.deliveryId },
    data: { status: "delivered", deliveredAt: new Date(), errorCode: null },
    select: { actionId: true, action: { select: { contractId: true, title: true } } },
  })
  await dependencies.db.activity.create({
    data: {
      contractId: delivery.action.contractId,
      contractActionId: delivery.actionId,
      action: "ACTION_DELIVERED",
      detail: `Action email delivered: ${delivery.action.title}`,
      metadata: { channel: "email", deliveryId: job.deliveryId },
    },
  })
}
