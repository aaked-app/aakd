import { expect, test } from "@playwright/test"
import { createTextPdf } from "./pdf-fixture"
import { submitSignup } from "./signup-budget"

for (const recovery of ["retry", "reload"] as const) {
  test(`a committed intake survives a lost response and ${recovery} without duplication`, async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await page.goto("/register")
    await page.getByLabel("Name").fill("Synthetic Intake Owner")
    await page.getByLabel("Email").fill(`intake-${suffix}@example.com`)
    await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
    await submitSignup(page)
    await expect(page).toHaveURL(/\/create-org/)
    await page.getByLabel("Organization name").fill(`Intake recovery ${suffix}`)
    await page.getByRole("button", { name: "Create organization" }).click()
    await expect(page).toHaveURL(/\/onboarding/)
    await page.getByRole("link", { name: "Skip for now" }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    const skip = page.getByRole("button", { name: "Skip", exact: true })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    const cookies = page.getByRole("button", { name: "Accept", exact: true })
    if (await cookies.isVisible().catch(() => false)) await cookies.click()

    await page.goto("/contracts/new")
    const original = createTextPdf([
      "SYNTHETIC INTAKE RECOVERY AGREEMENT",
      "The governing law is England and Wales.",
      "The supplier must provide a monthly service report.",
    ])
    await page.locator('input[type="file"]').setInputFiles({ name: "intake-recovery.pdf", mimeType: "application/pdf", buffer: original })
    await page.getByRole("button", { name: /continue to review/i }).click()
    await page.getByLabel(/contract title/i).fill("Reviewed recovery agreement")
    await page.getByLabel(/^governing law/i).fill("Deliberately removed")
    await page.getByLabel(/^governing law/i).fill("")

    let savedId: string | undefined
    await page.route(/\/api\/contracts\/intake$/, async route => {
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      savedId = (await response.json()).id
      // The server really committed. Drop only the response delivered to the
      // browser, reproducing a network disconnect after durable persistence.
      await route.abort("connectionfailed")
    }, { times: 1 })
    await page.getByRole("button", { name: /create contract/i }).click()
    await expect(page.getByRole("button", { name: "Retry the same save" })).toBeEnabled()
    expect(savedId).toBeTruthy()
    await expect(page.getByLabel(/contract title/i)).toBeDisabled()
    if (recovery === "retry") await page.getByRole("button", { name: "Retry the same save" }).click()
    else await page.reload()
    await expect(page).toHaveURL(new RegExp(`/contracts/${savedId}(?:\\?|$)`))

    const listing = await page.request.get("/api/contracts")
    expect(listing.status()).toBe(200)
    expect((await listing.json()).total).toBe(1)
    const detail = await page.request.get(`/api/contracts/${savedId}`)
    expect(detail.status()).toBe(200)
    const contract = await detail.json()
    expect(contract.title).toBe("Reviewed recovery agreement")
    expect(contract.files).toHaveLength(1)
    const download = await page.request.get(`/api/contracts/${savedId}/upload?fileId=${contract.files[0].id}&stream=1`)
    expect(download.status()).toBe(200)
    expect(Buffer.compare(await download.body(), original)).toBe(0)
    const facts = await page.request.get(`/api/contracts/${savedId}/extractions`)
    expect(facts.status()).toBe(200)
    expect((await facts.json()).extractions).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "governingLaw", rawValue: "", extractedBy: "manual", status: "accepted" }),
    ]))
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("aakd:intake:")).length)).toBe(0)

    if (recovery === "retry") {
      await page.goto(`/contracts/${savedId}?tab=documents`)
      await expect(page.getByRole("heading", { name: "File ledger" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Delete file" })).toHaveCount(0)
      await page.getByRole("button", { name: "Upload file", exact: true }).click()
      const dialog = page.getByRole("dialog")
      await dialog.locator('input[type="file"]').setInputFiles({ name: "not-submitted.pdf", mimeType: "application/pdf", buffer: original })
      await expect(dialog.getByRole("button", { name: "Upload", exact: true })).toBeEnabled()
      await dialog.getByRole("button", { name: "Clear selected file" }).click()
      await expect(dialog.getByRole("button", { name: "Upload", exact: true })).toBeDisabled()
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()

      const activated = await page.request.patch(`/api/contracts/${savedId}`, { data: { status: "ACTIVE" } })
      expect(activated.status()).toBe(200)
      await page.reload()
      await expect(page.getByRole("button", { name: "Upload file", exact: true })).toBeDisabled()
      const replacement = await page.request.post(`/api/contracts/${savedId}/upload`, {
        multipart: { file: { name: "blocked-replacement.pdf", mimeType: "application/pdf", buffer: original } },
      })
      expect(replacement.status()).toBe(422)
      const unchanged = await page.request.get(`/api/contracts/${savedId}`)
      expect(unchanged.status()).toBe(200)
      expect((await unchanged.json()).files).toHaveLength(1)
      const preserved = await page.request.get(`/api/contracts/${savedId}/upload?fileId=${contract.files[0].id}&stream=1`)
      expect(preserved.status()).toBe(200)
      expect(Buffer.compare(await preserved.body(), original)).toBe(0)
    }
  })
}
