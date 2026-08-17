import { expect, test, type Page } from "@playwright/test"

async function expectResponsiveOnboarding(page: Page, uploadName: string) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error("A viewport is required for the responsive assertion")

  const upload = page.getByRole("link", { name: uploadName })
  await expect(upload).toBeVisible()
  const box = await upload.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

test("onboarding stays usable at mobile, desktop, and Arabic RTL widths", async ({
  page,
  baseURL,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E Onboarding Owner")
  await page.getByLabel("Email").fill(`onboarding-owner-${suffix}@example.com`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/create-org/, { timeout: 15_000 })

  await page.getByLabel("Organization name").fill(`E2E Onboarding ${suffix}`)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })

  await page.setViewportSize({ width: 320, height: 720 })
  await expectResponsiveOnboarding(page, "Upload a contract")

  await page.setViewportSize({ width: 1440, height: 900 })
  await expectResponsiveOnboarding(page, "Upload a contract")

  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "ar", url: baseURL ?? "http://localhost:3000" },
  ])
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  await page.setViewportSize({ width: 320, height: 720 })
  await expectResponsiveOnboarding(page, "تحميل عقد")
})
