import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const readme = readFileSync(resolve(process.cwd(), "../../README.md"), "utf8")
const moduleMatrix = readFileSync(
  resolve(process.cwd(), "../../research/gates/phase-0-module-classification.md"),
  "utf8",
)

describe("Phase 0 public capability truth", () => {
  it("does not advertise paused authoring surfaces as available", () => {
    expect(readme).toContain("Track changes / redlining with version comparison | Later phase")
    expect(readme).toContain("Built-in clause snippet library (13 standard legal clauses) | Later phase")
    expect(readme).not.toContain("Track changes / redlining with version comparison | ✅")
    expect(readme).not.toContain("Built-in clause snippet library (13 standard legal clauses) | ✅")
  })

  it("labels non-core integrations as optional or later phase", () => {
    expect(readme).toContain("Slack & Microsoft Teams notifications | Optional")
    expect(readme).toContain("CRM sync — HubSpot, Salesforce, Pipedrive | Later phase")
    expect(readme).toContain("Bulk import — CSV, PandaDoc, DocuSign CLM, Google Drive | Later phase")
  })

  it("publishes all four Phase 0 investment postures", () => {
    for (const status of ["maintain", "security-only", "experimental", "retire-candidate"]) {
      expect(moduleMatrix).toContain(`**${status}**`)
    }
    expect(moduleMatrix).toContain("Complete product-subsystem matrix")
    expect(moduleMatrix).toContain("MCP / Agent Gateway")
    expect(moduleMatrix).toContain("Templates, authoring and clause studio")
  })
})
