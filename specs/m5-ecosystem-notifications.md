# M5 — Ecosystem: Notifications

## Problem

ClauseFlow fires notifications for only two events: renewal alerts (email + env-level Slack/Teams webhooks) and approval requests (email only). Every other contract lifecycle event is silent.

This is the single biggest adoption blocker for our ICP. Reddit CLM research (r/procurement, r/legaltech — 10 threads, 2026-05-09) found that **ecosystem integration is the primary reason teams choose a CLM tool** — not the editor, not the analytics. Summize was repeatedly cited as the winner because *"anyone in Sales, Legal, Procurement, or Finance can self-serve without leaving the tools they already use."* That model requires full event coverage across every channel people already live in.

Concrete gaps today:
- Teams using Slack/Teams learn about approvals, signings, and expirations only by polling the UI.
- There is no way for orgs to connect ClauseFlow to external tools (Zapier, Make, custom systems) without writing custom polling code against the API.
- User-level control over which events trigger an email does not exist — it is all or nothing, driven by env vars rather than per-org or per-user preference.
- Email notifications lack actionable structure — no CTA button, no metadata, no unsubscribe.

M5 fixes all four gaps.

---

## Proposed Solution

1. **Full event coverage** — every contract lifecycle state change fires a structured internal event that fans out to all configured channels (email, Slack, Teams, outbound webhooks).
2. **Org-level outbound webhooks** — orgs register their own webhook endpoints in the UI. All lifecycle events are delivered there with an HMAC-signed standard envelope.
3. **User-level email preferences** — members opt in/out of individual event types via a settings page. No event is on by default except `approval.requested` (for the assignee) and `contract.expiring_soon` / `contract.expired` (for the owner and org admins).
4. **Zapier/Make readiness** — outbound webhooks are the full technical foundation. No Zapier app is published in M5. A `docs/zapier-integration.md` artifact describes the trigger/action definitions a future Zapier app would need.
5. **Slack/Teams channel config moves to org settings** — env-var Slack/Teams URLs remain supported for self-hosted backward compat, but orgs can now override them via DB config. Priority: DB config > env var.
6. **Rich actionable emails** — all email notifications use a structured HTML template with a "View Contract" CTA button, event-specific metadata rows, and a one-click unsubscribe footer. Delivered via Nodemailer to any inbox — Outlook, Gmail, or any other mail client.

---

## Success Criteria

- All 10 event types fire to every configured channel within 30 seconds of the triggering action completing (P95, measured in delivery log).
- An org with 3 registered outbound webhooks receives all 3 deliveries for a single event, each with a valid HMAC-SHA256 `X-ClauseFlow-Signature` header.
- A user who has disabled `contract.uploaded` in their email preferences does not receive that email, but still receives `approval.requested` if they are the assignee.
- Failed webhook deliveries are retried exactly 3 times with exponential backoff (10 s, 30 s, 90 s). After 3 failures the delivery log entry is marked `failed` and no further retries occur.
- The org isolation test continues to pass: org B's webhooks never receive events from org A.
- Email notifications render correctly (CTA button, metadata rows, unsubscribe footer) in Outlook 365 and Gmail web.

---

## Event Catalogue

These are the canonical event name strings used in every payload, queue job, and DB log record. No other strings are valid.

| Event name | Trigger | Default email recipients |
|---|---|---|
| `contract.uploaded` | File attached to contract (`POST /api/contracts/[id]/upload`) | Owner |
| `contract.extracted` | AI extraction job completes (`contract.ai_extract` worker) | Owner |
| `approval.requested` | Approval record created (`POST /api/contracts/[id]/approvals`) | Assignee |
| `approval.approved` | Approval status set to `approved` | Requester + Owner |
| `approval.rejected` | Approval status set to `rejected` | Requester + Owner |
| `contract.sent_for_signing` | Contract status set to `AWAITING_SIGNATURE` | Owner |
| `contract.signed` | Signing sync worker marks contract signed | Owner |
| `contract.expiring_soon` | `alerts.check` cron fires EXPIRY_7 / EXPIRY_30 / EXPIRY_90 | Owner + org admins |
| `contract.expired` | `alerts.check` cron fires after `endDate` passes | Owner + org admins |
| `contract.archived` | Contract status set to `ARCHIVED` | Owner |

