import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"

type SourceFileIdentity = { id: string; version: number }

type StoredSourceBinding = {
  extractedText: string | null
  extractedSourceFileId: string | null
  extractedSourceFileVersion: number | null
  extractedSourceHash: string | null
}

type AgentActionSourceBinding = {
  proposedByPrincipalType: string | null
  sourceFileId: string | null
  sourceFileVersion: number | null
  sourceHash: string | null
}

export function extractedTextHash(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export function extractedSourceBinding(file: SourceFileIdentity, extractedText: string) {
  return {
    extractedSourceFileId: file.id,
    extractedSourceFileVersion: file.version,
    extractedSourceHash: extractedTextHash(extractedText),
  }
}

export function clearExtractedSourceBinding() {
  return {
    extractedSourceFileId: null,
    extractedSourceFileVersion: null,
    extractedSourceHash: null,
  }
}

export function hasExactExtractedSourceBinding(
  contract: StoredSourceBinding,
  file: SourceFileIdentity,
): boolean {
  return Boolean(
    contract.extractedText
      && contract.extractedSourceFileId === file.id
      && contract.extractedSourceFileVersion === file.version
      && contract.extractedSourceHash === extractedTextHash(contract.extractedText),
  )
}

export function hasCurrentAgentActionSource(
  action: AgentActionSourceBinding,
  contract: StoredSourceBinding,
  file: SourceFileIdentity | null | undefined,
): boolean {
  if (!action.proposedByPrincipalType) return true
  return Boolean(
    file
      && action.sourceFileId === file.id
      && action.sourceFileVersion === file.version
      && action.sourceHash === contract.extractedSourceHash
      && hasExactExtractedSourceBinding(contract, file),
  )
}

export function didBoundExtractedSourceChange(
  previous: Pick<StoredSourceBinding, "extractedSourceFileId" | "extractedSourceFileVersion" | "extractedSourceHash">,
  next: ReturnType<typeof extractedSourceBinding>,
): boolean {
  return previous.extractedSourceFileId !== null && (
    previous.extractedSourceFileId !== next.extractedSourceFileId
    || previous.extractedSourceFileVersion !== next.extractedSourceFileVersion
    || previous.extractedSourceHash !== next.extractedSourceHash
  )
}

/** Invalidate only live agent-authored actions whose cited file is no longer canonical. */
export async function invalidateAgentActionsForSourceChange(
  db: Pick<Prisma.TransactionClient, "contractAction">,
  organizationId: string,
  contractId: string,
) {
  return db.contractAction.updateMany({
    where: {
      organizationId,
      contractId,
      proposedByPrincipalType: { not: null },
      status: { notIn: ["COMPLETED", "DISMISSED", "STALE"] },
    },
    data: { status: "STALE", staleAt: new Date(), version: { increment: 1 } },
  })
}
