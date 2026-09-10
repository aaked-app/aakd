import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { ContractAccessPanel } from "@/components/contract-access-panel"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import de from "@/messages/de.json"
import es from "@/messages/es.json"
import ar from "@/messages/ar.json"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("agreement access translations", () => {
  it.each(Object.entries({ en, fr, de, es, ar }))("renders real %s messages without missing namespaces", async (locale, messages) => {
    const errors = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ grants: [] }))
    vi.stubGlobal("fetch", fetchMock)
    render(<NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC" onError={errors}>
      <ContractAccessPanel contractId="synthetic-agreement" ownerId="owner" currentUserId="owner" currentRole="owner" members={[]} onOwnerChanged={vi.fn()} />
    </NextIntlClientProvider>)
    expect(await screen.findByRole("heading", { name: messages.contract.workspace.accessTitle })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
    expect(errors).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith("/api/contracts/synthetic-agreement/access")
  })
})
