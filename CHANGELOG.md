# Changelog

All notable changes to ClauseFlow are documented in this file.

---

## [1.1.0] — 2026-05-17

### Production Hardening

Security, reliability, and observability improvements applied across the full codebase.

- **Health endpoint** (`GET /api/health`) — probes DB and Redis with 1 500 ms timeout; returns HTTP 503 if either is unavailable; used by Docker `HEALTHCHECK` and load balancers
- **RBAC tightening** — PATCH and DELETE on contracts now require `legal` role minimum (was `member`); viewers can no longer mutate contracts
- **HTML sanitization** — `counterpartyName`, `notes`, and `governingLaw` fields sanitized with `sanitize-html` on every PATCH to block stored-XSS
- **Fire-and-forget elimination** — all `writeActivity` / DB mutations are awaited; non-critical side effects (notifications, alerts) use a `fireAndLog()` helper that never causes unhandled rejections
- **Raw error suppression** — internal error details (`err.message`, stack traces) never reach API response bodies; all 5xx responses return a fixed human-readable string
- **Structured logging** — pino replaces all `console.*` calls across API routes and worker; pino object-first convention enforced (`logger.error({ err, ctx }, "message")`); fields redacted: `password`, `apiKey`, `encryptedKey`, `keyHash`, `lookupHash`, `accessToken`
- **Request correlation IDs** — `x-request-id` header generated in Next.js middleware, propagated through `resolveAuth()` into `RequestContext`, surfaced in every log line via `requestLogger(requestId)`
- **OpenTelemetry** — opt-in distributed tracing (`OTEL_ENABLED=false` default); OTLP HTTP exporter; auto-instrumentations for HTTP, Prisma, Redis, BullMQ; trace-log linking (traceId/spanId in every log line when a trace is active); Jaeger all-in-one in `docker-compose.dev.yml` on ports 16686/4318
- **Worker graceful shutdown** — SIGTERM handler pauses then closes all 14 BullMQ workers with a 30 s drain timeout; migrations run before any Worker is instantiated
- **Configurable DB pool** — `DATABASE_POOL_SIZE` env var (default 20)
- **Deployment script fix** — `NOTIFICATION_ENCRYPTION_KEY` generated as 64-char hex (was base64, causing validator failures)
- **Worker Dockerfile fix** — `COPY worker/ ./worker/` added; container was crashing on start with module-not-found for signing-sync
- **Integration test coverage** — org isolation (11 tests), auth guards (27 tests), failure modes (14 tests): malformed bodies, file upload validation, rate limit 429 shape, per-org bucket isolation, nonexistent resource 404s

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

### M11 — Internationalization

Five-language support with full RTL layout for Arabic.

- **Languages:** English · Français · Deutsch · Español · العربية (RTL)
- **next-intl** — App Router integration with server and client components
- **Cookie-based locale** — persists user preference across sessions without URL slugs
- **Locale switcher** — available in user Settings
- **Navigation translated** — all nav items, status labels, and common UI strings
- **`User.locale` field** — stores per-user locale preference in the database
- **RTL layout** — full right-to-left CSS for Arabic, including form inputs and modals

### M10 — Migration Tools

Bulk import from five contract sources.

- **CSV / spreadsheet import** — map columns to contract fields, preview before commit, row-level progress tracking
- **PandaDoc import** — fetch contracts via PandaDoc API, preserve metadata
- **ContractBook import** — OAuth-based pull from ContractBook
- **DocuSign CLM import** — bulk fetch envelopes, extract signed documents
- **Google Drive import** — OAuth picker, bulk PDF/DOCX download and import
- **5-tab import UI** — unified import wizard with per-source tabs and progress tracking
- **14 import API routes** — source-specific endpoints with job-queue-backed processing

### M9 — Ecosystem: CRM

Native integrations with HubSpot, Salesforce, and Pipedrive.

- **HubSpot** — OAuth 2.0 connect, deal linking, sync contract metadata to deal properties, inbound webhooks
- **Salesforce** — OAuth 2.0 (Connected App), opportunity linking, opportunity field sync, inbound webhooks
- **Pipedrive** — OAuth 2.0 connect, deal linking, pipeline sync, inbound webhooks
- **Deal-contract linking** — associate any contract with a CRM deal/opportunity; displayed on contract detail
- **Bidirectional sync** — contract status changes propagate to CRM deal stage

### M8 — Analytics

Organization-level contract analytics dashboard.

- **`/analytics` page** — dedicated analytics view with 5 Recharts widgets
- **`GET /api/analytics/summary`** — single org-scoped endpoint; returns contract counts by status, value by currency, renewal risk breakdown, obligation completion rate, and contract activity over time
- **Obligation widget** — graceful degradation when no obligations exist
- **All data org-scoped** — no cross-tenant data leakage possible

### M7 — Obligation Tracking

Structured obligation management with sub-tasks and automated overdue detection.

- **`ContractObligation` model** — obligations with title, description, due date, assignee, status, and priority
- **Sub-tasks** — nested obligation tasks for complex multi-step requirements
- **Full CRUD API** — create, read, update, delete obligations and sub-tasks; all org-scoped
- **Obligations tab** — dedicated tab on contract detail page
- **Daily overdue cron** — BullMQ scheduler marks past-due obligations as `OVERDUE` automatically
- **Reminder notifications** — 7-day and 1-day advance reminders sent via the notification fanout queue

### M6 — Authoring

Contract document creation and template system with Word import and export.

- **`ContractDocument` model** — rich-text contract body stored as JSON (Plate/Slate format)
- **`ContractTemplate` model** — reusable templates with variable placeholders
- **Plate editor** — server-side rendering of the Plate rich-text editor
- **Word import** — DOCX → Plate JSON conversion via mammoth; preserves headings, lists, tables
- **DOCX export** — Plate JSON → DOCX via docx.js; downloadable
- **PDF export** — server-side PDF rendering via Puppeteer
- **Template API** — `POST /api/templates`, `GET /api/templates/[id]`
- **Use endpoint** — `POST /api/templates/[id]/use` instantiates a template into a new contract document

### M5 — Ecosystem: Notifications

Full Slack/Teams event coverage plus user-configurable webhooks and Zapier/Make connector.

- **Slack integration** — Block Kit messages for all major contract events (created, status change, signed, expiring, obligation overdue)
- **Microsoft Teams integration** — Adaptive Cards for the same event set
- **Outgoing webhooks** — org-configurable webhook endpoints; HMAC-SHA256 signed payloads; retry with exponential backoff
- **Zapier / Make connector** — webhook payload shape compatible with both platforms out of the box
- **Notification fanout queue** — `notification.fanout` BullMQ job dispatches to all enabled channels in parallel
- **One-click unsubscribe** — signed unsubscribe token in every email notification

### M4 — Launch Prep

Self-hosting documentation, API reference, and v1.0.0 release.

- **Self-hosting guide** — Docker Compose walkthrough, environment variable reference, MinIO + S3 configuration
- **API reference** — OpenAPI-style documentation for all public endpoints
- **v1.0.0 changelog** — this file
- **`docker-compose.yml` hardened** — `${VAR:?error}` guards on all required secrets; fails fast on missing config
- **`scripts/deploy.sh`** — automated deploy script with key generation and migration runner

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
