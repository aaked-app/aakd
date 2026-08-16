# ClauseFlow API Route Convention Audit — 2026-07-16

Auditor: qa-tester
Scope: `apps/web/app/api/**/route.ts` (102 route files) + `apps/web/worker.ts` + `apps/web/lib/import/**` + `apps/web/lib/alerts/**` + supporting lib files.
Method: static read-only review against CLAUDE.md "API conventions" + "Background jobs" sections. No servers/tests were started (per constraints). No git commands were run.

---

## TASK 1 — Convention sweep

Baseline mechanics reviewed first (apply to every route below):
- `resolveAuth(req)` (`apps/web/lib/auth/middleware.ts:7`) is the single auth entrypoint — session cookie or `cf_live_` Bearer key.
- Org-scope Prisma middleware (`apps/web/lib/db/client.ts:44-92`) auto-injects `organizationId` on `ORG_SCOPED_MODELS` (Contract, Folder, Tag, ApiKey, OrgNotificationChannel, OutboundWebhook, UserNotificationPreference, ContractTemplate, ContractObligation, CrmIntegration, ImportJob) — but **only inside `requestContext.run(ctx, …)`** (AsyncLocalStorage). Routes that never call `requestContext.run` get zero automatic scoping and rely entirely on explicit `organizationId` checks in the route body.

**102/102 routes enumerated.** Full per-route table omitted for brevity where all 5 checks pass cleanly (the large majority of contract/obligation/approval/signing/template/CRM sub-resource routes) — those are called out in the "PASS examples" note at the end of each check. Only violations and notable observations are itemized below with `file:line`.

### (a) Zod validation before DB access on POST/PUT/PATCH

**PASS overall.** Checked every POST/PUT/PATCH handler for a Zod schema. All handlers that read a **user-controlled JSON body** validate it with `z.object`/`z.discriminatedUnion` + `.safeParse` before touching the DB (e.g. `contracts/[id]/route.ts:31-48`, `org/ai-config/route.ts:10-26`, `org/members/invite/route.ts:11-14`, `folders/[id]/route.ts:6-8`).

The 23 POST/PUT/PATCH routes that have no Zod import were individually verified — all are legitimate exceptions, not violations:
- **No request body at all** (pure action triggers): `contracts/[id]/signing/reset`, `signing/send`, `sign`, `extractions/rerun`, `obligations/extract`, `alerts` POST, `notifications/read-all`, `import/[jobId]/retry`, `templates/seed`, `org/invitations/[id]` (resend/cancel), `org/invitations/[id]/accept`.
- **FormData file uploads**, validated manually by magic bytes / MIME + size caps instead of Zod (correct per CLAUDE.md "validate by magic bytes, not MIME header"): `contracts/[id]/upload/route.ts:42-58,93-103` (proper magic-byte sniff), `contracts/[id]/document/image`, `document/import`, `org/logo`, `user/avatar`, `import/clm-export`, `import/batch`, `import/csv/preview`, `import/pandadoc`.
- **External signed webhook**, body shape validated by the CRM provider adapter, not Zod: `crm/[provider]/webhook/route.ts`.
- `auth/[...all]/route.ts` — delegates entirely to Better Auth's own handler.

**Inconsistency worth flagging (P2):** `contracts/[id]/upload/route.ts` and `contracts/[id]/document/import/route.ts` validate uploaded file bytes by magic-byte sniffing (`0x25 0x50 0x44 0x46` for PDF, ZIP+`word/` entry for DOCX). `org/logo/route.ts:5,32` and `user/avatar/route.ts:4,27` validate images **only by the client-supplied `file.type` MIME string** (`ALLOWED_TYPES.has(file.type)`), which is attacker-controlled and spoofable — a request can set `Content-Type: image/png` on any byte stream (e.g. an HTML/SVG-with-script payload) and it passes the check, then gets uploaded to S3 and later served back via a signed URL. Not a contract-document code path so it falls outside the literal CLAUDE.md rule, but it's the same class of bug the contract-upload code already correctly defends against — recommend the same magic-byte sniff for logo/avatar uploads.

### (b) Auth check present

**PASS overall**, with one **P0 security finding** on a related but distinct control (ownership check, not authentication):