`contract.expiring_soon` is the fan-out layer representation of existing EXPIRY alert types. The existing `ContractAlert` model and its `emailSentAt` stamp are kept unchanged. The fan-out layer runs in addition to it, not instead of it. Guard: check `ContractAlert.firedAt IS NOT NULL` before enqueuing the fanout job to prevent double-fire.

---

## Scope

**IN:**
- All 10 event types above, firing to email + Slack + Teams + outbound webhooks
- Org-level outbound webhook registration (CRUD), HMAC signing, delivery log, retry
- User-level email notification preferences (per-event opt-in, stored per org membership)
- Slack/Teams channel config migrated to org settings DB table (env vars kept as fallback)
- `notification.fanout` and `notification.deliver` BullMQ queues (new)
- `email.send` queue extended with `event_notification` job kind
- Rich HTML email template with CTA button, metadata rows, and one-click unsubscribe footer
- `docs/zapier-integration.md` artifact describing trigger/action definitions for future Zapier/Make app

**OUT (not in M5):**
- Outlook Add-in / Gmail Add-on (sidebar inside email client) — deferred to a future milestone; email notifications already land in Outlook/Gmail inboxes
- Slack app with slash commands, interactive components, or OAuth installation flow
- In-app notification bell / notification centre UI
- Per-contract notification overrides (subscribe/unsubscribe on a single contract)
- Webhook event filtering per endpoint (all events or nothing in M5)
- Digest / batched email (one email per event in M5)
- SMS or push notifications
- Zapier app submission or Make.com connector publication
- Teams app or bot installation
- Notification history visible in the UI (delivery log is DB-only in M5)
- Webhook IP allowlisting
- `responseBody` visible in delivery log UI (stored in DB only)

---

## Data Model Changes

### 1. `OrgNotificationChannel` — Slack/Teams URLs per org

```prisma
model OrgNotificationChannel {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  channelType    String       // "slack" | "teams"
  webhookUrl     String       // AES-256-GCM encrypted at rest
  label          String       // max 100 chars
  enabled        Boolean      @default(true)
  createdById    String
  createdBy      User         @relation(fields: [createdById], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}
```

**Encryption note:** `webhookUrl` (and `OutboundWebhook.url` and `OutboundWebhook.signingSecret`) are encrypted with AES-256-GCM using `NOTIFICATION_ENCRYPTION_KEY` (a 64-char hex string representing 32 bytes). Encryption/decryption is implemented in `lib/notifications/crypto.ts`. If `NOTIFICATION_ENCRYPTION_KEY` is not set at worker boot, the worker process must throw and refuse to start — it must not silently store plaintext.

Add `notificationChannels OrgNotificationChannel[]` to the `Organization` model.

Max 5 channels per `channelType` per org. Enforced in the POST handler before insert.

### 2. `OutboundWebhook` — org-registered external endpoints

```prisma
model OutboundWebhook {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  url            String       // AES-256-GCM encrypted at rest
  label          String       // max 100 chars
  signingSecret  String       // 32-byte hex, AES-256-GCM encrypted at rest
  enabled        Boolean      @default(true)
  createdById    String
  createdBy      User         @relation(fields: [createdById], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  deliveryLogs   WebhookDeliveryLog[]
}
```

Add `outboundWebhooks OutboundWebhook[]` to `Organization`.

Max 10 outbound webhooks per org. Enforced in the POST handler before insert.

### 3. `WebhookDeliveryLog` — per-attempt delivery record

```prisma
model WebhookDeliveryLog {
  id           String          @id @default(cuid())
  webhookId    String
  webhook      OutboundWebhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  eventName    String          // one of the 10 canonical event names
  contractId   String
  payload      Json            // full envelope sent in the request body
  attempt      Int             // 1 | 2 | 3
  httpStatus   Int?            // null on network error
  responseBody String?         // first 1000 chars of response body, null on network error
  durationMs   Int?            // round-trip ms, null on network error
  status       String          // "pending" | "success" | "failed"
  deliveredAt  DateTime?       // set on success
  createdAt    DateTime        @default(now())
}
```

`attempt` starts at 1. No attempt 4 is ever created. `status` is `"pending"` when the row is first inserted; updated to `"success"` or `"failed"` after the HTTP call resolves.

### 4. `UserNotificationPreference` — per-user, per-event email opt-in

```prisma
model UserNotificationPreference {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  eventName      String       // one of the 10 canonical event names
  emailEnabled   Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([userId, organizationId, eventName])
}
```

A missing row means "use the default". The GET endpoint and fan-out logic must both synthesise the full 10-entry set from defaults when rows are absent.

