import { afterEach, describe, expect, it } from "vitest"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

describe("Action Ledger UI feature flag", () => {
  afterEach(() => delete process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED)

  it("is disabled by default and only enables for the exact value true", () => {
    expect(isActionLedgerUiEnabled()).toBe(false)
    process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED = "TRUE"
    expect(isActionLedgerUiEnabled()).toBe(false)
    process.env.NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED = "true"
    expect(isActionLedgerUiEnabled()).toBe(true)
  })
})
