import type { Page } from "@playwright/test"

// Better Auth 1.6's separate signup rule allows three requests, then requires
// ten seconds since the last accepted request. Keep that real protection on.
// The shared single-worker suite schedules requests; it never retries a failure.
export function createSignupBudget(
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
) {
  let count = 0
  let lastCompleted = Number.NEGATIVE_INFINITY
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(operation: () => Promise<T>): Promise<T> {
    const task = tail.then(async () => {
      if (now() - lastCompleted > 10_000) count = 0
      if (count >= 3) {
        await sleep(Math.max(0, lastCompleted + 10_001 - now()))
        count = 0
      }
      try {
        return await operation()
      } finally {
        count += 1
        lastCompleted = now()
      }
    })
    tail = task.catch(() => undefined)
    return task
  }
}

export const withSignupBudget = createSignupBudget()

export async function submitSignup(page: Page) {
  await withSignupBudget(async () => {
    const response = page.waitForResponse(result =>
      new URL(result.url()).pathname === "/api/auth/sign-up/email"
      && result.request().method() === "POST")
    await page.getByRole("button", { name: "Create account" }).click()
    await response
  })
}
