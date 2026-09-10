import { beforeAll, describe, expect, it, vi } from "vitest"

const queueConstructor = vi.hoisted(() => vi.fn())

vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn()
    close = vi.fn().mockResolvedValue(undefined)

    constructor(name: string, options: unknown) {
      queueConstructor(name, options)
    }
  },
}))

type QueueOptions = {
  defaultJobOptions?: {
    attempts?: number
    backoff?: { type: string; delay: number }
    removeOnComplete?: number | { age?: number; count?: number }
    removeOnFail?: number | { age?: number; count?: number }
  }
}

describe("worker queue defaults", () => {
  beforeAll(async () => {
    vi.doUnmock("@/lib/jobs/queues")
    const queues = await import("@/lib/jobs/queues")

    queues.getContractExtractQueue()
    queues.getContractAiExtractQueue()
    queues.getContractEmbedQueue()
    queues.getAlertsCheckQueue()
    queues.getObligationsCheckQueue()
    queues.getObligationExtractQueue()
    queues.getContractRiskScoreQueue()
    queues.getEmailQueue()
    queues.getNotificationFanoutQueue()
    queues.getNotificationDeliverQueue()
    queues.getDocumentConvertQueue()
    queues.getDocumentExportQueue()
    queues.getSalesforcePollQueue()
    queues.getImportProcessQueue()
  })

  function optionsFor(name: string): QueueOptions {
    const call = queueConstructor.mock.calls.find(([queueName]) => queueName === name)
    expect(call, `Queue ${name} was not constructed`).toBeDefined()
    return call?.[1] as QueueOptions
  }

  it.each([
    "contract.extract",
    "contract.ai_extract",
    "contract.embed",
    "alerts.check",
    "obligations.check",
    "obligations.ai_extract",
  ])("preserves transient retry defaults for %s", (name) => {
    expect(optionsFor(name).defaultJobOptions).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    })
  })

  it.each([
    "email.send",
    "notification.fanout",
    "notification.deliver",
    "document.convert",
    "document.export",
    "salesforce.poll",
    "import.process",
  ])("preserves single-attempt delivery defaults for %s", (name) => {
    expect(optionsFor(name).defaultJobOptions).toMatchObject({ attempts: 1 })
  })

  it("preserves risk scoring retry and retention defaults", () => {
    expect(optionsFor("contract.risk_score").defaultJobOptions).toEqual({
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    })
  })
})
