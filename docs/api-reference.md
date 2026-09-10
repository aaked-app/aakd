# Aakd API Reference

All API endpoints are under `/api/`. Authentication is required for all routes.

## Authentication

Aakd supports two authentication methods:

**Session cookie** (browser users)
Authenticate via the web UI. Session cookies are set automatically.

**Bearer token** (API clients, agents)
```
Authorization: Bearer cf_live_<your-api-key>
```

API keys are created in **Settings → API Keys**. Keys are scoped to an organization and use one or more of these scopes:

- `read`: metadata and non-sensitive read endpoints
- `text_read`: permission to read extracted contract text/content where supported
- `action_propose`: permission to preview source-linked actions and submit them for human review; this also requires `read` and `text_read`

Every newly issued key must explicitly include `read`. Legacy keys that omit
`read` are rejected and must be replaced. General API-key mutations are
temporarily disabled while the mutation boundary is hardened; an old `write`
scope does not grant `action_propose`. Browser sessions retain the existing
human workflows. A key is shown only once when it is created.

---

## Contracts

### List contracts

```
GET /api/contracts
```

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by status: `DRAFT`, `INTERNAL_REVIEW`, `PENDING_APPROVAL`, `AWAITING_SIGNATURE`, `ACTIVE`, `EXPIRED`, `TERMINATED`, `ARCHIVED` |
| `contractType` | string | Filter by type: `NDA`, `MSA`, `SOW`, `EMPLOYMENT`, `VENDOR`, `CUSTOMER`, `OTHER` |
| `ownerId` | string | Filter by owner user ID |
| `folderId` | string | Filter by folder ID |
| `tagId` | string | Filter by tag ID |
| `search` | string | Case-insensitive title search |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20, max: 100) |