**Default `emailEnabled` per event:**

| Event name | Default |
|---|---|
| `contract.uploaded` | `false` |
| `contract.extracted` | `false` |
| `approval.requested` | `true` |
| `approval.approved` | `true` |
| `approval.rejected` | `true` |
| `contract.sent_for_signing` | `false` |
| `contract.signed` | `true` |
| `contract.expiring_soon` | `true` |
| `contract.expired` | `true` |
| `contract.archived` | `false` |

Add `notificationPreferences UserNotificationPreference[]` to `User` and `Organization`.

---

## Event System Design

### Fan-out architecture

The triggering route or worker enqueues a single `notification.fanout` job and returns immediately. No notification channel is contacted inline.

```
API route / worker action
  └─ enqueueNotification(eventName, contractId, actorId, metadata)
       └─ notification.fanout worker
            ├─ resolves contract + org + actor name from DB
            ├─ for each enabled OrgNotificationChannel → enqueue notification.deliver (slack/teams kind)
            ├─ for each enabled OutboundWebhook → create WebhookDeliveryLog row (status: pending, attempt: 1)
            │                                   → enqueue notification.deliver (webhook kind)
            └─ for each email recipient (filtered by UserNotificationPreference) → enqueue email.send (event_notification kind)
```

Fan-out is sequential within the job (not Promise.all) to keep DB load predictable.

### New BullMQ queue definitions (add to `queues.ts`)

**`notification.fanout`**

```typescript
export interface NotificationFanoutJobData {
  eventName: string
  contractId: string
  actorId: string | null  // null for system/cron events
  metadata: Record<string, string | number | boolean | null>
  // Allowed metadata keys per event:
  // approval.requested     → { approvalId, assigneeId, assigneeName, requesterId, requesterName, message? }
  // approval.approved      → { approvalId, decidedById, decidedByName, comment? }
  // approval.rejected      → { approvalId, decidedById, decidedByName, comment? }
  // contract.expiring_soon → { alertType: "EXPIRY_7" | "EXPIRY_30" | "EXPIRY_90", daysUntilExpiry: number }
  // contract.expired       → { alertType: "EXPIRY_PAST" }
  // all other events       → {}
}
```

BullMQ options: `{ removeOnComplete: 200, removeOnFail: 500 }`

**`notification.deliver`**

```typescript
export type NotificationDeliverJobData =
  | {
      kind: "slack" | "teams"
      channelId: string
      eventName: string
      contractId: string
      contractTitle: string
      counterpartyName: string | null
      actorName: string | null
      appUrl: string
      metadata: Record<string, string | number | boolean | null>
    }
  | {
      kind: "webhook"
      webhookId: string
      deliveryLogId: string   // pre-created by fanout job
      attempt: number         // 1 on first enqueue
      payload: string         // JSON-serialised envelope, pre-built
      signature: string       // pre-computed HMAC-SHA256 hex
    }
```

BullMQ options: `{ removeOnComplete: 500, removeOnFail: 500 }`

**`EmailJobData` extension** (add to existing union in `queues.ts`):

```typescript
| {
    kind: "event_notification"
    eventName: string
    to: string
    contractId: string
    contractTitle: string
    actorName: string | null
    metadata: Record<string, string | number | boolean | null>
    unsubscribeToken: string  // HMAC-signed token: userId + orgId + eventName
  }
```

### Retry logic for `notification.deliver` (webhook kind)

BullMQ's built-in job retry is not used. The worker manages retries explicitly:

1. Worker attempts the HTTP POST.
2. On success (HTTP 2xx): update `WebhookDeliveryLog` with `status: "success"`, `httpStatus`, `responseBody` (first 1000 chars), `durationMs`, `deliveredAt: now()`.
3. On failure (non-2xx or network error): update log with `status: "failed"`, then:
   - If `attempt < 3`: enqueue a new `notification.deliver` job with `attempt + 1` and BullMQ `delay`:
     - attempt 1 → delay: 10000 ms
     - attempt 2 → delay: 30000 ms
     - attempt 3 → no further enqueue
   - If `attempt === 3`: log remains `status: "failed"`, no further job.

HTTP call must use a timeout of 10000 ms. Responses exceeding this are treated as failure.

---

## Webhook Payload Envelope

Exact shape for every outbound webhook delivery. `data` fields are constant — do not add or remove fields without a spec change.

