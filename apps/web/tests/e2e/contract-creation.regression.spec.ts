import { expect, test } from "@playwright/test"

test("new users can create and open a contract", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E Contract Owner")
  await page.getByLabel("Email").fill(`contract-owner-${suffix}@example.test`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/create-org/)

  await page.getByLabel("Organization name").fill(`E2E Contracts ${suffix}`)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole("link", { name: "Skip for now" }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  const tourSkip = page.getByRole("button", { name: "Skip", exact: true })
  if (await tourSkip.isVisible().catch(() => false)) await tourSkip.click()
  const acceptCookies = page.getByRole("button", { name: "Accept", exact: true })
  if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click()

  // The command palette also exposes a hidden "New Contract" action. Target
  // the visible dashboard link a customer actually clicks.
  await page.locator('a[href="/contracts/new"]:visible').first().click()
  await expect(page).toHaveURL(/\/contracts\/new/)
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-service-agreement.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\\n1 0 obj\\n<< /Type /Catalog >>\\nendobj\\ntrailer\\n<<>>\\n%%EOF\\n"),
  })
  await page.getByRole("button", { name: /analyze with ai/i }).click()
  await page.getByLabel(/contract title/i).waitFor()
  await page.getByLabel(/contract title/i).fill("E2E Service Agreement")
  await page.getByRole("button", { name: "Create Contract", exact: true }).click()

  await expect(page).toHaveURL((url) =>
    /^\/contracts\/[a-z0-9]+$/.test(url.pathname) && url.pathname !== "/contracts/new",
  )
})