**Response 200:**
```json
{
  "contracts": [
    {
      "id": "ctr_abc123",
      "title": "Acme MSA 2026",
      "contractType": "MSA",
      "status": "ACTIVE",
      "counterpartyName": "Acme Corp",
      "value": 50000,
      "currency": "USD",
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2027-01-01T00:00:00.000Z",
      "renewalDate": "2026-12-01T00:00:00.000Z",
      "noticePeriodDays": 30,
      "autoRenewal": false,
      "renewalReminderEnabled": true,
      "owner": { "id": "usr_123", "name": "Jane Smith", "email": "jane@example.com" },
      "tags": [{ "id": "tag_1", "name": "Enterprise" }],
      "folder": { "id": "fld_1", "name": "Customers" },
      "_count": { "files": 2 },
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### Create contract

```
POST /api/contracts
```

Requires an authenticated human browser session. API keys receive
`403 legacy_api_key_mutations_disabled`.

**Request body:**
```json
{
  "title": "Acme MSA 2026",
  "contractType": "MSA",
  "counterpartyName": "Acme Corp",
  "counterpartyContact": "legal@acme.com",
  "value": 50000,
  "currency": "USD",
  "governingLaw": "Delaware",
  "startDate": "2026-01-01",
  "endDate": "2027-01-01",
  "renewalDate": "2026-12-01",
  "noticePeriodDays": 30,
  "autoRenewal": false,
  "renewalReminderEnabled": true,
  "notes": "Signed after Q4 negotiation.",
  "folderId": "fld_1",
  "tagIds": ["tag_1", "tag_2"]
}
```

**Response 201:** Created contract object (same shape as list item).

---

### Get contract

```
GET /api/contracts/:id
```

**Response 200:**
```json
{
  "id": "ctr_abc123",
  "title": "Acme MSA 2026",
  "status": "ACTIVE",
  "hasExtractedText": true,
  "owner": { "id": "usr_123", "name": "Jane Smith", "email": "jane@example.com" },
  "tags": [...],
  "folder": {...},
  "files": [{ "id": "fil_1", "filename": "acme-msa.pdf", "sizeBytes": 204800, "isLatest": true, "createdAt": "..." }],
  "versions": [...],
  "activities": [...],
  "_count": { "files": 2, "versions": 1, "activities": 12 }
}
```

Returns 404 if the contract does not exist or belongs to another org.

---

### Update contract

```
PATCH /api/contracts/:id
```

Requires an authenticated human browser session. All fields are optional.

**Request body:** Same fields as create (all optional). Setting `folderId: null` removes the folder assignment.

**Status transitions** (invalid transitions return 422):
```
DRAFT → INTERNAL_REVIEW, ARCHIVED
INTERNAL_REVIEW → PENDING_APPROVAL, DRAFT, ARCHIVED
PENDING_APPROVAL → AWAITING_SIGNATURE, INTERNAL_REVIEW, ARCHIVED
AWAITING_SIGNATURE → ACTIVE, ARCHIVED
ACTIVE → EXPIRED, TERMINATED, ARCHIVED
EXPIRED → ARCHIVED
TERMINATED → ARCHIVED
ARCHIVED → (none — terminal)
```

**Response 200:** Updated contract object.

---

### Archive contract

```
DELETE /api/contracts/:id
```

Requires an authenticated human browser session. Soft-delete — sets status to
`ARCHIVED`. Returns 409 if already archived.

**Response 204:** No content.

---

### Upload file

```
POST /api/contracts/:id/upload
```

Requires an authenticated human browser session. Accepts `multipart/form-data`
with a `file` field.

- Accepted formats: PDF, DOCX (validated by magic bytes)
- Max file size: 50 MB
- After upload: enqueues `contract.extract` → `contract.embed` → `contract.ai_extract` jobs automatically

**Response 200:**
```json
{
  "fileId": "fil_abc",
  "filename": "contract.pdf",
  "sizeBytes": 204800
}
```

---

### Ask AI (Contract Q&A)

```
POST /api/contracts/:id/ask
```

Requires AI to be configured (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or Ollama). Returns 400 if AI is not available or contract has no extracted text.

**Request body:**
```json
{
  "question": "What is the notice period for termination?"
}
```

**Response 200:**
```json
{
  "answer": "The notice period for termination is 30 days, as stated in Section 12.2.",
  "excerpts": [
    {
      "text": "Either party may terminate this Agreement with 30 days written notice...",
      "page": 8,
      "confidence": 0.94
    }
  ]
}
```

---

### Get AI extractions

```
GET /api/contracts/:id/extractions
```

Returns all AI-extracted metadata fields awaiting human review.

**Response 200:**
```json
{
  "extractions": [
    {
      "id": "ext_1",
      "fieldKey": "counterpartyName",
      "value": "Acme Corporation",
      "sourceText": "This Agreement is entered into by Acme Corporation...",
      "sourcePage": 1,
      "confidence": 0.97,
      "status": "pending",
      "extractedBy": "ai"
    }
  ]
}
```

---

### Review AI extraction

```
PATCH /api/contracts/:id/extractions
```

Requires an authenticated human browser session. Accept or reject an extracted field.

**Request body:**
```json
{
  "extractionId": "ext_1",
  "action": "accept"
}
```

`action`: `"accept"` | `"reject"`

**Response 200:** Updated extraction object.

---

### Get activity log

```
GET /api/contracts/:id/activity
```

**Response 200:**
```json
{
  "activities": [
    {
      "id": "act_1",
      "action": "STATUS_CHANGED",
      "detail": "DRAFT → ACTIVE",
      "user": { "id": "usr_1", "name": "Jane Smith" },
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Approval requests

**Create approval request**
```
POST /api/contracts/:id/approvals
```

Requires an authenticated human browser session.

```json
{ "assignedToId": "usr_456", "message": "Please review before signing." }
```

Returns 400 if assignee is the same as requester (self-approval blocked).

**List approval requests**
```
GET /api/contracts/:id/approvals
```

**Approve or reject**
```
PATCH /api/contracts/:id/approvals/:approvalId
```

```json
{ "action": "approved", "comment": "Looks good." }
```

`action`: `"approved"` | `"rejected"`

---

### Signing

**Signing initiation (temporarily unavailable)**
```
POST /api/contracts/:id/sign
```

New signing submissions are paused. An API key cannot initiate signing and
receives `403 human_session_required`, including legacy keys that contain `write`.
Unauthenticated requests receive 401; an authenticated human session must have
access to the agreement (otherwise 404). An authorized session receives 503:

**Response 503:**
```json
{
  "error": "signing_send_temporarily_unavailable",
  "message": "Sending is paused until provider-side idempotency can be reconciled safely."
}
```

No provider submission is created. The newer `/signing/send` endpoint is also
paused. Signing reminder and reset endpoints return 503 after session and
agreement-access checks, without provider calls or signing-state changes.
Stored signing records remain readable; automatic updates require an explicitly
verified provider binding. Historical records are not bound automatically.

---

## Search

### Full-text search

```
GET /api/search?q=<query>
```

GIN-indexed full-text search across contract titles and extracted text.

**Query parameters:** `q` (required), `page`, `limit` (default 20, max 100).

**Response 200:**
```json
{
  "results": [
    {
      "id": "ctr_1",
      "title": "Acme MSA 2026",
      "snippet": "...renewal notice of <b>30 days</b>...",
      "rank": 0.85
    }
  ],
  "total": 5
}
```

---

### Semantic search

```
GET /api/search/semantic?q=<query>
```

pgvector cosine similarity search. Requires AI embeddings to be configured.

**Response 200:** Same shape as full-text search.

---

## Folders

### List folders
```
GET /api/folders
```

**Response 200:** `{ "folders": [{ "id", "name", "createdAt" }] }`

### Create folder
```
POST /api/folders
```
Requires an authenticated human browser session. Body: `{ "name": "Customers" }` (max 255 chars).

### Update folder
```
PATCH /api/folders/:id
```
Requires an authenticated human browser session. Body: `{ "name": "Enterprise Customers" }`

### Delete folder
```
DELETE /api/folders/:id
```
Requires an authenticated human browser session. Returns 400 if the folder has contracts assigned.

---

## Tags

### List tags
```
GET /api/tags
```

### Create tag
```
POST /api/tags
```
Requires an authenticated human browser session. Body: `{ "name": "Enterprise", "color": "#3B82F6" }` (hex color, optional).

### Update tag
```
PATCH /api/tags/:id
```

### Delete tag
```
DELETE /api/tags/:id
```

---

## Organization

### Get org details
```
GET /api/org
```

### Update org
```
PATCH /api/org
```
Requires an owner or administrator browser session. Body: `{ "name": "Acme Legal" }`

---

### Members

**List members**
```
GET /api/org/members
```

**Update member role**
```
PATCH /api/org/members/:id
```
Admin only. Body: `{ "role": "admin" | "member" }`

**Remove member**
```
DELETE /api/org/members/:id
```
Admin only.

**Invite member**
```
POST /api/org/members/invite
```
Admin only. Body: `{ "email": "colleague@example.com", "role": "member" }`

---

### API Keys

**List API keys**
```
GET /api/org/api-keys
```
Returns key metadata only — raw key values are never returned after creation.

**Create API key**
```
POST /api/org/api-keys
```
Owner or administrator browser session only. Body:
`{ "name": "CI Pipeline", "scopes": ["read"] }`.

For an agent that may read contract text and propose cited actions for human
review, use `{ "name": "Agreement agent", "scopes": ["read", "text_read", "action_propose"] }`.

**Response 201:**
```json
{
  "apiKey": {
    "id": "key_1",
    "name": "Agreement agent",
    "prefix": "cf_live_abc123",
    "scopes": ["read", "text_read", "action_propose"],
    "expiresAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "rawKey": "cf_live_abc123..."
}
```

> The `key` value is shown **once only** at creation. Save it immediately — it cannot be retrieved again.

**Delete API key**
```
DELETE /api/org/api-keys/:id
```
Admin only.

**Example request using a key**
```bash
curl https://your-aakd-host.example/api/contracts \\
  -H 'Authorization: Bearer cf_live_...'
```

Use `read` for metadata, add `text_read` only when the client must receive
contract text, and add `action_propose` only when it must submit cited action
drafts for human review. The proposal scope cannot validate, assign, approve,
execute, deliver, or edit canonical contract data. Keep the raw key in a secret
manager; it cannot be recovered after the creation dialog is closed.

---

## Alerts

### List alerts
```
GET /api/alerts
```

Returns renewal alerts for the org. Query params: `contractId`, `type` (`EXPIRY_7`, `EXPIRY_30`, `EXPIRY_90`, `EXPIRY_PAST`), `page`, `limit`.

---

## AI Status

```
GET /api/ai-status
```

Returns the active AI provider and model.

**Response 200:**
```json
{ "provider": "anthropic", "model": "claude-haiku-4-5" }
```

Returns `{ "provider": null, "model": null }` if no AI is configured.

---

## MCP Server

```
POST /api/mcp
```

JSON-RPC 2.0 endpoint for AI agent integration (Claude, Cursor, Windsurf, etc.).

Authentication: `Authorization: Bearer cf_live_...` (API key required).

The current MCP surface supports contract search and retrieval, cited contract
questions, obligations, reviewed actions, analytics, CRM-link reads, import-job
reads, and the governed action-proposal flow. Legacy direct mutation tools are
not advertised.

### Governed action proposals

An API key with `read`, `text_read`, and `action_propose` can use this bounded
flow:

1. Call `preview_action_proposal` with an exact current file ID and version,
   source excerpt, excerpt SHA-256 hash, and UUID idempotency key. This creates
   no database record. Source excerpts are limited to 8,192 characters and
   opaque resource identifiers to 200 characters as operational safeguards.
   `RENEWAL_NOTICE` requires `noticeDate`; other action kinds cannot carry it.
   When both are present, `noticeDate` cannot be later than `dueDate`.
2. Review the returned policy and unchanged proposal, then call
   `propose_action` with the preview identity and exact source binding. Aakd
   creates one `PENDING_REVIEW` action or returns the authorized idempotent
   replay.
3. A human reviews and can correct the action type, notice date, deadline or
   condition, evidence requirement, title, and description in the browser.
   Validation makes it `PROPOSED`; the agent cannot perform this step.
4. Call `preview_action_approval_request` with the action version and one named
   reviewer, then `request_action_approval` with the unchanged preview. Only
   the assigned human can decide the request through the browser workflow.

Previews expire after their server-provided `expiresAt` time. Refresh an expired
preview with the same normalized intent and idempotency key; do not generate a
new intent merely to retry. A changed payload with a reused idempotency key is
rejected. Agreements with legacy, unbound extracted text must be re-extracted
from their current PDF or DOCX before source-linked proposals are available.
Preview and submit responses report point-in-time source freshness, the human
review policy, a non-secret hashed principal reference, citation hash/page, and
whether a source excerpt is present. They classify sensitivity as
`not_classified`; Aakd does not claim an absent sensitivity classifier ran.
Raw API keys, principal IDs, and idempotency keys are not returned.

---

## Webhooks (Incoming)

### DocuSeal signing events

```
POST /api/webhooks/docuseal
```

Receives bounded, validated signing events. Every request requires a valid
`X-DocuSeal-Signature` HMAC-SHA256 header and matching secret; a missing secret
fails closed. For organization integrations, use the URL returned by Settings,
including `?integrationId=...`, and that integration's saved secret. The legacy
environment-configured URL uses `DOCUSEAL_WEBHOOK_SECRET`.

Accepted events enqueue provider-bound synchronization; acceptance is not proof
of completion or document ingestion. The worker verifies the exact submission
and provider identity, and requires the agreement to remain awaiting signature.
Unbound historical records do not become bound merely by receiving a webhook.

---

## Error Responses

All errors return JSON with an `error` field:

```json
{ "error": "Unauthorized" }
{ "error": "Not Found" }
{ "error": { "fieldErrors": { "title": ["Required"] } } }
```

| Status | Meaning |
|---|---|
| 400 | Bad request — invalid input or business rule violation |
| 401 | Unauthenticated — missing or invalid credentials |
| 403 | Forbidden — insufficient scope or role |
| 404 | Not found — resource doesn't exist or belongs to another org |
| 409 | Conflict — e.g. archiving an already-archived contract |
| 422 | Validation error — Zod schema failure |
| 429 | Rate limited — retry after `Retry-After` seconds |
| 500 | Server error |

> **Note:** Aakd returns 404 (not 403) when a resource exists but belongs to another org. This prevents leaking resource existence across tenant boundaries.
