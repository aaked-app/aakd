import { createHash } from "crypto"
import { Job, Worker } from "bullmq"
import { getWorkerPrisma } from "@/lib/db/worker-client"
import { storage } from "@/lib/storage"
import { fetchDocuSealDocument, getSubmission, type DocuSealConfig } from "@/lib/docuseal"
import { docuSealEnvironmentProviderId, resolveDocuSealConfigFromDb } from "@/lib/signature/resolve-config"
import { isAgreementAccessEmergencyDenyAll } from "@/lib/auth/agreement-access"
import { notificationFanoutQueue, type SigningSyncJobData } from "@/lib/jobs/queues"
import { logger } from "@/lib/logger"

type SyncableContract = {
  id: string
  title: string
  organizationId: string
  ownerId: string
  docusealSubmissionId: string | null
  signatureProviderId: string | null
  status: string
  signingStatus: string | null
  signingNotificationPending: boolean
  signingNotificationEvent: string | null
}

function normalizeDocuSealStatus(status: string): "completed" | "declined" | "expired" | "failed" | "sent" {
  const normalized = status.toLowerCase()
  if (normalized === "completed") return "completed"
  if (normalized === "declined") return "declined"
  if (normalized === "expired") return "expired"
  if (normalized === "failed") return "failed"
  return "sent"
}

function normalizeDocuSealSignerStatus(status: string): "signed" | "pending" | "not_sent" | "declined" {
  const normalized = status.toLowerCase()
  if (normalized === "completed") return "signed"
  if (normalized === "declined") return "declined"
  if (normalized === "not_sent") return "not_sent"
  // A submitter exists at the provider, so unknown non-terminal states are
  // pending rather than an unsupported contract-level status.
  return "pending"
}

async function resolveContractProvider(contract: SyncableContract): Promise<DocuSealConfig> {
  if (!contract.signatureProviderId) throw new Error("DocuSeal provider identity missing")
  const db = getWorkerPrisma()
  const stored = await resolveDocuSealConfigFromDb(db, contract.organizationId)
  if (stored.configured) {
    if (!stored.config || stored.providerId !== contract.signatureProviderId) throw new Error("DocuSeal integration unavailable")
    return stored.config
  }
  const apiKey = process.env.DOCUSEAL_API_KEY?.trim()
  const baseUrl = process.env.DOCUSEAL_API_URL || process.env.DOCUSEAL_BASE_URL || "https://api.docuseal.com"
  if (!apiKey || docuSealEnvironmentProviderId(baseUrl) !== contract.signatureProviderId) {
    throw new Error("DocuSeal environment integration unavailable")
  }
  return { baseUrl, apiKey }
}

async function flushSigningNotification(contract: SyncableContract): Promise<void> {
  if (!contract.signingNotificationPending || !contract.signingNotificationEvent) return
  if (contract.signingNotificationEvent !== "contract.signed" && contract.signingNotificationEvent !== "contract.signing_declined") {
    throw new Error("Unsupported signing notification event")
  }
  const db = getWorkerPrisma()
  const jobId = `signing-notification-${createHash("sha256").update(`${contract.id}:${contract.signatureProviderId}:${contract.docusealSubmissionId}:${contract.signingNotificationEvent}`).digest("hex")}`
  await notificationFanoutQueue.add("fanout", {
    eventName: contract.signingNotificationEvent,
    contractId: contract.id,
    actorId: null,
    metadata: contract.signingNotificationEvent === "contract.signing_declined"
      ? { signingStatus: contract.signingStatus }
      : {},
  }, { jobId })
  await db.contract.updateMany({
    where: {
      id: contract.id,
      signatureProviderId: contract.signatureProviderId,
      signingNotificationPending: true,
      signingNotificationEvent: contract.signingNotificationEvent,
    },
    data: { signingNotificationPending: false },
  })
}

function signedStorageKey(contract: SyncableContract): string {
  const digest = createHash("sha256")
    .update(`${contract.signatureProviderId}:${contract.docusealSubmissionId}`)
    .digest("hex")
  return `orgs/${contract.organizationId}/contracts/${contract.id}/signed_docuseal_${digest}.pdf`
}

