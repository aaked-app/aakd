import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ObligationList } from "@/components/obligations/obligation-list"

const translate = (key: string) => key
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => translate }))

const props = {
  contractId: "recovery-contract", obligations: [], members: [],
  contractArchived: false, role: "owner", hasContractFile: true,
  hasExtractedText: true, onChange: () => undefined,
}

beforeEach(() => {
  // Node 25 exposes an unavailable native localStorage unless explicitly
  // configured. Give this browser component an isolated Storage boundary.
  const values = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  } satisfies Storage)
})

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

describe("obligation extraction failure recovery", () => {
  it.each([401, 403, 404])("stops a denied %s poll instead of leaving the control loading", async status => {
    localStorage.setItem("obligation_extract_job_recovery-contract", "previous-job")
    let respond!: (response: Response) => void
    const pending = new Promise<Response>(resolve => { respond = resolve })
    vi.stubGlobal("fetch", vi.fn(() => pending))
    render(<ObligationList {...props} />)
    expect(screen.getByRole("button", { name: "extracting" })).toBeDisabled()
    await act(async () => { respond(Response.json({ error: "Not Found" }, { status })); await pending })
    await waitFor(() => expect(localStorage.getItem("obligation_extract_job_recovery-contract")).toBeNull())
    expect(screen.getByRole("button", { name: "extractWithAi" })).toBeEnabled()
  })

  it.each(["viewer", undefined])("does not start automatic extraction for read-only or unknown role %s", async role => {
    const fetch = vi.fn(async () => Response.json({ error: "Forbidden" }, { status: 403 }))
    vi.stubGlobal("fetch", fetch)
    await act(async () => { render(<ObligationList {...props} role={role} />) })
    expect(fetch).not.toHaveBeenCalled()
  })
})
