export function isTransactionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const value = error as { code?: unknown; meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } } }
  if (value.code === "P2034") return true
  return value.code === "P2010" && (
    value.meta?.code === "40001" || value.meta?.code === "40P01"
    || value.meta?.driverAdapterError?.cause?.originalCode === "40001"
    || value.meta?.driverAdapterError?.cause?.originalCode === "40P01"
  )
}

/** Retry only a complete database-only transaction, never external side effects. */
export async function withTransactionRetry<T>(transaction: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await transaction() } catch (error) {
      if (attempt >= 2 || !isTransactionConflict(error)) throw error
    }
  }
}