async function persistSignedDocument(contract: SyncableContract, documentUrl: string, config: DocuSealConfig) {
  const db = getWorkerPrisma()
  const signedRes = await fetchDocuSealDocument(documentUrl, config)
  if (!signedRes.ok) throw new Error(`Failed to download signed PDF: ${signedRes.status}`)
  const buffer = Buffer.from(await signedRes.arrayBuffer())
  if (!buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) throw new Error("Signed document is not a PDF")

  const newKey = signedStorageKey(contract)
  await storage.upload(newKey, buffer, "application/pdf")
  try {
    await db.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Contract"
         WHERE "id" = $1 AND "organizationId" = $2
           AND "signatureProviderId" = $3 AND "docusealSubmissionId" = $4
         FOR UPDATE`,
        contract.id,
        contract.organizationId,
        contract.signatureProviderId,
        contract.docusealSubmissionId,
      )
      if (locked.length !== 1) throw new Error("DocuSeal contract identity changed")
      const current = await tx.contract.findUnique({
        where: { id: contract.id },
        select: { status: true, signingStatus: true, signingNotificationPending: true, signingNotificationEvent: true },
      })
      if (current?.signingStatus === "completed") return
      if (current?.status !== "AWAITING_SIGNATURE") throw new Error("Contract no longer awaits signature")

      const existingSigned = await tx.contractFile.findFirst({ where: { contractId: contract.id, storageKey: newKey } })
      if (!existingSigned) {
        const latest = await tx.contractFile.findFirst({
          where: { contractId: contract.id, isLatest: true },
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        })
        const nextVersion = (latest?.version ?? 0) + 1
        await tx.contractFile.updateMany({ where: { contractId: contract.id, isLatest: true }, data: { isLatest: false } })
        const file = await tx.contractFile.create({
          data: {
            contractId: contract.id,
            filename: "signed_document.pdf",
            storageKey: newKey,
            mimeType: "application/pdf",
            sizeBytes: buffer.length,
            isSigned: true,
            isLatest: true,
            version: nextVersion,
            uploadedById: contract.ownerId,
          },
        })
        await tx.contractVersion.create({
          data: {
            contractId: contract.id,
            version: nextVersion,
            changeNote: "Signed via DocuSeal",
            fileId: file.id,
            createdById: contract.ownerId,
          },
        })
      }
      await tx.contractSigner.updateMany({
        where: { contractId: contract.id },
        data: { status: "signed", signedAt: new Date() },
      })
      await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: "ACTIVE",
          signingStatus: "completed",
          signingUrl: null,
          signingNotificationPending: true,
          signingNotificationEvent: "contract.signed",
        },
      })
      await tx.activity.create({
        data: {
          contractId: contract.id,
          userId: null,
          actorLabel: "System",
          action: "SIGNED",
          detail: `Contract signed via DocuSeal (submission #${contract.docusealSubmissionId})`,
        },
      })
    }, { isolationLevel: "ReadCommitted" })
  } catch (error) {
    const referenced = await db.$queryRawUnsafe<Array<{ present: number }>>(
      `SELECT 1 AS "present" FROM "ContractFile" WHERE "storageKey" = $1 LIMIT 1`,
      newKey,
    )
    if (referenced.length === 0) await storage.delete(newKey).catch(() => undefined)
    throw error
  }
}

