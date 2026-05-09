# Changelog

All notable changes to ClauseFlow are documented in this file.

---

## [1.0.0] — 2026-05-09

### M3 — AI Layer (Contract Q&A)

Retrieval-grounded contract Q&A with excerpt citations.

- **Contract Q&A (`/api/contracts/[id]/ask`)** — ask any question about a contract in natural language; answers are grounded in the contract text via RAG (retrieval-augmented generation)
- **Chunk-level embeddings** — contracts are split into overlapping chunks and embedded individually for precise semantic retrieval
- **Excerpt citations** — every AI answer surfaces the exact source excerpts used, including page numbers and confidence scores
- **Ask AI panel** — contract detail UI shows the Q&A interface alongside source excerpts
- **`ContractChunkEmbedding` model** — stores per-chunk vectors for retrieval; org-scoped via JOIN on Contract
- Atomic chunk embedding: chunks are collected then written in a single transaction
- NaN/Invalid Date guard before Prisma writes on extraction fields

### M2 — Workflow + Signing

Approval workflows, DocuSeal e-signature integration, and MCP server.

- **Approval workflows** — create approval requests, assign reviewers, record approved/rejected decisions with comments
- **Approval emails** — assignee is notified by email when an approval is requested
- **Auto-advance on final approval** — when all approvals pass, contract status advances to `AWAITING_SIGNATURE` automatically
- **DocuSeal integration** — create signing submissions, generate signing URLs, track signer status
- **Signing sync worker** — periodic BullMQ job polls DocuSeal for signing status updates
- **Signed file versioning** — completed signed documents are stored as a new file version
- **DocuSeal webhook handler** — `/api/webhooks/docuseal` receives real-time signing events; HMAC-SHA256 signature verification
- **MCP server** — `/api/mcp` JSON-RPC endpoint; authenticated with Bearer API keys; enables AI agents (Claude, Cursor, etc.) to query and manage contracts programmatically
- **MCP discovery** — `/.well-known/mcp` endpoint for tool discovery
- SSRF guard on all DocuSeal URL fetches (`isAllowedDocuSealUrl`)
- Self-approval blocked (400 if assignedToId === userId)
- Approval final decision wrapped in `$transaction`

### M1 — Renewal Tracking

AI metadata extraction, renewal alerts, full-text and semantic search.

- **PDF/DOCX text extraction** — BullMQ worker extracts raw text from uploaded files using `pdf-parse` and `mammoth`
- **AI metadata extraction** — Anthropic Claude / OpenAI / Ollama extracts key fields (parties, dates, value, type, governing law, auto-renewal) from contract text; results go into a human review queue
- **AI extraction review UI** — accept or reject individual extracted fields; accepted fields populate contract metadata
- **Contract embeddings** — full-contract vectors stored in pgvector (`ContractEmbedding`) for semantic search
- **Full-text search** — `/api/search` with GIN index on contract title/text; `tsvector` + `tsquery`
- **Semantic search** — `/api/search/semantic` with pgvector cosine similarity; `ivfflat.probes = 10`
- **Renewal alert generation** — alerts created for EXPIRY_7, EXPIRY_30, EXPIRY_90, and EXPIRY_PAST thresholds based on `endDate` and `noticePeriodDays`
- **Alert emails** — Nodemailer sends renewal alert emails to configured `ALERT_EMAIL_TO` recipients
- **Slack webhook alerts** — Block Kit message sent to `SLACK_WEBHOOK_URL` on renewal alert
- **Teams webhook alerts** — Adaptive Card sent to `TEAMS_WEBHOOK_URL` on renewal alert
- **`email.send` BullMQ queue** — email sending moved off the hot path into an async queue with 3 retries and exponential backoff (5 s base)
- All 6 BullMQ workers hardened with 3-attempt retry config and exponential backoff

### M0 — Contract Repository

Foundation: contract CRUD, file upload, storage, auth, RBAC, multi-tenancy, and Docker self-hosting.

- **Contract CRUD** — create, read, update, soft-delete (archive) contracts with full metadata (type, counterparty, value, currency, governing law, dates, auto-renewal, notes)
- **Status lifecycle** — `DRAFT → INTERNAL_REVIEW → PENDING_APPROVAL → AWAITING_SIGNATURE → ACTIVE → EXPIRED / TERMINATED → ARCHIVED`; invalid transitions rejected at the API layer
- **PDF/DOCX upload** — files validated by magic bytes (not MIME header); max 50 MB; stored via S3-compatible abstraction (MinIO or AWS S3)
- **File versioning** — each upload creates a new `ContractFile` version; latest flagged automatically
- **Folder organization** — create folders, assign contracts to folders, filter by folder
- **Tag system** — create org-scoped tags, assign multiple tags per contract, filter by tag
- **Activity log** — every contract state change written to the `Activity` table (created, updated, status changed, archived, file uploaded, etc.)
- **Organization-scoped data access** — Prisma middleware injects `organizationId` from `AsyncLocalStorage` on every query; no per-route manual scoping needed
- **Better Auth** — email/password authentication + organization plugin; session cookies for browser users
- **API key authentication** — `cf_live_` prefix + 32 random bytes; SHA-256 `lookupHash` for DB lookup + bcrypt `keyHash` for secure compare; raw key never stored
- **RBAC** — `admin` / `member` roles; write-scope required for all mutation routes (`requireWriteScope`)
- **BullMQ + Redis** — background job queues for extraction, embedding, AI extraction, alerts, signing sync, email sending
- **Docker self-hosting** — `docker-compose.yml` with Postgres 16 + pgvector, Redis 7, MinIO, the Next.js app, and the BullMQ worker; secrets enforced with `${VAR:?message}` — fails fast if unset
- **Rate limiting** — in-memory token bucket; 20 contract creates/min per org
- **Invitation flow** — org admins invite members by email via Better Auth; invitation emails sent via Nodemailer

---

## Security Fixes (post-M3 audit)

Applied as patch commits before v1.0.0 tag.

- `requireWriteScope` added to 6 routes that were missing it
- SSRF guard (`isAllowedDocuSealUrl`) on all DocuSeal URL fetches
- Self-approval blocked at the API level
- `ContractChunkEmbedding` raw SQL JOINs `Contract` to enforce org isolation
- `storageKey` removed from GET `/api/contracts/[id]` response (internal field)
- `extractedText` replaced with `hasExtractedText: boolean` presence flag in GET response
- Cross-tenant folder/tag access blocked at the API level before Prisma connect
- Approval final decision wrapped in `$transaction` to prevent partial state
- NaN/Invalid Date guard before all Prisma date writes
