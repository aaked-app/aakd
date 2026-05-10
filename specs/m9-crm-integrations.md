# M9 — CRM Integrations

## Problem

Contracts don't live in a vacuum — they originate from sales deals. Today ClauseFlow users must manually copy deal data (counterparty, value, type) into a new contract. When a contract is signed, the sales rep must manually update the deal stage. This two-system friction causes missed updates, stale CRM records, and deals closed without proper contracts.

---

## Proposed Solution

Bidirectional integration with three CRM providers:

1. **Manual link** — attach an existing ClauseFlow contract to a CRM deal (HubSpot / Salesforce / Pipedrive).
2. **Auto-create** — when a CRM deal reaches a configured stage, automatically create a contract in ClauseFlow pre-populated with deal data.
3. **Status sync** — when a contract status changes (especially `ACTIVE` after signing), push an update to the linked CRM deal.

---

## Success Criteria

- An admin can connect a HubSpot, Salesforce, or Pipedrive org to ClauseFlow in under 2 minutes via OAuth.
- A linked contract shows a "CRM Deal" card on its detail page (deal name, stage, CRM link).
- When a linked contract moves to `ACTIVE` status, the CRM deal stage is updated (to the configured target stage).
- Auto-create: a CRM webhook arriving with a deal at the trigger stage creates a draft contract within 10 seconds.
- Org isolation: CRM tokens and links are strictly per-org; no cross-org leakage.
- Disconnecting a CRM removes tokens from the database immediately.

---

## Scope

**IN:**
- `CrmIntegration` model — per-org, per-provider OAuth token storage
- `CrmLink` model — links a single contract to a single CRM deal
- OAuth connect/disconnect for HubSpot, Salesforce, Pipedrive
- `GET /api/crm/[provider]/connect` — initiates OAuth
- `GET /api/crm/[provider]/callback` — OAuth callback, stores tokens
- `DELETE /api/crm/[provider]/connect` — disconnect (revoke + delete tokens)
- `GET /api/crm/[provider]/deals` — search/list deals (for manual link UI)
- `POST /api/contracts/[id]/crm-link` — link contract to a deal
- `DELETE /api/contracts/[id]/crm-link/[linkId]` — unlink
- `POST /api/crm/[provider]/webhook` — receive CRM webhooks (deal stage change → auto-create or sync)
- `GET /api/crm/[provider]/sync/[contractId]` — manual sync trigger
- Activity log entries: `CRM_LINKED`, `CRM_UNLINKED`, `CRM_SYNCED`
- Settings page: `/settings/integrations` — connect/disconnect each provider
- Contract detail: "CRM" section in the right sidebar (shows linked deal, link/unlink action)
- Nav link: "Integrations" in settings sidebar

**OUT:**
- Custom field mapping UI (hard-coded sensible defaults only) — post-launch
- Multiple CRM links per contract (max 1 per provider, max 3 total) — v1 limit
- CRM-to-ClauseFlow field sync (pull deal updates → update contract fields) — post-launch
- CRM contact sync — post-launch
- CRM reporting / embedded CRM analytics — post-launch
- CRM integrations in the MCP server — post-launch

---

## Environment Variables (app-level, set by the self-hoster)

```bash
# HubSpot
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_APP_ID=           # required for webhook subscriptions

# Salesforce
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=

# Pipedrive
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
```

These are **app-level** (one set per ClauseFlow deployment, not per-org). Each org's OAuth tokens are stored in `CrmIntegration`. Self-hosters must create their own OAuth app in each CRM developer portal.

OAuth redirect URI pattern: `{NEXT_PUBLIC_APP_URL}/api/crm/[provider]/callback`

---

## Data Model

### `CrmIntegration`

```prisma
model CrmIntegration {
  id             String      @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  provider       CrmProvider  // HUBSPOT | SALESFORCE | PIPEDRIVE
  accessToken    String       // encrypted with NOTIFICATION_ENCRYPTION_KEY (AES-256-GCM, same util as M5)
  refreshToken   String?      // encrypted
  tokenExpiresAt DateTime?
  instanceUrl    String?      // Salesforce only: "https://na1.salesforce.com"
  portalId       String?      // HubSpot only: numeric portal/account ID (stored as string)

  // Optional: user-configured sync settings
  autoCreateStage   String?   // CRM deal stage name/id that triggers auto-create
  syncOnActiveStage String?   // CRM deal stage to set when contract becomes ACTIVE (default: "Closed Won")

  connectedById  String
  connectedBy    User         @relation("CrmIntegrationConnectedBy", fields: [connectedById], references: [id])

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  links          CrmLink[]

  @@unique([organizationId, provider])
  @@index([organizationId])
}

enum CrmProvider {
  HUBSPOT
  SALESFORCE
  PIPEDRIVE
}
```

