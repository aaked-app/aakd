import { describe, expect, it, vi } from "vitest"
import { isTransactionConflict, withTransactionRetry } from "@/lib/db/transaction-retry"

describe("database transaction conflict retry", () => {
  it.each([
    { code: "P2034" },
    { code: "P2010", meta: { code: "40001" } },
    { code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40001" } } } },
    { code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40P01" } } } },
  ])("restarts the whole transaction and reauthorizes after %j", async conflict => {
    const run = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce({ authorized: false })
    await expect(withTransactionRetry(run)).resolves.toEqual({ authorized: false })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("stops after three attempts", async () => {
    const conflict = { code: "P2034" }
    const run = vi.fn().mockRejectedValue(conflict)
    await expect(withTransactionRetry(run)).rejects.toBe(conflict)
    expect(run).toHaveBeenCalledTimes(3)
  })

  it.each([null, "40001", new Error("40001 secret marker"), { code: "P2002" }, { code: "P2010", meta: { code: "23505" } }])("never retries unrelated or ambiguous failures %j", async error => {
    const run = vi.fn().mockRejectedValue(error)
    expect(isTransactionConflict(error)).toBe(false)
    await expect(withTransactionRetry(run)).rejects.toBe(error)
    expect(run).toHaveBeenCalledOnce()
  })
})
