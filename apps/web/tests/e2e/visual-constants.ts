import path from "node:path"

export const VISUAL_AUTH_STATE = path.join(
  process.cwd(),
  "test-results",
  ".auth",
  "owner.json",
)

export const VISUAL_NO_ORG_AUTH_STATE = path.join(
  process.cwd(),
  "test-results",
  ".auth",
  "no-organization.json",
)

export const VISUAL_FIXTURE_IDS = {
  organization: "e2e-visual-org",
  owner: "e2e-visual-user-owner",
  legal: "e2e-visual-user-legal",
  viewer: "e2e-visual-user-viewer",
  noOrganization: "e2e-visual-user-no-organization",
  ownerAccount: "e2e-visual-account-owner",
  ownerMember: "e2e-visual-member-owner",
  legalMember: "e2e-visual-member-legal",
  viewerMember: "e2e-visual-member-viewer",
  noOrganizationAccount: "e2e-visual-account-no-organization",
  contracts: [
    "e2e-visual-contract-northwind",
    "e2e-visual-contract-contoso",
    "e2e-visual-contract-fabrikam",
    "e2e-visual-contract-adventure",
    "e2e-visual-contract-tailspin",
    "e2e-visual-contract-woodgrove",
  ],
  obligations: [
    "e2e-visual-obligation-notice",
    "e2e-visual-obligation-report",
    "e2e-visual-obligation-security",
    "e2e-visual-obligation-insurance",
    "e2e-visual-obligation-renewal",
  ],
  actions: [
    "e2e-visual-action-notice",
    "e2e-visual-action-security",
  ],
  activities: [
    "e2e-visual-activity-northwind",
    "e2e-visual-activity-contoso",
    "e2e-visual-activity-fabrikam",
    "e2e-visual-activity-adventure",
    "e2e-visual-activity-tailspin",
    "e2e-visual-activity-woodgrove",
  ],
} as const

export const VISUAL_OWNER_EMAIL = "e2e-visual-owner@example.test"
export const VISUAL_NO_ORGANIZATION_EMAIL = "e2e-visual-no-organization@example.test"
