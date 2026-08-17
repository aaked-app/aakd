import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const readme = readFileSync(resolve(process.cwd(), "../../README.md"), "utf8")
const moduleMatrix = readFileSync(
  resolve(process.cwd(), "../../research/gates/phase-0-module-classification.md"),
  "utf8",
)
const activationContract = readFileSync(
  resolve(process.cwd(), "../../research/gates/phase-0-activation-event-contract.md"),
  "utf8",
)
const securityChecklist = readFileSync(
  resolve(process.cwd(), "../../research/gates/phase-0-security-release-checklist.md"),
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

  it("documents every required activation milestone", () => {
    for (const event of [
      "workspace_created",
      "file_uploaded",
      "contract_fact_reviewed",
      "obligation_created",
      "obligation_completed",
      "`$pageview`",
      "/api/health",
    ]) {
      expect(activationContract).toContain(event)
    }
    expect(activationContract).toContain("No organization name, ID, email, or contract data")
  })

  it("publishes a security checklist with the core release boundaries", () => {
    for (const boundary of [
      "Tenant isolation",
      "MCP text access",
      "Upload handling",
      "AI safety",
      "SSO/SCIM",
      "Explicit non-claims",
    ]) {
      expect(securityChecklist).toContain(boundary)
    }
    expect(securityChecklist).toContain("Required recheck triggers")
  })
})