```json
{
  "event": "contract.signed",
  "orgId": "org_abc123",
  "timestamp": "2026-05-09T14:30:00.000Z",
  "apiVersion": "2026-05-01",
  "data": {
    "contractId": "ctr_xyz",
    "contractTitle": "Acme MSA 2026",
    "counterpartyName": "Acme Corp",
    "status": "ACTIVE",
    "ownerId": "usr_123",
    "actorId": "usr_456",
    "actorName": "Jane Smith",
    "metadata": {}
  }
}
```

`apiVersion` is the fixed string `"2026-05-01"` for all M5 deliveries.

### HMAC-SHA256 signing

Header name: `X-ClauseFlow-Signature`

Header value format: `sha256=<lowercase hex digest>`

Signing algorithm:
- `payload_bytes` = UTF-8 encoding of the JSON body string (compact, no pretty-print)
- `secret_bytes` = `Buffer.from(signingSecret_hex, 'hex')` (16 bytes from the 32-char hex secret)
- `digest` = `crypto.createHmac('sha256', secret_bytes).update(payload_bytes).digest('hex')`
- Header value = `"sha256=" + digest`

The fanout job computes the signature and stores it in the `notification.deliver` job data. The deliver worker sends the pre-computed value verbatim — it does not re-read the `signingSecret` from the DB.

---

## API Endpoints

All routes require `resolveAuth`. Role requirements are noted per route. All request bodies validated with Zod before any DB write.

### Org notification channels (Slack / Teams)

**`GET /api/org/notification-channels`**
- Role: any org member
- Response 200: `{ channels: Array<{ id, channelType: "slack" | "teams", label, enabled, createdAt }> }`
- `webhookUrl` is never returned in any response.

**`POST /api/org/notification-channels`**
- Role: admin
- Body: `{ channelType: "slack" | "teams", webhookUrl: string, label: string }`
- Zod: `channelType` enum, `webhookUrl` `z.string().url().max(2048)`, `label` `z.string().min(1).max(100)`
- Enforce max 5 channels per `channelType` per org. Return 422 `{ error: "limit_reached" }` if exceeded.
- Encrypt `webhookUrl` before insert.
- Response 201: `{ id, channelType, label, enabled, createdAt }`

**`PATCH /api/org/notification-channels/[id]`**
- Role: admin
- Body: `{ label?: string, enabled?: boolean }` — `webhookUrl` cannot be updated (delete + recreate)
- Return 404 if record belongs to a different org
- Response 200: updated channel record

**`DELETE /api/org/notification-channels/[id]`**
- Role: admin
- Hard delete. Return 404 if belongs to a different org.
- Response 204

### Outbound webhooks

**`GET /api/org/webhooks`**
- Role: any org member
- Response 200: `{ webhooks: Array<{ id, label, enabled, urlPreview: string, createdAt }> }`
- `urlPreview` = first 30 chars of decrypted URL + `"..."` if longer. Full URL never returned.

**`POST /api/org/webhooks`**
- Role: admin
- Body: `{ url: string, label: string }`
- Zod: `url: z.string().url().max(2048)`, `label: z.string().min(1).max(100)`
- Enforce max 10 outbound webhooks per org. Return 422 `{ error: "limit_reached" }` if exceeded.
- Generate `signingSecret`: `crypto.randomBytes(16).toString('hex')` (32-char hex).
- Encrypt `url` and `signingSecret` before insert.
- Response 201: `{ id, label, signingSecret }` — `signingSecret` returned once only, never again.

**`DELETE /api/org/webhooks/[id]`**
- Role: admin. Hard delete (cascades to `WebhookDeliveryLog`). Return 404 if belongs to a different org.
- Response 204

**`GET /api/org/webhooks/[id]/deliveries`**
- Role: admin
- Query params: `page: int (default 1, min 1)`, `limit: int (default 50, min 1, max 50)`
- Return 404 if webhook belongs to a different org
- Response 200: `{ deliveries: Array<{ id, eventName, attempt, httpStatus, status, durationMs, deliveredAt, createdAt }>, total: number }`
- `payload` and `responseBody` not included in list response.

### User notification preferences

**`GET /api/user/notification-preferences`**
- Role: any authenticated user
- Uses active org from session context
- Response 200: `{ preferences: Array<{ eventName, emailEnabled }> }` — always 10 entries, synthesising defaults for missing rows.