- All 102 routes call `resolveAuth(req)` and return 401 on `null`, **except** 5 routes that are intentionally public/unauthenticated, all correctly justified:
  - `health/route.ts` — liveness probe, no auth by design.
  - `auth/[...all]/route.ts` — IS the auth provider.
  - `webhooks/docuseal/route.ts` — DocuSeal calls this directly; gated instead by HMAC-SHA256 signature verification (`webhooks/docuseal/route.ts:40-68`), fail-secure (rejects all calls if `DOCUSEAL_WEBHOOK_SECRET` is unset — good).
  - `crm/[provider]/webhook/route.ts` — external CRM webhook, resolves org via portal-id/provider lookup instead of a Bearer token (standard pattern for inbound webhooks).
  - `user/unsubscribe/route.ts` — gated by a signed unsubscribe token (`verifyUnsubscribeToken`), not session/Bearer — correct for an email-link endpoint.

- **P0 — Cross-tenant object read via unauthenticated-by-ownership signed-URL endpoints.** `org/logo/route.ts:54-66` (GET) and `user/avatar/route.ts:49-61` (GET) both call `resolveAuth` (so *some* org member must be logged in) but then take an arbitrary `key` query parameter and hand it straight to `storage.getSignedDownloadUrl(key)` **with no check that the key belongs to the caller's org or user**:
  ```
  app/api/org/logo/route.ts:58-64
    const key = searchParams.get("key")
    ...
    const signedUrl = await storage.getSignedDownloadUrl(key, 3600)
    return Response.redirect(signedUrl, 302)
  ```
  `lib/storage/index.ts:36-38` (`getSignedDownloadUrl`) performs zero ownership validation either — it just signs whatever S3 key it's given. Because the object-store key namespace is shared and predictable (`orgs/{organizationId}/contracts/{contractId}/{timestamp}_{filename}`, `orgs/{organizationId}/logo/{timestamp}_{filename}`, `avatars/{userId}/{timestamp}_{filename}` — see `lib/storage/index.ts:44-47`, `org/logo/route.ts:46`, `user/avatar/route.ts:41`), **any authenticated user in ANY organization can request `/api/org/logo?key=orgs/<victim-org-id>/contracts/<contractId>/<filename>` (or any other org's logo/avatar key) and receive a working signed download URL to that object**, bypassing the Prisma org-scope middleware entirely because this code path never touches Prisma for the file — it goes straight to S3. This is the exact class of bug the contract-file download path (`contracts/[id]/upload/route.ts:14-40`) correctly guards against — it looks up `ContractFile` by id, checks `file.contractId !== params.id` and the parent contract's `organizationId` before ever calling `getSignedDownloadUrl`. `org/logo` and `user/avatar` skip that lookup step entirely.
  - **Severity: P0.** Requires knowledge/guessing of another org's `organizationId` + `contractId` + filename (cuids — not sequential, but IDs are visible in the app's own URLs, shared links, referrer headers, screenshots, browser history, or leak via any other endpoint that echoes them), but there is *no authorization boundary at all* once a key is known — this is a textbook IDOR / broken object-level authorization finding, and it operates below (outside) the DB-level org-scope guard the rest of the app relies on.
  - **Fix:** before calling `getSignedDownloadUrl`, verify the key's prefix matches the caller's own scope — e.g. `org/logo` GET should require `key.startsWith(\`orgs/${ctx.organizationId}/logo/\`)`, and `user/avatar` GET should require `key.startsWith(\`avatars/${ctx.userId}/\`)` — return 404 otherwise (per the 404-not-403 convention).

### (c) 404 (not 403) for cross-org resources

**PASS.** Searched every `organizationId !== ctx.organizationId` (or equivalent) comparison across all routes — every one returns `404`/`Response.json({error:"Not Found"}, {status:404})` (e.g. `contracts/[id]/route.ts:106-108`, `contracts/[id]/upload/route.ts:23-24,78-79`, `folders/[id]/route.ts:34-35,58-59`, `org/invitations/[id]/route.ts:19-20,68-69`).

Also enumerated every `status: 403` response in the codebase (49 occurrences) — all are **role-based** (`hasRole`/`requireRole`/`ROLES_CAN_SYNC` checks, API-key write-scope checks, or explicit invited-role-cannot-exceed-inviter checks). None of them are used to signal "this resource exists but belongs to another org," which is the specific anti-pattern the convention forbids. No violations found.