Add `crmIntegrations CrmIntegration[]` to `Organization`.
Add `crmIntegrationsConnected CrmIntegration[]  @relation("CrmIntegrationConnectedBy")` to `User`.

### `CrmLink`

```prisma
model CrmLink {
  id               String         @id @default(cuid())
  contractId       String
  contract         Contract       @relation(fields: [contractId], references: [id], onDelete: Cascade)
  integrationId    String
  integration      CrmIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  provider         CrmProvider    // denormalized for fast queries without join
  externalDealId   String         // deal/opportunity ID in the CRM
  externalDealName String         // deal name at time of link (cached)
  externalDealUrl  String?        // direct link to deal in CRM UI

  lastSyncedAt     DateTime?
  lastSyncStatus   String?        // "success" | "error" | error message

  createdById      String
  createdBy        User           @relation("CrmLinkCreator", fields: [createdById], references: [id])
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@unique([contractId, integrationId])   // one link per contract per CRM
  @@index([contractId])
  @@index([integrationId])
  @@index([provider, externalDealId])     // lookup by external ID for webhook handling
}
```

Add `crmLinks CrmLink[]` to `Contract`.
Add `crmLinksCreated CrmLink[] @relation("CrmLinkCreator")` to `User`.

**`CrmLink` is NOT in `ORG_SCOPED_MODELS`** — it's scoped indirectly via `contract → organizationId`. `CrmIntegration` IS in `ORG_SCOPED_MODELS` (has direct `organizationId`).

### ActivityAction additions

```prisma
  CRM_LINKED
  CRM_UNLINKED
  CRM_SYNCED
```

---

## Provider Interface

All three providers implement this shared interface in `lib/crm/`:

```typescript
// lib/crm/provider.ts
export interface DealSummary {
  id: string
  name: string
  stage: string
  value: number | null   // in the CRM's native currency unit
  currency: string | null
  counterpartyName: string | null   // company/account name
  url: string | null
}

export interface CrmProvider {
  /** Exchange auth code for tokens. Returns accessToken, refreshToken?, expiresAt?, instanceUrl? */
  exchangeCode(code: string): Promise<TokenSet>

  /** Refresh access token using stored refreshToken. Returns new TokenSet. */
  refreshAccessToken(integration: CrmIntegration): Promise<TokenSet>

  /** Search/list deals matching a query string. Max 20 results. */
  searchDeals(integration: CrmIntegration, query: string): Promise<DealSummary[]>

  /** Fetch a single deal by its external ID. */
  getDeal(integration: CrmIntegration, dealId: string): Promise<DealSummary | null>

  /** Update the deal's stage. stageName is the human-readable stage (we map per-provider). */
  updateDealStage(integration: CrmIntegration, dealId: string, stageName: string): Promise<void>

  /** Register a webhook subscription for deal stage changes. Returns the subscription ID. */
  registerWebhook(integration: CrmIntegration, targetUrl: string): Promise<string>

  /** Verify an incoming webhook request is legitimate. Returns parsed deal event or null. */
  parseWebhookEvent(req: Request, integration: CrmIntegration): Promise<DealEvent | null>
}

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  instanceUrl?: string   // Salesforce only
  portalId?: string      // HubSpot only
}

export interface DealEvent {
  dealId: string
  dealName: string
  stage: string
  value: number | null
  currency: string | null
  counterpartyName: string | null
  eventType: "created" | "stage_changed" | "updated"
}
```