**`PUT /api/user/notification-preferences`**
- Role: any authenticated user
- Body: `{ preferences: Array<{ eventName: string, emailEnabled: boolean }> }`
- `eventName` values not in the canonical 10-item set are silently filtered out.
- Upsert: delete existing rows for this userId+orgId, then insertMany.
- Response 200: full 10-entry set after update.

### One-click email unsubscribe

**`GET /api/user/unsubscribe`**
- Query params: `token: string`
- No auth required.
- Token format: HMAC-SHA256 of `${userId}:${orgId}:${eventName}` using `BETTER_AUTH_SECRET` as key, base64url encoded.
- Validate token. If valid, upsert `UserNotificationPreference` with `emailEnabled: false` for that userId+orgId+eventName.
- Response: redirect to `/settings/profile/notifications?unsubscribed=1` (renders a toast: "You've been unsubscribed from [event label] emails.")
- Invalid token: return 400 `{ error: "invalid_token" }`.

---

## UI Screens

### `/settings/notifications` — org-level (admin-only write)

Two sections on one page. Non-admins see a read-only view with no add/edit controls.

**Section 1: Slack & Teams**
- List of configured channels: icon (Slack/Teams) + label + enabled toggle + delete button.
- "Add Slack channel" and "Add Teams channel" buttons open an inline form: label + webhook URL field (type="password" to prevent autofill exposure; field clears on save).
- Capacity indicator: "2 of 5 Slack channels configured."

**Section 2: Outbound Webhooks**
- List: label + url preview + enabled toggle + delete button + "View deliveries" link.
- "Add webhook" button opens inline form: label + URL.
- After creation: display `signingSecret` in a read-only input with copy-to-clipboard button and warning banner: "This secret is shown once. Save it now — it cannot be retrieved again." Banner is dismissible.
- "View deliveries" navigates to `/settings/notifications/webhooks/[id]/deliveries`.

### `/settings/notifications/webhooks/[id]/deliveries` — delivery log

- Table columns: Event | Attempt | HTTP Status | Duration (ms) | Delivered At | Status (badge: green=success, red=failed, grey=pending).
- Ordered newest first. Paginated: 50 rows per page.
- No re-send or manual retry button in M5.
- Breadcrumb back to `/settings/notifications`.

### `/settings/profile/notifications` — user email preferences

- Accessible to every authenticated member (not admin-gated).
- Two-column table: Event (human label) | Email (checkbox).
- Saves on "Save preferences" button click via `PUT /api/user/notification-preferences`.
- Show toast on save success: "Preferences saved."
- When query param `?unsubscribed=1` is present, show toast: "You've been unsubscribed from [event] emails."

**Human-readable event labels:**

| Event name | Human label |
|---|---|
| `contract.uploaded` | Contract file uploaded |
| `contract.extracted` | AI metadata extracted |
| `approval.requested` | Approval request assigned to me |
| `approval.approved` | Approval decision: approved |
| `approval.rejected` | Approval decision: rejected |
| `contract.sent_for_signing` | Contract sent for signing |
| `contract.signed` | Contract signed |
| `contract.expiring_soon` | Contract expiring soon |
| `contract.expired` | Contract expired |
| `contract.archived` | Contract archived |

---

## Email Template

Add `sendEventNotificationEmail` to `lib/email/`. The existing `sendApprovalRequestEmail` and `sendAlertEmail` remain untouched.

**Subject pattern (exact):**
```
[ClauseFlow] {human label} — {contractTitle}
```

**HTML template structure** (inline-style, matching existing templates):
- H2: human label for the event.
- Fixed rows: "Contract" → contractTitle, "Actor" → actorName (or "System" if null).
- Conditional rows from `metadata`:
  - `approval.requested/approved/rejected`: assignee/decider name + comment
  - `contract.expiring_soon`: "Expires in X days"
- CTA button (primary colour): "View Contract" → `${BETTER_AUTH_URL}/contracts/${contractId}`
- Footer: small muted text — "You're receiving this because you're a member of [org name]. [Unsubscribe from {event label} emails]({BETTER_AUTH_URL}/api/user/unsubscribe?token={token})"

**Unsubscribe token generation** (in `sendEventNotificationEmail`):
```typescript
const token = crypto
  .createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
  .update(`${userId}:${orgId}:${eventName}`)
  .digest('base64url')
```

---

## Slack / Teams Message Format

Add `sendSlackEvent` and `sendTeamsEvent` alongside existing helpers in `lib/notifications/webhooks.ts`. Both return `Promise<boolean>`, never throw.

