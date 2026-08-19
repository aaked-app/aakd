import { expect, test } from "@playwright/test"

test("custom cloud model can be tested blank and keeps the created workspace", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  let testedRequest: Record<string, unknown> | undefined

  await page.route("**/api/org/ai-config/models", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ models: [] }),
    })
  })
  await page.route("**/api/org/ai-config/test", async (route) => {
    testedRequest = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ valid: true }),
    })
  })

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E AI Onboarding Owner")
  await page.getByLabel("Email").fill(`onboarding-ai-${suffix}@example.com`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/create-org/, { timeout: 15_000 })

  await page.getByLabel("Organization name").fill(`E2E AI Onboarding ${suffix}`)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })

  await page.locator("select#ai-model").selectOption("__custom__")
  await expect(page.locator("input#ai-model")).toBeVisible()
  await page.getByLabel("API key").fill("sk-ant-test")
  await page.getByRole("button", { name: "Test connection" }).click()

  await expect(page.getByRole("status")).toHaveText("Connection successful")
  await expect(page).toHaveURL(/\/onboarding/)
  expect(testedRequest).toEqual({ provider: "anthropic", apiKey: "sk-ant-test" })
})
