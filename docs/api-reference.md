# ClauseFlow API Reference

All API endpoints are under `/api/`. Authentication is required for all routes.

## Authentication

ClauseFlow supports two authentication methods:

**Session cookie** (browser users)
Authenticate via the web UI. Session cookies are set automatically.

**Bearer token** (API clients, agents)
```
Authorization: Bearer cf_live_<your-api-key>
```

API keys are created in **Settings → API Keys**. Keys are scoped to an org and support `read` or `read_write` scopes. Mutation endpoints (POST, PATCH, DELETE) require `read_write` scope.

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
      "autoRenewal": false,
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

Requires `read_write` scope. Rate limited to 20 requests/minute per org.

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

Requires `read_write` scope. All fields are optional.

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

Requires `read_write` scope. Soft-delete — sets status to `ARCHIVED`. Returns 409 if already archived.

**Response 204:** No content.

---

### Upload file

```
POST /api/contracts/:id/upload
```

Requires `read_write` scope. Accepts `multipart/form-data` with a `file` field.

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

Requires `read_write` scope. Accept or reject an extracted field.

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

Requires `read_write` scope.

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

**Create signing submission**
```
POST /api/contracts/:id/sign
```

Requires `read_write` scope. Creates a DocuSeal submission and returns a signing URL.

**Response 200:**
```json
{
  "signingUrl": "https://docuseal.com/sign/abc...",
  "submissionId": "sub_123"
}
```

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
Requires `read_write` scope. Body: `{ "name": "Customers" }` (max 255 chars).

### Update folder
```
PATCH /api/folders/:id
```
Requires `read_write` scope. Body: `{ "name": "Enterprise Customers" }`

### Delete folder
```
DELETE /api/folders/:id
```
Requires `read_write` scope. Returns 400 if folder has contracts assigned.

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
Requires `read_write` scope. Body: `{ "name": "Enterprise", "color": "#3B82F6" }` (hex color, optional).

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
Requires `read_write` scope + admin role. Body: `{ "name": "Acme Legal" }`

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
Admin only. Body: `{ "name": "CI Pipeline", "scope": "read" | "read_write" }`

**Response 201:**
```json
{
  "id": "key_1",
  "name": "CI Pipeline",
  "key": "cf_live_abc123...",
  "scope": "read_write",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

> The `key` value is shown **once only** at creation. Save it immediately — it cannot be retrieved again.

**Delete API key**
```
DELETE /api/org/api-keys/:id
```
Admin only.

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

Supports tool calling for: listing contracts, getting contract details, searching contracts, asking questions about contracts, managing folders and tags.

---

## Webhooks (Incoming)

### DocuSeal signing events

```
POST /api/webhooks/docuseal
```

Receives signing status updates from DocuSeal. Validates `X-DocuSeal-Signature` HMAC-SHA256 header when `DOCUSEAL_WEBHOOK_SECRET` is set. Configure this URL in your DocuSeal webhook settings.

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

> **Note:** ClauseFlow returns 404 (not 403) when a resource exists but belongs to another org. This prevents leaking resource existence across tenant boundaries.
