# ClauseFlow / Aakd — Security & Multi-Tenancy Audit
Date: 2026-07-16
Auditor: qa-tester (adversarial)
Scope: apps/web/lib/db, apps/web/lib/auth, apps/web/app/api/**, worker/**

---

## TASK 2 — Auth surface

### 2.1 `resolveAuth` — both paths enforce org context

`apps/web/lib/auth/middleware.ts:7-86`.

- **Session path** (`:12-43`): resolves `session.session.activeOrganizationId`, falls back to the user's first membership. Looks up the `Member` row and returns `{ userId, organizationId, role, source: "session" }`. Every returned context carries a real, DB-verified `organizationId` — a session cannot exist without a corresponding membership row. OK.
- **Bearer path** (`:46-82`): `cf_live_` prefix check → SHA-256 `lookupHash` DB lookup → `bcrypt.compare(bearer, apiKey.keyHash)` → checks `revokedAt`/`expiresAt` → derives role from `apiKey.createdById`'s *current* membership (not a stale snapshot — so if the creator is later demoted/removed, the key's effective role changes/breaks accordingly, which is the safer failure mode) → falls back to `"member"` if the creator's membership is gone, rather than granting nothing or admin. OK, matches CLAUDE.md's "two-path" spec.

**Task 2.1 verdict: PASS.**

### 2.2 API key storage — no raw key persisted

`apps/web/lib/auth/api-keys.ts:11-18` — `generateApiKey()` returns `{ raw, keyHash: bcrypt.hash(raw,10), lookupHash: sha256(raw), prefix: raw.slice(0,20) }`. `apps/web/prisma/schema.prisma:144-159` (`ApiKey` model) stores only `keyHash`, `lookupHash`, `prefix` — no `raw`/plaintext column exists in the schema at all.

Grepped the full `apps/web` and `worker/` trees for any other place a raw `cf_live_` value might be persisted or logged:
```
grep -rn "cf_live_" apps/web/lib apps/web/app worker/  → only in api-keys.ts (generation) and middleware.ts (prefix check `bearer?.startsWith("cf_live_")`)
```
The raw key is returned once in the `POST /api/org/api-keys` response body (`route.ts:103`, `rawKey: raw`) and never written to any log statement, DB column, or the `WebhookDeliveryLog`/`Activity` audit tables. **Task 2.2 verdict: PASS.**

### 2.3 Every route calls `resolveAuth` or is intentionally public

Grepped every `app/api/**/route.ts` for the absence of `resolveAuth`. 5 files skip it:

| Route | Public by design? | Protection |
|---|---|---|
| `app/api/auth/[...all]/route.ts` | Yes — Better Auth's own handler (login/signup/session) | Better Auth manages its own auth flows |
| `app/api/health/route.ts` | Yes — liveness probe | No sensitive data |
| `app/api/webhooks/docuseal/route.ts` | Yes — external webhook | HMAC-SHA256 signature, **fail-secure** (rejects all calls if `DOCUSEAL_WEBHOOK_SECRET` unset — `verifySignature:40-49`), `timingSafeEqual` compare, SSRF guard (`isAllowedDocuSealUrl`) before fetching the signed-document URL (`:203-206`). Well-built. |
| `app/api/crm/[provider]/webhook/route.ts` | Yes — external webhook | HubSpot (`lib/crm/hubspot.ts:277-349`) and Pipedrive (`lib/crm/pipedrive.ts:249-312`) both verify an HMAC-SHA256 signature (keyed by the OAuth app's client secret — correct per each vendor's real webhook-signing scheme) with `timingSafeEqual`; HubSpot additionally enforces a 5-minute freshness window for replay protection (`hubspot.ts:286-292`). Salesforce is polling-only and explicitly rejected (`crm/[provider]/webhook/route.ts:12-15`). Establishes `requestContext` with the matched integration's `organizationId` before any write, so the org-scope middleware covers the writes too (`route.ts:66-74`). Good defense in depth. |
| `app/api/user/unsubscribe/route.ts` | Yes — one-click unsubscribe link in emails | HMAC-signed token (`lib/notifications/unsubscribe-token.ts`) with expiry (90 days) and `timingSafeEqual` compare; additionally re-verifies the decoded `userId`/`orgId` still form a real `Member` row before writing the preference (`route.ts:19-25`). OK. |

**Task 2.3 verdict: PASS.** All 5 unauthenticated routes are legitimately public and each has real cryptographic protection appropriate to its threat model (or, for `health`/Better-Auth's own handler, needs none).

### 2.4 404-not-403 on cross-org access

Sampled ~20 routes across contracts, snapshots, obligations, templates, snippets, folders, tags, import jobs, and the MCP tool handlers. Every single one returns `404`/"Not Found" (not `403`) when a resource exists but belongs to a different org — e.g. `contracts/[id]/upload/route.ts:23-24`, `contracts/[id]/ask/route.ts:194-201`, `contracts/[id]/snapshots/route.ts:24-26`, `mcp/route.ts:508-514` (`toolGetContract`), `import/[jobId]` handlers. I did not find a single instance of a route leaking cross-org resource existence via a `403`. **Task 2.4 verdict: PASS.**

### 2.5 Additional findings surfaced while reviewing auth-adjacent routes

**[P2] Finding 2.5.1 — `PATCH /api/org/members/[id]` allows any admin to demote the org's sole `owner`, with no "last owner" protection (only "last admin" is guarded).**
- `apps/web/app/api/org/members/[id]/route.ts:43-55` — the "don't demote the last admin" guard only fires `if (member.role === "admin" && ...)`. If `member.role === "owner"`, an admin (rank 4) can PATCH the owner (rank 5) down to `"viewer"` via the same endpoint — the `UpdateMemberSchema` role enum (`admin|legal|member|viewer`) correctly prevents anyone from being *promoted* to `"owner"`, but nothing stops the *existing* owner from being demoted by a lower-ranked admin, and there is no check that `ctx.role` must equal or exceed the target member's current rank before mutating it. Exploit scenario: an org has 1 owner + 2 admins. Either admin calls `PATCH /api/org/members/<owner-member-id>` with `{"role":"viewer"}` — succeeds, no error, no last-owner check. The org now has zero owners (assuming "owner" isn't separately tracked by Better Auth's `organization` plugin outside the `Member.role` string — worth confirming that plugin doesn't maintain its own ownership invariant elsewhere, but this route has none). **Not cross-tenant** (same-org privilege abuse only), so P2 not P0/P1, but worth fixing before it's someone's incident: add `if (member.role === "owner" && ctx.role !== "owner") return 403`.

**[P2] Finding 2.5.2 — Outbound webhook SSRF guard is registration-time only; no re-validation at delivery time (DNS-rebinding TOCTOU).**
- `apps/web/lib/notifications/validate-webhook-url.ts` is well-built (blocks RFC-1918/loopback/link-local/IMDS ranges, resolves DNS, rejects literal private IPs) and is called from `app/api/org/webhooks/route.ts:83` at **creation** time only. The actual delivery path (`notification.fanout` → `notificationDeliverQueue` → the `deliver` worker that does the real `fetch(webhookUrl)`) was not found to call `validateWebhookUrl` again before dispatch (grepped `worker.ts` and `worker/jobs/` for `validateWebhookUrl` — zero hits outside the registration route). An attacker who controls DNS for a domain they register as a webhook target can pass validation with a public IP, then repoint the A/AAAA record to `169.254.169.254` or `127.0.0.1` before the next delivery — every subsequent `contract.*` event fires an SSRF-capable request from the worker process. Low severity because it requires an admin-level actor (webhook creation is admin-gated) and DNS control, but it's a real, fixable gap: re-run `validateWebhookUrl` (or at least the IP-literal check against the resolved address actually used by `fetch`) immediately before each delivery attempt, not just at registration.

---

## TASK 1 — Org isolation

### 1.1 Middleware coverage (`apps/web/lib/db/client.ts`)

`ORG_SCOPED_MODELS` (client.ts:11-23) currently contains:
`Contract, Folder, Tag, ApiKey, OrgNotificationChannel, OutboundWebhook, UserNotificationPreference, ContractTemplate, ContractObligation, CrmIntegration, ImportJob`

Cross-checked against `prisma/schema.prisma` for every model that has a **direct** `organizationId` column (i.e. a real candidate for the set, per the file's own stated rule "Only models that have a direct organizationId column should be in this set"):

| Model | Has direct `organizationId`? | In `ORG_SCOPED_MODELS`? |
|---|---|---|
| Contract | yes | yes |
| Folder | yes | yes |
| Tag | yes | yes |
| ApiKey | yes | yes |
| OrgNotificationChannel | yes | yes |
| OutboundWebhook | yes | yes |
| UserNotificationPreference | yes | yes |
| ContractTemplate | yes | yes |
| ContractObligation | yes | yes |
| CrmIntegration | yes | yes |
| ImportJob | yes | yes |
| **DocumentSnapshot** (schema.prisma:519) | **yes** | **NO** |
| **Notification** (schema.prisma:777) | **yes** | **NO** |
| **OrgAiConfig** (schema.prisma:799) | **yes** | **NO** |
| **ClauseSnippet** (schema.prisma:812) | **yes** | **NO** |

**[P1] Finding 1.1 — 4 models with a direct `organizationId` column are excluded from the auto-scoping middleware, with no compile-time or lint-time guard forcing the omission to be reviewed.**

- `apps/web/lib/db/client.ts:11-23` (the `ORG_SCOPED_MODELS` set)
- `apps/web/prisma/schema.prisma:515-530` (`DocumentSnapshot`), `:774-793` (`Notification`), `:797-806` (`OrgAiConfig`), `:810-825` (`ClauseSnippet`)

**Exploitability today: NOT exploitable** — I traced every route that touches these 4 models and each one manually re-implements the org check:
- `DocumentSnapshot`: `app/api/contracts/[id]/snapshots/route.ts:24,66`, `.../snapshots/[snapshotId]/route.ts:31,62`, `.../snapshots/compare/route.ts:37,54,77` — all compare `snapshot.organizationId !== ctx.organizationId` (and `contractId`) before returning/deleting.
- `Notification`: `app/api/notifications/route.ts` and `.../read-all/route.ts` explicitly filter `userId: ctx.userId` + an `organizationId`/`org.invited` OR clause. Comment at `write-in-app.ts:13-14` documents this is intentional.
- `OrgAiConfig`: `app/api/org/ai-config/route.ts`, `app/api/ai-status/route.ts`, `lib/ai/resolve.ts` all key the lookup by `organizationId: ctx.organizationId` (1:1 model, no id-based lookup exists).
- `ClauseSnippet`: `app/api/snippets/route.ts:23,56`, `.../snippets/[id]/route.ts:18` (`findFirst({ where: { id, organizationId } })`).

So this is a **fragile-by-convention** pattern, not a live vulnerability: every current call site happens to remember to add the filter. The risk is entirely prospective — the middleware's own safety net (which every other tenant-scoped model relies on) is silently absent for these 4 models, so the *next* route added against any of them (a new GET-by-id, a new admin export endpoint, a future MCP tool, etc.) has no structural protection and will only be caught by manual code review. This exact class of bug (relying on every call site to remember a filter) is how M2's self-approval and SSRF bugs shipped previously (see project memory). Given `Notification`, `DocumentSnapshot`, `ClauseSnippet`, `OrgAiConfig` are all recently added (M11/M12 era) and CLAUDE.md's own multi-tenancy section says "This is enforced via Prisma middleware — not per-route manually" — the current state contradicts that stated invariant.

**Suggested fix:** add all 4 to `ORG_SCOPED_MODELS`. I did not verify this won't break the intentional `Notification` OR-clause widening for `org.invited` (adding `Notification` to the auto-scope set would force `organizationId: ctx.organizationId` onto every notification query including that OR-branch, which would break the cross-org invite-notification feature by design) — that needs a real fix decision (either an explicit exemption comment for `Notification` explaining why it's deliberately excluded, which already exists in `write-in-app.ts:13-14` but is *not* mirrored in `client.ts`'s own comment, or a raw-SQL/explicit-only path). At minimum, add DocumentSnapshot, OrgAiConfig, and ClauseSnippet to the set (no known reason they're excluded), and add an explicit code comment in `client.ts` next to the set (not just in `write-in-app.ts`) documenting why `Notification` is deliberately excluded, so a future edit doesn't "fix" it by adding it there and silently breaking cross-org invites, or does so knowingly.

### 1.2 Raw SQL — `$queryRaw` / `$executeRaw` audit

No `queryRawUnsafe` / `executeRawUnsafe` anywhere in the repo (grep clean) — good, no raw string interpolation into SQL. All raw queries use tagged-template `Prisma.sql` / plain tagged `prisma.$queryRaw` (parameterized).

Raw-SQL call sites, all manually re-check org scope in the `WHERE`:
- `app/api/search/route.ts:91-160` — FTS query, `WHERE "organizationId" = ${orgId}` present in all 3 raw statements. OK.
- `app/api/search/semantic/route.ts:93-113` — joins `ContractEmbedding` → `Contract`, filters `c."organizationId" = ${ctx.organizationId}`. OK.
- `app/api/analytics/summary/route.ts:67-190` — 4 raw queries, all have explicit `WHERE "organizationId" = ${ctx.organizationId}` (or joined via Contract). OK. Comments even call out "Raw query requires explicit org predicate (not auto-scoped)" — good self-documentation.
- `app/api/contracts/[id]/ask/route.ts:117-129` — joins `ContractChunkEmbedding` → `Contract`, filters `c."organizationId" = ${organizationId}` AND `contractId = ${contractId}` (contractId itself was already verified against ctx org at line 199 before this is called). Comment explicitly calls this "Defense in depth". OK.
- `app/api/mcp/route.ts:426-444` (search_contracts), `:636-656` (semantic_search), `:973-981` (analytics) — same pattern, org predicate present in every raw query. OK.

**Task 1.2 verdict: PASS.** No raw-SQL org-scope bypass found.

### 1.3 Sweep for `findUnique`/`findFirst` by bare `id` without a subsequent org check

Methodology: grepped every `app/api/**/route.ts` for `findUnique`/`findFirst` on tenant-scoped models, then manually verified each call site either (a) has `organizationId` in the `where`, or (b) checks the returned row's `organizationId`/parent chain against `ctx.organizationId` before use.

Findings — all clean (org check present) in every file inspected: `contracts/[id]/*`, `folders/[id]`, `tags/[id]`, `templates/[id]`, `templates/[id]/use`, `snippets/[id]`, `obligations/*`, `org/api-keys/[id]`, `org/webhooks/[id]`, `org/notification-channels/[id]`, `crm/[provider]/*`, `import/[jobId]/*`, `mcp/route.ts` (every tool handler re-checks `contract.organizationId !== orgId` / `job.organizationId !== orgId` before returning data — see `toolGetContract:512`, `toolAskContract:688`, `toolGetImportJob:1142`, `toolListObligations:767`, `toolListCrmLinks:1068`).

I did not find a single raw `findUnique`/`findFirst` call in the API tree that skips the org check. Continuing to Task 1.4 for the worker process (background jobs run outside HTTP request context, so `requestContext`/middleware auto-scoping is not active there by construction — every worker query must be manually scoped).

**Task 1.3 verdict: PASS** (with the caveat in 1.1 about fragility, not a live bug).

### 1.4 Worker process (`worker/`, `apps/web/worker.ts`)

Worker jobs run outside any HTTP request, so `getRequestContext()` returns `null` and the org-scope Prisma extension is a no-op for every query the worker makes (see `client.ts:48-56` — when `!ctx?.organizationId`, it logs a warning if the model is org-scoped and passes the query through **unscoped**). This means **every worker query must manually filter by `organizationId` or by a FK chain that terminates at a specific contract/org** — there is zero structural protection here.

Reviewed `apps/web/worker.ts` (2281 lines — `contract.extract`, `contract.ai_extract`, `contract.embed`, `alerts.check`, `obligations.check`, `signing.sync` (delegates to `worker/jobs/signing-sync.ts`), `email.send`, `notification.fanout`) and `worker/jobs/signing-sync.ts`. Every job's `job.data` is a `contractId`/`organizationId`/`webhookId`/`channelId` value that was placed there by an already-org-scoped API route or a cron job iterating all orgs deliberately (`alerts.check`, `obligations.check` — these two intentionally scan across all orgs, which is correct: they are the scheduled sweep, not a per-tenant read). None of these queues accept raw end-user input directly (no queue is populated from an unauthenticated HTTP body) — the untrusted-input boundary is the API route that calls `queue.add(...)`, which is where org checks already happen (verified in 1.3). `notification.fanout`'s `createInAppNotifications` and the Slack/Teams/webhook fanout all key off `contract.organizationId` resolved from the DB via the job's `contractId`, not a caller-supplied `organizationId`, so a forged job payload would need queue-injection (Redis access), which is out of scope for an HTTP-facing audit.

**Task 1.4 verdict: PASS** (worker is not a direct attacker-facing surface; org context flows from already-validated route-level checks).

### Task 1 overall verdict

**PARTIAL PASS.** No live/exploitable org-isolation bypass found in the current codebase — every route I found touching a non-auto-scoped model manually re-implements the check. But Finding 1.1 (P1) is real: the middleware's own safety net silently excludes 4 models with direct `organizationId` columns, contradicting CLAUDE.md's stated invariant ("enforced via Prisma middleware — not per-route manually"). This is the exact shape of prior M2 bugs (see project memory `ceo/project_clauseflow_bugreport_2026-05-12.md` — "Prisma org isolation broken" was previously a live P0). Recommend closing Finding 1.1 before the next milestone that touches any of these 4 models.

**Update from Task 3 (below): a live, exploitable, cross-tenant bypass DOES exist — but it's a storage-layer authorization gap (2.6/3.1), not a Prisma org-scope gap. See Finding 3.1.**

---

## TASK 3 — Input attack surface

### 3.1 File upload endpoints

**[P0] Finding 3.1 — `GET /api/org/logo?key=<arbitrary>` and `GET /api/user/avatar?key=<arbitrary>` sign and redirect to ANY object key in the shared S3/MinIO bucket, for ANY authenticated caller, with zero ownership check.**

- `apps/web/app/api/org/logo/route.ts:54-66` (`GET`):
  ```ts
  const key = searchParams.get("key")           // fully attacker-controlled
  const signedUrl = await storage.getSignedDownloadUrl(key, 3600)
  return Response.redirect(signedUrl, 302)
  ```
- `apps/web/app/api/user/avatar/route.ts:49-61` — identical pattern.
- `apps/web/lib/storage/index.ts:36-38` — `getSignedDownloadUrl(key)` takes a bare string and signs a `GetObjectCommand` for that exact key against the single shared bucket (`STORAGE_BUCKET`, default `"aakd"` — `index.ts:26-28`). There is **no prefix/ownership check anywhere in the storage layer** — it is a thin wrapper over the S3 SDK.

**Exploit:** any authenticated user — of *any* organization, at *any* role including `viewer` — can call `GET /api/org/logo?key=orgs/<other-org-id>/contracts/<contract-id>/<timestamp>_<filename>` (the exact key format produced by `storage.storageKey()`, `lib/storage/index.ts:44-47`, and used for every contract file, signed document, and DocuSeal-downloaded PDF in the bucket) or `imports/<other-org-id>/<job-id>/...` (CSV/ZIP import sources and manifests) or `avatars/<any-user-id>/...`, and receive a valid, time-limited, pre-signed S3 URL to that object — a full read primitive into any tenant's contract files, so long as the key is known or guessed. This completely bypasses every org-scope check audited in Task 1 (Prisma middleware, manual `organizationId` comparisons, 404-not-403 pattern) because it operates one layer below the database: the DB row's `organizationId` is never consulted, only the raw bucket key the client supplies.

Compare this to the *correct* pattern used everywhere else contract files are downloaded — `app/api/contracts/[id]/upload/route.ts:14-39` (`GET`) looks up the `ContractFile` row by `fileId`, verifies `file.contractId !== params.id` and the parent contract's `organizationId !== ctx.organizationId` **before** calling `storage.getSignedDownloadUrl`. The logo/avatar routes skip that DB-lookup-and-compare step entirely and trust the client-supplied key wholesale.

**Practical exploitability caveat:** this requires knowing or guessing a valid key. Contract/user/org IDs are Prisma `cuid()`s (122-bit-ish random, not sequentially guessable), so blind brute-force is impractical. But the bar for *knowing* a key is very low in practice: keys appear in server logs (`logger.error({ storageKey: key, ... })` is used in multiple upload routes, e.g. `contracts/[id]/upload/route.ts:111`, `import/batch/route.ts:64,131`), in browser history/Referer headers (the `downloadUrl` for a file is returned to the client and the underlying key is embedded in it), potentially in error messages returned to users, or simply by an insider at one org sharing/leaking a URL. More importantly, this is a **structural authorization bug**, not a defense that merely relies on ID entropy — the correct fix does not depend on key secrecy at all: validate that the requested key is actually owned by `ctx.organizationId` (for `/api/org/logo`, require the key to start with `orgs/${ctx.organizationId}/logo/`) or `ctx.userId` (for `/api/user/avatar`, require `avatars/${ctx.userId}/`) before signing, exactly like every contract-file download route already does via a DB lookup.

**Suggested fix:** in both routes' `GET` handler, reject the request (404) unless `key.startsWith(\`orgs/${ctx.organizationId}/logo/\`)` / `key.startsWith(\`avatars/${ctx.userId}/\`)` respectively. Better: store the current logo/avatar key on the `Organization`/`User` row (already implied by the upload flow) and look it up server-side instead of trusting a client-supplied `key` param at all — removes the parameter entirely.

**Everything else in the file-upload surface is solid:**
- Magic-byte validation, not MIME header, for contract files: `contracts/[id]/upload/route.ts:42-58` (`validateFileType`) checks the PDF magic bytes (`%PDF` = `0x25 0x50 0x44 0x46`) and, for DOCX, the ZIP header (`PK\x03\x04`) **plus** a `word/` substring check to reject bare ZIPs/XLSX/ODT renamed to `.docx` — good, matches CLAUDE.md's "validate by magic bytes, not MIME header" requirement exactly. The org/avatar/logo image uploads (`user/avatar/route.ts:27`, `org/logo/route.ts:32`) validate by `file.type` (MIME) only, not magic bytes — weaker, but the blast radius is limited (images are rendered as `<img>`, not parsed as PDF/DOCX/contract content) and CLAUDE.md's magic-byte requirement is scoped to contract file uploads specifically, so I'm not flagging this as a separate finding beyond noting it here.
- 50MB cap enforced both client-declared (`file.size > MAX_SIZE`, `upload/route.ts:93`) and re-checked against the actual downloaded buffer size in the batch importer (`lib/import/handlers/batch.ts:15,67`) — no cap bypass via a lying `Content-Length`.
- Filename sanitization is consistent everywhere a filename touches a storage key: `upload/route.ts:105` (`filename.replace(/[^a-zA-Z0-9._-]/g, "_")`), `storage/index.ts:45` (same pattern inside `storageKey()`), `org/logo/route.ts:8-10`, `user/avatar/route.ts:7-9` — all strip everything except alphanumerics, `.`, `_`, `-`, so `../../etc/passwd`-style filenames cannot inject path segments into the storage key. Zip-slip is separately guarded in the batch importer (`lib/import/handlers/batch.ts:197-204`, `shouldSkipEntry` rejects any zip entry path containing `../`, `..\\`, or starting with `/`), and the PandaDoc/CLM-export zip handlers never write extracted paths to the filesystem or storage at all (`fflate.unzipSync` output stays in an in-memory `Map` keyed by directory string, and only exact-match filenames like `document.pdf`/`metadata.json` are ever read out of it), so a hostile path inside those archives is simply ignored rather than acted on — no traversal vector there either.

**[P1] Finding 3.2 — Zip-bomb / unbounded-decompression risk in the ZIP-based importers (`batch.ts`, `pandadoc.ts`, `clm-export.ts`).**

All three call `fflate.unzipSync(zipBuffer)` (`lib/import/handlers/batch.ts:160`, `pandadoc.ts:57`, `clm-export.ts:38`) — this synchronously inflates **every entry in the archive into memory in one call**, before any size check runs. The only guard anywhere in this pipeline is on the *compressed* upload size (`MAX_ZIP_BYTES = 500MB` at `app/api/import/batch/route.ts:11`, `pandadoc/route.ts:11`, `clm-export/route.ts:11`). `batch.ts`'s `handleZip` does track `totalSize` against `MAX_TOTAL_BYTES` (`batch.ts:172-181`), but that check runs *after* `unzipSync` has already fully decompressed the archive (`:151-160` — `unzipSync` call precedes the size-tracking loop) — it only prevents *further processing* of an oversized result, not the decompression itself. `pandadoc.ts` and `clm-export.ts` have no decompressed-size cap at all, only `MAX_DOCUMENTS = 50` on the *count* of document directories processed, which does nothing to limit the memory spent on `unzipSync` itself. A ~1MB crafted zip bomb (compression ratios of 1000:1+ are routine with the DEFLATE algorithm on repetitive content) could pass the 500MB compressed-size gate easily and force the worker process to allocate gigabytes inflating it synchronously — a worker-process OOM/DoS. This requires an authenticated org member with import write-scope (not anonymous), so it's an insider/compromised-account risk rather than a pre-auth one, but the worker process (`apps/web/worker.ts`) is shared infrastructure serving all tenants' background jobs, so one org's malicious import can degrade or crash processing for every other org's queued jobs (`contract.extract`, `contract.embed`, `alerts.check`, etc. all share the same Node process). **Suggested fix:** switch to fflate's streaming API (or a decompression-ratio guard that aborts if inflated bytes exceed e.g. 10x the compressed size) before allocating the full inflated buffer, and isolate the worker's import-processing into a separate process/container from the tenant-critical `contract.extract`/`alerts.check` workers so a crash there doesn't take down unrelated jobs.

### 3.2 Webhook endpoints (DocuSeal / CRM)

Signature verification and replay protection for both webhook surfaces were already audited in depth under **Task 2.3** (see table above) — DocuSeal uses fail-secure HMAC-SHA256 with `timingSafeEqual`, HubSpot/Pipedrive both verify HMAC-SHA256 keyed by their OAuth client secret with `timingSafeEqual`, and HubSpot additionally enforces a 5-minute freshness window against replay. Not re-auditing here per the team lead's note. One item that *is* new to Task 3's remit — path/URL handling inside the DocuSeal webhook handler:

- `apps/web/app/api/webhooks/docuseal/route.ts:196-206` — before fetching the signed document, the handler checks `isAllowedDocuSealUrl(signedDocUrl)` (SSRF guard restricting the fetch to the configured DocuSeal host) — confirmed present and called before the `fetch()` on the attacker-influenced `documents[0].url` field from the webhook payload. Good — this is exactly the SSRF-via-webhook-payload vector I was checking for, and it's closed.
- No path-traversal surface in this handler — the only filesystem/storage write is `storage.storageKey(contract.organizationId, contract.id, ...)` (`:218-222`), which uses the same sanitized-key builder audited in 3.1, and `contract.id`/`contract.organizationId` come from the DB row resolved via `docusealSubmissionId` lookup, not from the webhook payload's free-text fields.

**Task 3.2 verdict: PASS** (no new findings beyond what 2.3 already covered).

### 3.3 Endpoints accepting URLs or paths — SSRF / path traversal (beyond outbound-webhook, already covered in 2.5.2)

- **Import ZIP/CSV/manifest fetches** (`lib/import/handlers/{csv,batch,pandadoc,clm-export}.ts`) — all call `fetch(url)` where `url` is always the result of `storage.getSignedDownloadUrl(job.storageKey)` or, in the manifest path, `storage.getSignedDownloadUrl(entry.key)` where `entry.key` comes from a **server-generated** `manifest.json` written by `app/api/import/batch/route.ts:122-135` (each `key` is built as `imports/${ctx.organizationId}/${jobId}/files/${i}_${sanitized}` server-side, never taken from client-supplied JSON) — confirmed this is not a client-controlled-URL SSRF or IDOR vector; the manifest content itself is fully server-authored.
- **Google Drive import** (`lib/import/gdrive-client.ts`) — all `fetch()` calls target Google's own fixed API hosts (`TOKEN_URL`, Drive API base) with an OAuth bearer token; no user-supplied URL is ever fetched.
- **CRM providers** (`lib/crm/{hubspot,pipedrive,salesforce}.ts`) — all `fetch()` calls target hardcoded vendor API base URLs (`API_BASE` constants); the only variable part of the URL is a `dealId`/`stageId` path segment sourced from either the OAuth-authenticated CRM API's own responses or a webhook payload already HMAC-verified (3.2) — no open SSRF surface.
- **DocuSeal signed-document fetch** — covered in 3.2, has an explicit allow-list guard (`isAllowedDocuSealUrl`).
- **Outbound webhooks** (org-configured Slack/Teams/webhook URLs) — already covered as Finding 2.5.2 (registration-time-only SSRF validation, TOCTOU gap via DNS rebinding). Cross-referencing here since it's the one real URL/SSRF gap in this category.
- **Path traversal via route params** (`contractId`, `snapshotId`, `fileId`, `jobId`, etc.) — every one of these is used exclusively as a Prisma `where: { id: ... }` lookup key, never as a filesystem or storage path component directly (storage keys are always rebuilt server-side via `storage.storageKey()`/the sanitized-filename builders in 3.1), so a `../`-laden route param simply fails to match any DB row and 404s rather than escaping any directory. No traversal vector found here.

**Task 3.3 verdict: PASS**, except for the two items cross-referenced above (Finding 2.5.2 — SSRF TOCTOU on outbound webhooks; and Finding 3.1 — the storage-key IDOR, which is adjacent to but distinct from classic path traversal, since it doesn't escape a path prefix, it just isn't checked against one at all).

### MCP endpoint (`/api/mcp`) input handling

All 11 tool handlers validate `arguments` through a dedicated Zod schema before use (`app/api/mcp/route.ts:277-370`) and every write-capable tool re-checks `ctx.scopes?.includes("write")` (`:1263,1277,1282`) in addition to the schema validation — consistent with the read/write API-key scope model audited in Task 2. Every tool that operates on a specific resource (`get_contract`, `ask_contract`, `list_obligations`, `create_obligation`, `update_obligation`, `list_crm_links`, `get_import_job`) re-verifies the resource's `organizationId` against `ctx.organizationId` before returning or mutating data (cited with line numbers in Task 1.3). No additional MCP-specific input-handling gaps found beyond the general org-scope and auth patterns already audited.

### Task 3 overall verdict

**FAIL** — Finding 3.1 (P0) is a live, directly exploitable, cross-tenant object-storage read via `/api/org/logo` and `/api/user/avatar`, requiring only any valid authenticated session/API key (any org, any role) plus knowledge of a target storage key. This must block ship. Finding 3.2 (P1, zip-bomb) is a real availability risk on shared worker infrastructure and should be fixed before the next milestone that touches import volume. Everything else audited under Task 3 (magic-byte validation, upload size caps, filename sanitization, webhook signature/replay protection, SSRF guards on DocuSeal and CRM fetches, MCP input validation) passed cleanly.

---

## Failure Mode Matrix

| # | Category | Tested | Evidence |
|---|---|---|---|
| 1 | Empty input | yes | Zod schemas reject empty/missing bodies across every POST/PATCH route sampled (e.g. `CreateSnapshotSchema`, `AskSchema`, `CreateWebhookSchema`); empty `q`/`query` search params short-circuit to empty results (`search/route.ts:28-30`) rather than erroring. |
| 2 | Huge input | yes | 50MB contract-file cap enforced both client-declared and buffer-actual (`upload/route.ts:93`, `batch.ts:67`); 500MB ZIP cap at 3 import routes; but see **Finding 3.2** — decompressed-size is NOT capped before `unzipSync` runs, a real gap. `question`/`contentText` fields capped via Zod `.max()` (e.g. `ask/route.ts:20`, `snippets/route.ts:14`). |
| 3 | Special chars / injection | yes | No `queryRawUnsafe`/string-concatenated SQL anywhere (grep-verified); all raw SQL uses parameterized `Prisma.sql`. Filenames sanitized to `[a-zA-Z0-9._-]` before touching storage keys (multiple sites, 3.1). Did not independently fuzz Unicode/RTL/NULL-byte filenames through the sanitizer regex, but the regex is a strict allow-list (`replace(/[^a-zA-Z0-9._-]/g, "_")`), which by construction cannot pass through NULL bytes, RTL overrides, or SQL metacharacters — any character outside the allow-list becomes `_`. |
| 4 | Concurrency / races | partial | Reviewed the atomic-guard patterns the code itself calls out: obligation reminder dedup via `updateMany({ where: { reminderSentAt: null } })` returning `count===0` as the skip signal (`worker.ts:911-918`), CRM sync's `update({ where: { id, status: "AWAITING_SIGNATURE" } })` guard preventing concurrent double-activation (`crm/[provider]/webhook/route.ts:106-109`), file-upload's `$transaction` around the `isLatest` flip (`upload/route.ts:118-155`). Did not independently load-test with parallel requests (no test environment was stood up for this audit — read-only source review only, per task constraints); this is a code-review-level "the pattern is correct" finding, not an empirically verified one. |
| 5 | Auth / authz | yes | Full Task 2 (resolveAuth both paths, API-key hashing, 404-not-403, unauthenticated-route audit) plus Finding 3.1 (P0 storage IDOR) and Finding 2.5.1 (P2 owner-demotion gap). |
| 6 | Numeric extremes | partial | Zod `.min()/.max()`/`.positive()` constraints found on money/date/limit fields (e.g. `CreateContractSchema.value: z.number().positive()`, MCP schemas' `limit: z.number().int().min(1).max(...)`) — did not fuzz `NaN`/`Infinity`/negative-zero against every numeric field in every route; spot-checked the MCP and contract-creation schemas only. |
| 7 | State / lifecycle | yes | Approval workflow: self-approval blocked (`approvals/route.ts:97-99`), duplicate-active-approval blocked (`:101-114`), contract-state gate on approval requests (`APPROVAL_REQUESTABLE` set, `:80-86`), CRM sync only activates from `AWAITING_SIGNATURE` (`crm webhook :106-109`). Last-admin demotion blocked; **last-owner demotion is NOT blocked (Finding 2.5.1, P2)**. |
| 8 | Network / external | yes | DocuSeal/CRM webhook delivery failures return 200 to stop retry storms (documented in code comments); AI provider fetch failures degrade gracefully (503, not 500) across `ask/route.ts`, `semantic/route.ts`; outbound webhook SSRF validated at registration but not re-validated at delivery (Finding 2.5.2). |
| 9 | Dirty / pre-existing data | partial | Import handlers treat rows/files independently with per-row failure tracking rather than aborting the whole job (`batch.ts` processFiles, `pandadoc.ts`) — a bad row doesn't corrupt the rest of the job. Did not test against an actually-dirty pre-existing DB (no test DB stood up for this audit; read-only source review only). |
| 10 | Time / TZ | partial | `analytics/summary/route.ts` and `worker.ts`'s obligation-overdue sweep both use `Date.UTC(...)`/UTC-anchored month boundaries consistently (`startOfMonthUTC`, `Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-11, 1)`) — no naive local-time month math found. Did not test an actual DST-cutover or leap-day date against a running instance (source review only, no test environment stood up). |

## Overall verdict

**FAIL.** Finding 3.1 (P0, cross-tenant storage-key IDOR in `/api/org/logo` and `/api/user/avatar`) is a live, directly exploitable vulnerability that must be fixed before ship — it bypasses every org-isolation control audited in Task 1 by operating at the storage layer instead of the database layer. Task 1 (org isolation via Prisma) and Task 2 (auth surface) both come back PASS/PARTIAL-PASS with real but non-exploitable-today findings (1.1, 2.5.1, 2.5.2) that should be scheduled as follow-up work. Task 3 additionally surfaces a P1 zip-bomb/DoS risk (3.2) in the shared worker process.

### Summary of all findings by severity

- **P0:** Finding 3.1 — storage-key IDOR in `/api/org/logo` and `/api/user/avatar` GET routes (cross-tenant file read).
- **P1:** Finding 1.1 — 4 models with direct `organizationId` excluded from auto-scoping middleware (fragile-by-convention, not yet exploited). Finding 3.2 — zip-bomb/unbounded-decompression risk in 3 import handlers, shared-worker DoS blast radius.
- **P2:** Finding 2.5.1 — any admin can demote the sole org owner via `PATCH /api/org/members/[id]`. Finding 2.5.2 — outbound webhook SSRF guard is registration-time only (DNS-rebinding TOCTOU).

This was a source-code-only, read-only review (per task constraints — no docker/dev-server/test-suite execution). None of the above was verified by actually sending a live HTTP request against a running instance; all findings are derived from static code-path tracing. Recommend the P0 be independently confirmed live (e.g. `curl` against a running dev instance with two seeded orgs) before the fix is scoped, and that it block merge/ship regardless.