### (d) Soft-delete only (no hard `prisma.contract.delete`)

**PASS.** `grep`'d the entire `apps/web/app` and `worker/` trees for `.contract.delete(` / `.contract.deleteMany(` — zero matches. `contracts/[id]/route.ts:290-324` (DELETE handler) only ever does `prisma.contract.update({ data: { status: "ARCHIVED" } })`, guards against double-archiving (`409` if already `ARCHIVED`), and writes the `ARCHIVED` Activity row. Confirmed correct.

Note: `Folder.delete` (`folders/[id]/route.ts:67`) and `Invitation.delete` (`org/invitations/[id]/route.ts:72`) ARE hard-deletes — but neither is a `Contract`, and the convention as written ("Soft-delete only… never hard-delete contracts") is scoped to contracts specifically, so these are in-bounds. Not a violation.

### (e) Activity table write on every contract state change

**Mostly PASS**, one gap:

- 26 route files call `writeActivity(...)`, covering upload, archive, status change, signing, approvals, obligations, comments, CRM sync, snapshots, document convert/export/import.
- **P2 — `folders/[id]/route.ts:46-71` (DELETE)**: deleting a folder does `prisma.contract.updateMany({ where: { folderId: params.id }, data: { folderId: null } })` — a bulk contract field mutation — with **no corresponding `Activity` row** for any of the affected contracts. Every other contract-field-touching route in the codebase writes an Activity entry for the change; this bulk path silently skips it, so the audit trail has a blind spot for "contract was moved out of its folder because the folder was deleted." Low severity (folderId isn't a lifecycle/status field), but it's an inconsistency with the stated convention and with how every other multi-contract-touching code path (bulk CSV import, DocuSeal webhook, obligations cron) in this codebase treats the audit trail as mandatory.

**Task 1 verdict: PASS with 1 P0 (auth/ownership gap on signed-URL routes) + 2 P2s (MIME-only validation on logo/avatar uploads; missing Activity row on folder-delete cascade).**

---

## TASK 2 — Async discipline (BullMQ / worker)

Reviewed: `apps/web/worker.ts` (2281 lines, 14 `Worker` instances), `apps/web/lib/jobs/queues.ts`, `apps/web/lib/db/worker-client.ts`, `apps/web/lib/import/processor.ts` + `handlers/csv.ts`, `apps/web/lib/alerts/check.ts` + `generate.ts`, `worker/jobs/signing-sync.ts` (referenced, not re-read in full — imported and wired at `worker.ts:93,1057`).

### Heavy work correctly moved off the request path

**PASS.** No API route does PDF/DOCX parsing, embedding generation, LLM calls, or SMTP sends inline (the one exception, `contracts/extract-preview/route.ts`, is a deliberate synchronous preview endpoint — explicitly documented via `export const maxDuration = 300` at `contracts/extract-preview/route.ts:12` and is not part of the persisted extraction pipeline; it does not touch `Contract`/`AIExtraction` rows, so it's a preview-only tool, not a violation of the "never parse inline" rule). All persisted extraction/embedding/AI-extraction/email/webhook-delivery work is enqueued via `lib/jobs/queues.ts` and processed in `worker.ts`.

### Missing / notable error handling

- **Worker Prisma has no org-scope middleware by design** (`lib/db/worker-client.ts:1-6`, explicit comment: "operates as System with no request context"). Every worker handler and `lib/import/*` file was checked for explicit `organizationId` scoping on writes that need it:
  - `lib/import/create-contract.ts:101-121` — explicitly sets `organizationId: context.organizationId` on `contract.create`. Correct.
  - `worker.ts` `contract.extract`/`contract.ai_extract`/`contract.embed`/`document.convert`/`document.export` workers all operate on a single `contractId` passed in from an already-org-validated route — correct, no cross-tenant risk since the job data itself was scoped at enqueue time.
  - `salesforce.poll` and CRM webhook handlers intentionally iterate **across all orgs** (`crmIntegration.findMany({ where: { provider } })`, no org filter) — this is correct/by-design since these are system-wide batch/webhook-dispatch jobs, not user-triggered — but worth noting explicitly since it's the one place a missing `organizationId` filter is *intentional* rather than a bug.
- **P2 — Inconsistent retry policy on `obligations.ai_extract`.** Every other AI-extraction job (`contract.ai_extract`, `contract.embed`, `contract.extract`) gets `attempts: 3` with exponential backoff (`worker.ts:406,656,770`). `obligationExtractWorker` (`worker.ts:1024-1044`) uses `attempts: 1` with no documented rationale (contrast with `email.send`'s `attempts: 1`, which has an explicit non-idempotency comment at `queues.ts:181-184`). A transient LLM API 5xx/timeout fails the obligation-suggestion job permanently with no automatic retry, silently degrading a user-facing feature that otherwise looks equivalent in design to the AI extraction pipeline.
- **P2 — Silent pipeline gap when `embed` → `ai_extract` chain fails to enqueue.** `worker.ts:679-684`, `chainAiExtract()` wraps `contractAiExtractQueue.add(...)` in `.catch(err => logger.error(...))`. The `contract.embed` job itself is marked **completed** by BullMQ regardless of whether the chained `ai_extract` enqueue succeeded. If Redis has a transient blip at exactly that moment, the contract silently never gets AI-extracted metadata, with zero user-visible signal (no Activity row, no failed-job entry) — only a log line. Given the documented "extract → embed → ai_extract" pipeline contract (`worker.ts:384-386`), this is a silent-failure gap: nothing re-drives the chain and no downstream code checks "does this contract have `AIExtraction` rows even though it has an embedding" to trigger a repair.
- **Minor/consistency note, not a bug:** `document.convert`, `document.export`, and `import.process` all use `attempts: 1` for genuinely good, documented reasons (non-idempotent partial-progress persistence, or user-facing retry buttons exist). No action needed.

### External-call resilience

**PASS overall** — every outbound HTTP call in the worker (DocuSeal poll, Slack/Teams webhook delivery, outbound webhook delivery, Ollama/Anthropic/OpenAI calls) either has an `AbortSignal.timeout`/manual `AbortController` timeout (`worker.ts:1719-1720`, 10s) or relies on BullMQ's `attempts: 3` + exponential backoff. The outbound-webhook delivery path (`worker.ts:1687-1808`) has a well-built inline 3-attempt retry with increasing delay (`RETRY_DELAYS_MS`) and a full per-attempt `WebhookDeliveryLog` audit trail — this is the strongest-designed retry path in the codebase and a good pattern.

**Task 2 verdict: PASS with 2 P2 findings** (inconsistent retry count on `obligations.ai_extract`; silent embed→ai_extract chain-enqueue failure). No P0/P1 in this task — the worker is generally well-hardened (idempotency guards, atomic claims, graceful shutdown with a 30s drain ceiling at `worker.ts:2215-2257`).

---

## TASK 3 — Data integrity bugs

### Race conditions

- **PASS — alert double-fire is explicitly guarded.** `lib/alerts/check.ts:53-57`: each alert is claimed via `prisma.contractAlert.updateMany({ where: { id: alert.id, firedAt: null }, data: { firedAt: new Date() } })` before any side effect runs; `claim.count === 0` means another worker already won the race, so it's skipped. This correctly prevents double-send even if `alerts.check` somehow ran concurrently. Comment at `check.ts:49-52` shows this was a deliberate design decision, not an accident.
- **PASS — obligation reminder double-send is guarded** the same way (`worker.ts:911-918`, atomic `updateMany` on `reminderSentAt: null`).
- **PASS — cron duplication is guarded.** Daily crons (`alerts.check`, `obligations.check`) use a fixed BullMQ `jobId` (`"alerts-daily"`, `"obligations-daily"`) specifically so worker restarts don't stack duplicate repeatable schedules (`worker.ts:2157-2184`, with an explicit comment explaining why).
- **PASS — CRM status transitions use `update-with-where` guards** (`worker.ts:2045-2049`, `crm/[provider]/webhook/route.ts:105-109`) — `prisma.contract.update({ where: { id, status: "AWAITING_SIGNATURE" }, ... })` so a concurrent transition can't push a `DRAFT` contract straight to `ACTIVE`; a `P2025` (no matching row) is caught and silently skipped rather than thrown.
- **P1 — Import retry creates duplicate/orphaned `ImportRow` records instead of updating in place.** `ImportRow` has **no unique constraint** on `(jobId, rowIndex)` (`prisma/schema.prisma:728-742` — only non-unique indexes). The retry flow is:
  1. `app/api/import/[jobId]/retry/route.ts:39-42` resets previously-failed rows: `updateMany({ where: { jobId, status: "failed" }, data: { status: "pending", errorMessage: null } })`.
  2. `lib/import/handlers/csv.ts:113-155` re-runs the **entire** row loop. Its only idempotency check is "skip if a row with this `rowIndex` already has `status: "success"`" (`csv.ts:119-126`) — it does **not** look up or reuse the row that was just reset to `"pending"`.
  3. `flushOutcomes` (`csv.ts:167-182`) always does `db.importRow.createMany(...)` — a fresh insert, never an update.

  Net effect: every retry of a previously-failed row leaves the **old row permanently stuck at `status: "pending"`** (nothing ever transitions it again) and inserts a **second, independent `ImportRow`** for the same `rowIndex` with the new outcome. Symptoms: (a) `generateErrorReport` (`processor.ts:130-149`) can list the same failed row twice across retries if it fails more than once, (b) the `ImportRow` table accumulates unbounded stale `"pending"` ghosts that never get cleaned up, (c) anything that later queries "how many rows for this job have status X" via raw counts (rather than the in-memory `succeeded`/`failed` counters that `runCsvHandler` recomputes from scratch each run) would double-count. The aggregate `ImportJob.succeededRows/failedRows/totalRows` fields themselves stay accurate (they're recomputed from local counters each full run, not from a DB `count()`), so this is a **dirty-data / audit-trail bug, not a currently user-visible wrong-total bug** — but it will surface the moment anyone builds a per-row detail view or a "retry count per row" feature, or writes a migration script that assumes `(jobId, rowIndex)` is unique.
  - **Fix:** add `@@unique([jobId, rowIndex])` to `ImportRow` and change `flushOutcomes` to `upsert` (or delete-then-insert) instead of blind `createMany`.

### Transactions for multi-table writes

**PASS** on every multi-table write path checked:
- `contracts/[id]/upload/route.ts:118-155` — file upload + version bookkeeping wrapped in `prisma.$transaction(async (tx) => {...})`, explicit comment explaining why (crash between `updateMany` and `create` would otherwise leave zero rows marked `isLatest`).
- `webhooks/docuseal/route.ts:241-271` — marking prior file non-latest + creating the new signed file + flipping contract status is one `$transaction([...])` array.
- `worker.ts:830-870` (obligations overdue sweep) — status `updateMany` + `Activity.createMany` wrapped in one transaction, with notification enqueue deliberately kept *outside* the transaction (correct — BullMQ can't participate in a Postgres transaction) and a documented re-notify-on-next-run fallback via `updatedAt` windowing if the enqueue fails.
- `worker.ts:749-757` (chunk embeddings) — collects all chunk embeddings first, only swaps `ContractChunkEmbedding` rows in a transaction once at least one succeeded, explicitly to avoid the old bug (documented in the code) where a mid-loop failure left the table empty.
- `org/invitations/[id]/accept/route.ts:63-77` — `Member.create` + `Invitation.update(status: accepted)` in one `$transaction([...])`.

### N+1 / unbounded queries on list endpoints

Most list endpoints correctly cap results with `take` (contracts, activities, notifications, templates, alerts, renewals, search, analytics, import jobs). Two do not:

- **P1 — `app/api/obligations/route.ts:34-49`** (org-wide obligations list, not the per-contract one): `prisma.contractObligation.findMany({ where: {...}, include: { assignee, completedBy, createdBy, subTasks: { include: { completedBy } }, contract } })` — **no `take`/pagination at all**, and it's a deeply nested include (obligations → sub-tasks → each with its own user-relation include) across **every contract in the org**. For an org with hundreds of contracts and obligations, this is an unbounded result set with N+1-shaped nested includes returned in a single response. This is the highest-risk unbounded query found — it scales with total org history, not with a page size.
- **P2 — `app/api/contracts/[id]/comments/route.ts:32-39`** and **`app/api/contracts/[id]/snapshots/route.ts:28-37`** — both `findMany` with no `take`, scoped to a single contract so the blast radius is smaller, but a long-lived heavily-negotiated contract (frequent comments, frequent document saves creating snapshots) has no cap and will keep growing the response payload indefinitely.

### Date / timezone bugs in renewal alert calculations

- **PASS on the core alert-window math.** `lib/alerts/generate.ts:31-86` computes `triggerDate = endDate - N*86_400_000ms` uniformly in UTC millisecond arithmetic (no local-timezone `Date` component math like `.setDate()`), which sidesteps DST-shift-by-an-hour bugs — day-based offsets computed via constant millisecond subtraction are DST-safe by construction. `checkAndFireAlerts` (`lib/alerts/check.ts:27-34`) fires anything with `triggerDate: { lte: new Date() }`, i.e. server-clock-relative, consistent with the "UTC everywhere" approach.
- **Not evaluated / flagged as a gap, not a confirmed bug:** there is no explicit test coverage found (within the files read) for the specific edge case CLAUDE.md-adjacent conventions call out — a contract with `endDate` exactly at a DST cutover instant, or a `noticePeriodDays` value that crosses a leap day/year boundary. The millisecond-arithmetic approach should handle these correctly by construction (it never touches calendar components), but this wasn't independently verified with a constructed test case since running the test suite was out of scope for this audit (owned by another agent). **Recommend the test-suite-owning agent add an explicit fixture**: a contract with `endDate` = the literal moment of a DST transition and `noticePeriodDays` spanning Feb 29 on a leap year, asserting the generated `ContractAlert.triggerDate` values.

**Task 3 verdict: PASS with 1 P1 (import retry creates duplicate/orphaned ImportRow records — no unique constraint) + 1 P1 (unbounded org-wide obligations query) + 2 P2s (unbounded per-contract comments/snapshots lists) + 1 recommendation (add DST/leap-year fixture, not independently verified here).**

---

## Failure Mode Matrix

| # | Category | Tested | Evidence |
|---|---|---|---|
| 1 | Empty input | Partial | Zod schemas across mutation routes use `.optional()`/`.nullable()` consistently and reject missing required fields (e.g. `title: z.string().min(1)` in `contracts/[id]/route.ts:32`, `create-contract.ts:93-96`); CSV import handler explicitly throws `"title: required"` on empty title (`csv.ts:196,277-279`). Did not execute requests against a live server — this is a static-read verification, not a runtime confirmation. |
| 2 | Huge input | Yes | Explicit size caps found and verified by grep: 50MB contract file cap (`contracts/[id]/upload/route.ts:60,93`), 2MB org logo (`org/logo/route.ts:6,41`), 5MB avatar (`user/avatar/route.ts:5,36`), 10MB CSV + 1000-row cap (`import/csv/preview/route.ts:7-8,36-64`), 8000-char extraction text truncation (`contracts/extract-preview/route.ts:15,147`), per-provider LLM text-length budget (`worker.ts:270-281`). |
| 3 | Special chars / injection | Yes | Filenames sanitized via `replace(/[^a-zA-Z0-9._-]/g, "_")` at every upload site (upload, logo, avatar, import create-contract `sanitizeFilename` with explicit path-traversal stripping at `create-contract.ts:62-71`); free-text fields (`counterpartyName`, `notes`, `governingLaw`) stripped of HTML tags before persistence (`contracts/[id]/route.ts:161-164`) to block stored-XSS; all DB access goes through Prisma (parameterized), no raw string-interpolated SQL found except the pgvector `$executeRaw` calls in `worker.ts:698-705,750-757`, which use tagged-template parameter binding (Prisma's `$executeRaw` template literal, not string concatenation) — safe from injection. |
| 4 | Concurrency / races | Yes | See "Race conditions" in Task 3 above — alert double-fire, reminder double-send, cron double-registration, and CRM status transitions all have verified atomic guards. One gap found: import-row retry (P1) is not a race per se but a repeatable-operation idempotency gap with the same root cause (no unique constraint to make the operation naturally idempotent). |
| 5 | Auth / authz | Yes | 97/102 routes confirmed to call `resolveAuth` + return 401; 5 justified exceptions (health/auth/webhooks) documented above. Cross-org checks verified to return 404 everywhere, never 403. **One P0 found**: `org/logo` + `user/avatar` GET endpoints authenticate the caller but never verify the requested S3 `key` belongs to that caller's org/user — full IDOR to any object in the shared bucket once a key is known. |
| 6 | Numeric extremes | Yes | `value: z.number().positive()` rejects negative/zero contract values (`contracts/[id]/route.ts:37`); `noticePeriodDays: z.number().int().min(0)`; CSV import numeric parsing rejects negative values (`csv.ts:217`); AI-extraction confidence scores explicitly clamped `Math.max(0, Math.min(1, conf))` (`worker.ts:579`) guarding against the model returning out-of-range/NaN/Infinity confidence. |
| 7 | State / lifecycle | Yes | Full contract status state-machine with an explicit transition table (`contracts/[id]/route.ts:17-27`) rejecting invalid transitions with 422; guard against advancing `PENDING_APPROVAL → AWAITING_SIGNATURE` while approvals are open (`contracts/[id]/route.ts:176-186`); `update-with-where` status guards in CRM sync paths prevent stale-state races (see Task 3). |
| 8 | Network / external | Yes | See Task 2 — timeouts on all outbound HTTP calls, 3-attempt exponential backoff on extraction/embedding jobs, documented single-attempt rationale for non-idempotent sends, full delivery-log audit trail with inline retry on outbound webhooks. One P2 gap: silent embed→ai_extract chain-enqueue failure (Task 2). |
| 9 | Data already there / dirty data | Yes | **P1 finding**: `ImportRow` duplicate-on-retry (no unique constraint) is exactly this failure mode — reprocessing dirty/partial state creates orphaned rows rather than cleanly resuming. CSV import otherwise degrades per-row (one bad row doesn't halt the batch) and generates a downloadable error-report CSV. |
| 10 | Time / TZ | Partial | Alert-window math verified to be UTC-millisecond-based (DST-safe by construction, no calendar-component arithmetic) — see Task 3. Not independently exercised with a constructed DST/leap-year fixture since running tests was out of scope for this audit; flagged as a recommendation for the test-suite-owning agent, not a confirmed bug. |

---

## Summary

| Task | Verdict |
|---|---|
| Task 1 — Convention sweep | **PASS with 1 P0 + 2 P2** |
| Task 2 — Async discipline | **PASS with 2 P2** |
| Task 3 — Data integrity | **PASS with 2 P1 + 2 P2 + 1 recommendation** |

### P0 (must fix before ship)
1. `apps/web/app/api/org/logo/route.ts:54-66` and `apps/web/app/api/user/avatar/route.ts:49-61` — GET handlers return a signed S3 download URL for an arbitrary caller-supplied `key` with no verification the key belongs to the authenticated caller's org/user. Cross-tenant IDOR to any object in the shared storage bucket (contract files, other orgs' logos, other users' avatars) once a key is known or guessed. Fix: validate `key` starts with the caller's own storage prefix before signing, return 404 otherwise.

### P1 (should fix)
2. `apps/web/app/api/obligations/route.ts:34-49` — org-wide obligations list has no pagination (`take`) and deeply nested includes; scales unbounded with org history.
3. `apps/web/lib/import/handlers/csv.ts:113-182` + `apps/web/prisma/schema.prisma:728-742` (`ImportRow`) — no unique constraint on `(jobId, rowIndex)`; retry path creates duplicate rows and leaves stale `"pending"` ghosts instead of updating in place.

### P2 (nice to fix)
4. `apps/web/app/api/org/logo/route.ts:5,32` / `apps/web/app/api/user/avatar/route.ts:4,27` — image upload type-checking uses client-supplied MIME string only, not magic bytes (inconsistent with the contract-upload path's correct approach).
5. `apps/web/app/api/folders/[id]/route.ts:46-71` — folder deletion bulk-reassigns contracts (`folderId: null`) with no Activity row written for the affected contracts.
6. `apps/web/worker.ts:1024-1044` — `obligations.ai_extract` uses `attempts: 1` with no documented rationale, unlike its sibling AI-extraction jobs which get 3 retries.
7. `apps/web/worker.ts:679-684` — `embed → ai_extract` chain-enqueue failure is swallowed by `.catch(logger.error)`; the `contract.embed` job still reports "completed" even though the pipeline silently stopped short, with no Activity row or alerting.
8. `apps/web/app/api/contracts/[id]/comments/route.ts:32-39` and `apps/web/app/api/contracts/[id]/snapshots/route.ts:28-37` — unbounded per-contract list queries (lower risk than #2, but same class).

### Recommendation
9. Add an explicit DST-transition + leap-year test fixture for `generateAlertsForContract` — the UTC-millisecond arithmetic looks correct by inspection but wasn't independently exercised at runtime in this audit.