```typescript
interface NotificationEventOpts {
  webhookUrl: string         // decrypted plaintext URL
  eventName: string
  contractTitle: string
  counterpartyName: string | null
  actorName: string | null
  contractId: string
  appUrl: string
  metadata: Record<string, string | number | boolean | null>
}
```

**`sendSlackEvent` Block Kit:**
- Header block: bold human label
- Section: two-column fields — "Contract" + contractTitle, "Counterparty" + counterpartyName (or "—"), "Actor" + actorName (or "System")
- Context block: metadata fields (comment, days until expiry, etc.) rendered as muted text
- Actions block: "View Contract" button (primary style) linking to `${appUrl}/contracts/${contractId}`

**`sendTeamsEvent` Adaptive Card 1.4:**
- TextBlock header (weight: bolder, size: medium): human label
- FactSet: Contract, Counterparty, Actor, metadata fields
- Action.OpenUrl: "View Contract" → `${appUrl}/contracts/${contractId}`

---

## Environment Variables

Add to `.env.example`:

```bash
# Required for M5 notification encryption (hex-encoded 32-byte key)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NOTIFICATION_ENCRYPTION_KEY=
```

Worker must check on boot and throw `Error("NOTIFICATION_ENCRYPTION_KEY is required")` if absent.

---

## Implementation Order

1. Prisma migration — 4 new models (`OrgNotificationChannel`, `OutboundWebhook`, `WebhookDeliveryLog`, `UserNotificationPreference`)
2. `lib/notifications/crypto.ts` — AES-256-GCM encrypt/decrypt for webhook URLs and secrets
3. `queues.ts` — add `notification.fanout`, `notification.deliver` queue definitions + `EmailJobData` extension
4. `lib/notifications/fanout.ts` — resolve recipients, build envelope, compute HMAC, enqueue all downstream jobs
5. Worker: `notification.fanout` handler
6. Worker: `notification.deliver` handler — Slack/Teams HTTP calls + webhook HTTP calls with retry logic (delays: 10000/30000 ms)
7. `sendSlackEvent` + `sendTeamsEvent` Block Kit / Adaptive Card builders in `lib/notifications/webhooks.ts`
8. `sendEventNotificationEmail` in `lib/email/` — HTML template with CTA + unsubscribe footer + token generation
9. Email worker: handle `event_notification` kind
10. Wire `enqueueNotification()` call into all 10 trigger points (routes + workers)
11. `GET /api/user/unsubscribe` — token validation + preference upsert + redirect
12. API routes: notification channels CRUD (`/api/org/notification-channels`)
13. API routes: outbound webhooks CRUD + deliveries list (`/api/org/webhooks`)
14. API route: user notification preferences GET/PUT (`/api/user/notification-preferences`)
15. UI: `/settings/notifications` (org channels + webhooks)
16. UI: `/settings/notifications/webhooks/[id]/deliveries`
17. UI: `/settings/profile/notifications` (user preferences + unsubscribe toast)
18. `docs/zapier-integration.md` — trigger/action definitions for future Zapier app
19. Verify org isolation test passes
20. Add `NOTIFICATION_ENCRYPTION_KEY` to `.env.example` with generation command

---

## Open Questions

None — all design decisions resolved:

- **Webhook URL update policy:** delete + recreate only. Prevents silent URL rotation without audit trail.
- **`signingSecret` exposure:** one-time at creation only. Matches existing API key model.
- **Env-var fallback:** `SLACK_WEBHOOK_URL` / `TEAMS_WEBHOOK_URL` checked if no enabled DB channel exists. DB takes precedence.
- **Deduplication of `contract.expiring_soon`:** fanout checks `ContractAlert.firedAt IS NOT NULL` before enqueuing.
- **`signingSecret` length:** `crypto.randomBytes(16).toString('hex')` → 32-char hex → 16 bytes for HMAC keying.
- **Outlook/Gmail Add-in:** out of scope for M5. Email notifications via Nodemailer already reach Outlook and Gmail inboxes. Full sidebar add-ins (the Summize model) deferred to a future milestone.
- **One-click unsubscribe:** required for CAN-SPAM / GDPR compliance. Implemented via HMAC-signed token, no auth needed.
- **Fan-out sequentiality:** sequential (not parallel) to keep DB connection pool stable under high event volume.
- **Existing alert emails:** `sendApprovalRequestEmail` and `sendAlertEmail` untouched in M5. They will be migrated to `sendEventNotificationEmail` in a future cleanup pass after M5 ships.
