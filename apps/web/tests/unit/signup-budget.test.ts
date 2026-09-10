import { describe, expect, it, vi } from "vitest"
import { createSignupBudget } from "../e2e/signup-budget"

describe("signup test request budget", () => {
  it("allows three requests and spaces the fourth after the last response", async () => {
    let time = 0
    const sleep = vi.fn(async (ms: number) => { time += ms })
    const budget = createSignupBudget(() => time, sleep)
    const calls: number[] = []
    const run = () => budget(async () => { calls.push(time); time += 200; return "ok" })
    await Promise.all([run(), run(), run(), run()])
    expect(calls).toEqual([0, 200, 400, 10_601])
    expect(sleep).toHaveBeenCalledExactlyOnceWith(10_001)
  })

  it("does not wait when the natural idle interval already reset the rule", async () => {
    let time = 0
    const sleep = vi.fn(async () => undefined)
    const budget = createSignupBudget(() => time, sleep)
    for (let i = 0; i < 3; i++) await budget(async () => undefined)
    time = 10_001
    await budget(async () => undefined)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("surfaces a failed operation once without retrying or poisoning the queue", async () => {
    const budget = createSignupBudget(() => 0, async () => undefined)
    const operation = vi.fn(async () => { throw new Error("signup failed") })
    await expect(budget(operation)).rejects.toThrow("signup failed")
    expect(operation).toHaveBeenCalledTimes(1)
    await expect(budget(async () => "next")).resolves.toBe("next")
  })
})