Files:
- `lib/crm/provider.ts` — interface definitions above
- `lib/crm/hubspot.ts` — HubSpot implementation
- `lib/crm/salesforce.ts` — Salesforce implementation
- `lib/crm/pipedrive.ts` — Pipedrive implementation
- `lib/crm/index.ts` — factory: `getCrmProvider(provider: CrmProvider): CrmProvider`
- `lib/crm/crypto.ts` — token encrypt/decrypt (reuse M5's `encryptSecret`/`decryptSecret` from `lib/notifications/crypto.ts`)

---

## API Endpoints

All routes require `resolveAuth(req)`. Return 401 if null. Return 404 (not 403) for cross-org resources.

### OAuth

**`GET /api/crm/[provider]/connect`**
- Role: `admin` only
- Generates OAuth state (signed HMAC with `BETTER_AUTH_SECRET`, includes `orgId + userId + provider`)
- Stores state in a short-lived (10 min) HTTP-only cookie: `crm_oauth_state`
- Redirects to CRM's OAuth authorization URL

**`GET /api/crm/[provider]/callback`**
- No auth check — called by CRM during OAuth flow
- Validates state cookie + HMAC, extracts orgId + userId
- Calls `provider.exchangeCode(code)` 
- Encrypts tokens with AES-256-GCM (same key as M5: `NOTIFICATION_ENCRYPTION_KEY`)
- Upserts `CrmIntegration` record
- Clears state cookie
- Redirects to `/settings/integrations?connected=[provider]`

**`DELETE /api/crm/[provider]/connect`**
- Role: `admin` only
- Hard-deletes `CrmIntegration` record (cascades → all CrmLinks for this provider)
- Response 204

### Deal Search (for manual link UI)

**`GET /api/crm/[provider]/deals?q=[query]`**
- Role: any member (read-only)
- Calls `provider.searchDeals(integration, query)`, refreshing token first if expired
- Returns `{ deals: DealSummary[] }` — max 20 results
- 404 if no `CrmIntegration` for this org + provider

### Links

**`POST /api/contracts/[id]/crm-link`**
- Role: `admin`, `legal`, `member`
- Body: `z.object({ provider: z.enum(["HUBSPOT", "SALESFORCE", "PIPEDRIVE"]), externalDealId: z.string().min(1) })`
- Validates contract belongs to org
- Looks up integration for this org + provider (404 if not connected)
- Calls `provider.getDeal(integration, externalDealId)` to get current deal name/url
- Enforces max 1 link per provider per contract (422 `{ error: "already_linked" }` if duplicate)
- Creates `CrmLink`
- Writes `CRM_LINKED` activity
- Response 201: `{ link: CrmLink }`

**`DELETE /api/contracts/[id]/crm-link/[linkId]`**
- Role: `admin`, `legal`
- Hard-deletes the link
- Writes `CRM_UNLINKED` activity
- Response 204

**`GET /api/contracts/[id]/crm-link`**
- Role: any member including viewer
- Returns `{ links: CrmLink[] }` — all CRM links for this contract (max 3)

### Manual Sync

**`POST /api/crm/[provider]/sync/[contractId]`**
- Role: `admin`, `legal`
- Triggers immediate sync: reads current contract status, updates linked deal stage
- Updates `lastSyncedAt` + `lastSyncStatus` on `CrmLink`
- Response 200: `{ synced: true, stage: string }`

### Webhook Receiver

**`POST /api/crm/[provider]/webhook`**
- No auth — public endpoint (verified by provider signature)
- Calls `provider.parseWebhookEvent(req, integration)` — returns null if invalid signature
- On valid event:
  1. Look up `CrmLink` by `(provider, externalDealId)` — if found: update `externalDealName` + `lastSyncedAt`
  2. If `integration.autoCreateStage` is set AND event.stage matches AND no existing link: auto-create a draft contract + link it
  3. If event is a stage change and a link exists: log to activity (do NOT auto-update contract status from CRM — CLM is the system of record for status)
- Response always 200 (CRMs retry on non-200)

---

## Sync Logic: Contract → CRM

Sync is **one-directional: ClauseFlow is the system of record.** CRM deal stages are updated by ClauseFlow, never the reverse.

Trigger: in `worker.ts`, add a handler for the `contract.signed` / `contract.status_changed` event queue (or hook into the existing activity write for status changes).

Actually, implement sync inline in the `PATCH /api/contracts/[id]` route rather than via a BullMQ job — contracts change status infrequently (unlike notifications which need fan-out to many recipients). This keeps it simple:

```typescript
// After updating contract status to ACTIVE/EXPIRED/TERMINATED/ARCHIVED:
if (newStatus === "ACTIVE") {
  const links = await prisma.crmLink.findMany({ where: { contractId }, include: { integration: true } })
  for (const link of links) {
    const provider = getCrmProvider(link.provider)
    const targetStage = link.integration.syncOnActiveStage ?? defaultStageForProvider(link.provider)
    await provider.updateDealStage(link.integration, link.externalDealId, targetStage).catch(err => {
      // Non-fatal — log and update lastSyncStatus
      console.error(`[crm] sync failed for link ${link.id}:`, err)
    })
    await prisma.crmLink.update({ where: { id: link.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: "success" } })
  }
}
```

Default target stage per provider (when `syncOnActiveStage` is not configured):
- HubSpot: `"closedwon"`
- Salesforce: `"Closed Won"`
- Pipedrive: `"Won"`

---

## Provider Implementation Details

### HubSpot (`lib/crm/hubspot.ts`)

- OAuth scopes: `crm.objects.deals.read crm.objects.deals.write oauth`
- Authorization URL: `https://app.hubspot.com/oauth/authorize`
- Token URL: `https://api.hubapi.com/oauth/v1/token`
- Token refresh: POST to token URL with `grant_type=refresh_token`
- Deal search: `GET https://api.hubapi.com/crm/v3/objects/deals/search` with filters on `dealname` containing query
- Deal get: `GET https://api.hubapi.com/crm/v3/objects/deals/{dealId}?properties=dealname,dealstage,amount,currency`
- Stage update: `PATCH https://api.hubapi.com/crm/v3/objects/deals/{dealId}` with `{ properties: { dealstage: stageName } }`
- Deal URL: `https://app.hubspot.com/contacts/{portalId}/deal/{dealId}`
- Webhook: HubSpot sends signed webhooks via `X-HubSpot-Signature-v3`. Verify with HMAC-SHA256 using `HUBSPOT_CLIENT_SECRET`. Register via `POST https://api.hubapi.com/webhooks/v3/{HUBSPOT_APP_ID}/subscriptions` subscribing to `deal.propertyChange` for `dealstage`.
- Counterparty: fetch associated company name via `GET /crm/v3/objects/deals/{dealId}/associations/companies`

### Salesforce (`lib/crm/salesforce.ts`)

- OAuth scopes: `api refresh_token`
- Authorization URL: `https://login.salesforce.com/services/oauth2/authorize`
- Token URL: `https://login.salesforce.com/services/oauth2/token`
- All API calls use `instanceUrl` from token response (e.g. `https://na1.salesforce.com`)
- Deal search: SOQL `SELECT Id, Name, StageName, Amount, CurrencyIsoCode, Account.Name FROM Opportunity WHERE Name LIKE '%{query}%' LIMIT 20`
- Stage update: PATCH `{instanceUrl}/services/data/v60.0/sobjects/Opportunity/{dealId}` with `{ StageName: stageName }`
- Deal URL: `{instanceUrl}/{dealId}`
- Webhook: Salesforce uses Outbound Messages (SOAP) or Platform Events. For simplicity in v1: use polling via a BullMQ repeatable job (`crm.salesforce.poll`) every 15 minutes to check Opportunity `LastModifiedDate` for linked deals. Register no webhook subscription — just poll. (True webhook via Connected App requires extra setup.)
- Note: Salesforce polling only, not real-time webhook. Real-time via Platform Events is post-launch.

### Pipedrive (`lib/crm/pipedrive.ts`)

- OAuth scopes: `deals:read deals:write`
- Authorization URL: `https://oauth.pipedrive.com/oauth/authorize`
- Token URL: `https://oauth.pipedrive.com/oauth/token`
- Base URL: `https://api.pipedrive.com/v1`
- Deal search: `GET /v1/deals/search?term={query}&fields=title&limit=20`
- Deal get: `GET /v1/deals/{dealId}` — fields: `title`, `stage_id`, `value`, `currency`, `org_name`
- Stage update: `PUT /v1/deals/{dealId}` with `{ stage_id: stageId }` (need to map stage name → stage ID first via `GET /v1/stages?pipeline_id=...`)
- Deal URL: `https://app.pipedrive.com/deal/{dealId}`
- Webhook: Pipedrive supports webhooks via `POST /v1/webhooks` subscribing to `event_action=changed` + `event_object=deal`. Signature: `X-Pipedrive-Signature` header, HMAC-SHA256 with `PIPEDRIVE_CLIENT_SECRET`.
- Counterparty: `org_name` from deal object

---

## UI

### Settings page: `/settings/integrations`

New route in settings sidebar.

Three provider cards, each showing:
- Provider logo + name
- Status: `Connected (last synced: [date])` or `Not connected`
- `Connect` button (→ OAuth flow) or `Disconnect` button (with confirm dialog)
- When connected: show which ClauseFlow user connected it + when

**Disconnect confirm dialog:** "Disconnecting will remove all deal links for this integration. Existing contracts are not affected."

### Contract detail: CRM section

Add a "CRM" section to the right sidebar of `/contracts/[id]` (below the existing metadata cards).

**When no links:**
- `"Link to CRM deal"` button → opens a popover/dialog
- Dialog: provider selector tabs (HubSpot | Salesforce | Pipedrive), search box, deal list (name + stage + value), "Link" button
- Only shows providers that are connected for this org

**When 1+ links exist:**
- Card per link: provider icon, deal name (clickable → CRM URL), stage badge, last synced timestamp
- "Unlink" button (admin/legal only)
- "Sync now" button (admin/legal only)

---

## Sidebar Navigation

Add "Integrations" to the settings sidebar in `app/(app)/settings/layout.tsx`:

```typescript
{ href: "/settings/integrations", label: "Integrations", icon: Plug2 }  // Plug2 from lucide-react
```

Position: after "Members", before "API Keys".

---

## Implementation Order

1. Prisma: `CrmIntegration`, `CrmLink` models + migration (`20260510120000_m9_crm`)
2. `lib/crm/crypto.ts` — re-export `encryptSecret`/`decryptSecret` from M5 crypto
3. `lib/crm/provider.ts` — interface types
4. `lib/crm/hubspot.ts` — full HubSpot implementation
5. `lib/crm/salesforce.ts` — full Salesforce implementation (polling, not webhook)
6. `lib/crm/pipedrive.ts` — full Pipedrive implementation
7. `lib/crm/index.ts` — factory function
8. Add `CrmIntegration` to `ORG_SCOPED_MODELS` in `lib/db/client.ts`
9. API: OAuth connect/callback/disconnect (`/api/crm/[provider]/connect`, `/callback`, DELETE)
10. API: Deal search (`/api/crm/[provider]/deals`)
11. API: Links (`/api/contracts/[id]/crm-link`)
12. API: Webhook receiver (`/api/crm/[provider]/webhook`)
13. API: Manual sync (`/api/crm/[provider]/sync/[contractId]`)
14. Sync hook in `PATCH /api/contracts/[id]` (status → CRM stage update)
15. Salesforce poll cron in `worker.ts` (`crm.salesforce.poll`, every 15 minutes)
16. UI: `/settings/integrations` page
17. UI: CRM section on contract detail sidebar
18. Nav: "Integrations" in settings sidebar

---

## Open Questions

None. All decisions resolved:

- **Which direction is system of record:** ClauseFlow is source of truth for contract status. CRM stages are updated by ClauseFlow, never the reverse.
- **Token encryption:** Same `NOTIFICATION_ENCRYPTION_KEY` + AES-256-GCM from M5. No new env var.
- **Salesforce webhook vs. poll:** Poll every 15 minutes for v1. True webhook (Platform Events) requires extra Salesforce setup — post-launch.
- **Max links per contract:** 1 per provider (max 3 total = one per CRM). Enforced by `@@unique([contractId, integrationId])`.
- **Auto-create trigger:** CRM webhook delivers deal at configured stage → creates DRAFT contract. Admin configures stage name in integration settings (stored in `autoCreateStage`).
- **Sync target stage defaults:** HubSpot `"closedwon"`, Salesforce `"Closed Won"`, Pipedrive `"Won"`. Overridable via `syncOnActiveStage` field.
- **OAuth state security:** Signed HMAC + 10-minute expiry HTTP-only cookie. No DB storage needed.
- **App-level OAuth credentials:** Self-hosters create their own OAuth app in each CRM. Credentials in env vars (not per-org). This is consistent with how most self-hosted tools handle CRM OAuth.
- **Pipedrive stage mapping:** Pipedrive uses stage IDs not names. We map "Won" → fetch stages → find matching ID. If no match, log warning and skip.
- **Token refresh:** Done inline before any API call if `tokenExpiresAt < now + 5 minutes`. No background refresh job.
