import type { RequestContext } from "@/lib/context"

export function canReadContractText(ctx: RequestContext): boolean {
  return ctx.source === "session" || Boolean(ctx.scopes?.includes("text_read"))
}

/** Metadata-only keys must not receive arbitrary collaboration payloads. */
export function activityMetadata<T extends { id: string; action: unknown; createdAt?: unknown; contractId?: string; contractActionId?: string | null; user?: unknown; contract?: unknown }>(row: T) {
  return {
    id: row.id, contractId: row.contractId, contractActionId: row.contractActionId,
    action: row.action, createdAt: row.createdAt, user: row.user, contract: row.contract,
  }
}
