export type CrmProvider = "HUBSPOT" | "SALESFORCE" | "PIPEDRIVE"

export interface CrmDealSummary {
  id: string
  name: string
  stage: string
  value: number | null
  currency: string | null
  counterpartyName: string | null
  url: string | null
}

export interface CrmLinkData {
  id: string
  provider: CrmProvider
  externalDealId: string
  externalDealName: string
  externalDealUrl: string | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
}

export interface CrmIntegrationStatus {
  provider: CrmProvider
  connectedAt: string
  connectedBy: { name: string }
  portalId?: string | null
  instanceUrl?: string | null
  autoCreateStage?: string | null
  syncOnActiveStage?: string | null
}

export interface CrmStatusResponse {
  integrations: CrmIntegrationStatus[]
}

export const CRM_PROVIDERS: Array<{
  id: CrmProvider
  name: string
  description: string
}> = [
  {
    id: "HUBSPOT",
    name: "HubSpot",
    description: "Connect HubSpot to link deals and sync contract status.",
  },
  {
    id: "SALESFORCE",
    name: "Salesforce",
    description: "Connect Salesforce to link opportunities and sync contract status.",
  },
  {
    id: "PIPEDRIVE",
    name: "Pipedrive",
    description: "Connect Pipedrive to link deals and sync contract status.",
  },
]