async function syncDocuSealContract(contract: SyncableContract) {
  if (contract.signingNotificationPending) await flushSigningNotification(contract)
  if (!contract.docusealSubmissionId || contract.signingStatus === "completed") return
  if (contract.status !== "AWAITING_SIGNATURE") throw new Error("Contract no longer awaits signature")
  const config = await resolveContractProvider(contract)
  const submissionId = Number(contract.docusealSubmissionId)
  if (!Number.isSafeInteger(submissionId) || submissionId <= 0) throw new Error("Invalid DocuSeal submission identifier")
  const submission = await getSubmission(submissionId, config)
  if (!submission) throw new Error("DocuSeal submission unavailable")

  const signingStatus = normalizeDocuSealStatus(submission.status)
  if (signingStatus === "completed") {
    const signedDocUrl = submission.documents[0]?.url
    if (!signedDocUrl) throw new Error("Completed DocuSeal submission has no document URL")
    await persistSignedDocument(contract, signedDocUrl, config)
  } else {
    await getWorkerPrisma().$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; signingStatus: string | null }>>(
        `SELECT "id", "signingStatus" FROM "Contract"
         WHERE "id" = $1 AND "organizationId" = $2
           AND "signatureProviderId" = $3 AND "docusealSubmissionId" = $4
           AND "status" = 'AWAITING_SIGNATURE'
         FOR UPDATE`,
        contract.id,
        contract.organizationId,
        contract.signatureProviderId,
        contract.docusealSubmissionId,
      )
      if (locked.length !== 1) throw new Error("Contract no longer awaits signature")
      if (locked[0].signingStatus === "completed") return

      for (const submitter of submission.submitters) {
        const signerStatus = normalizeDocuSealSignerStatus(submitter.status)
        await tx.contractSigner.updateMany({
          where: {
            contractId: contract.id,
            externalId: submitter.slug,
            ...(signerStatus === "signed" ? {} : { status: { not: "signed" } }),
          },
          data: {
            status: signerStatus,
            signedAt: signerStatus === "signed" && submitter.completed_at
              ? new Date(submitter.completed_at)
              : signerStatus === "signed" ? undefined : null,
          },
        })
      }
      if (signingStatus === locked[0].signingStatus) return

      const updated = await tx.contract.updateMany({
        where: {
          id: contract.id,
          organizationId: contract.organizationId,
          status: "AWAITING_SIGNATURE",
          signatureProviderId: contract.signatureProviderId,
          docusealSubmissionId: contract.docusealSubmissionId,
          signingStatus: locked[0].signingStatus,
        },
        data: {
          signingStatus,
          signingNotificationPending: signingStatus === "declined" || signingStatus === "expired",
          signingNotificationEvent: signingStatus === "declined" || signingStatus === "expired"
            ? "contract.signing_declined"
            : null,
        },
      })
      if (updated.count === 1) {
        await tx.activity.create({
          data: {
            contractId: contract.id,
            userId: null,
            actorLabel: "System",
            action: "UPDATED",
            detail: `DocuSeal submission #${contract.docusealSubmissionId} marked ${signingStatus}`,
          },
        })
      }
    })
  }

  const refreshed = await getWorkerPrisma().contract.findUnique({
    where: { id: contract.id },
    select: {
      id: true, title: true, organizationId: true, ownerId: true,
      status: true,
      docusealSubmissionId: true, signatureProviderId: true, signingStatus: true,
      signingNotificationPending: true, signingNotificationEvent: true,
    },
  })
  if (refreshed?.signingNotificationPending) await flushSigningNotification(refreshed)
}

export function createSigningSyncWorker(connection: { url: string }) {
  const worker = new Worker<SigningSyncJobData>("signing.sync", async (job: Job<SigningSyncJobData>) => {
    if (isAgreementAccessEmergencyDenyAll()) throw new Error("Agreement processing disabled by emergency policy")
    if (job.data.submissionId && !job.data.providerId) throw new Error("Webhook signing job missing provider identity")

    const where = job.data.contractId
      ? { id: job.data.contractId }
      : job.data.submissionId
        ? {
            docusealSubmissionId: job.data.submissionId,
            signatureProviderId: job.data.providerId,
            ...(job.data.organizationId ? { organizationId: job.data.organizationId } : {}),
          }
        : {
            signatureProviderId: { not: null },
            OR: [
              { signingNotificationPending: true },
              { docusealSubmissionId: { not: null }, signingStatus: { not: "completed" } },
            ],
          }
    const contracts = await getWorkerPrisma().contract.findMany({
      where,
      select: {
        id: true, title: true, organizationId: true, ownerId: true,
        status: true,
        docusealSubmissionId: true, signatureProviderId: true, signingStatus: true,
        signingNotificationPending: true, signingNotificationEvent: true,
      },
      take: job.data.contractId || job.data.submissionId ? 1 : 100,
    })

    const errors: string[] = []
    for (const contract of contracts) {
      try { await syncDocuSealContract(contract) }
      catch { logger.error({ contractId: contract.id }, "[signing] Failed to sync contract"); errors.push(contract.id) }
    }
    if (errors.length) throw new Error(`${errors.length} contract(s) failed to sync`)
  }, { connection })
  worker.on("completed", (job) => logger.info({ jobId: job.id }, "[signing] Job completed"))
  worker.on("failed", (job) => logger.error({ jobId: job?.id }, "[signing] Job failed"))
  return worker
}
