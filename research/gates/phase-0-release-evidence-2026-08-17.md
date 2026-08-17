# Phase 0 engineering release evidence

Date: 2026-08-17
Scope: Aakd OSS core, contract-first activation, Agent Gateway/MCP controls

This record covers engineering readiness only. Product evidence remains open in the Phase 0 scorecard until real organizations, paid pilots, and repeat usage are observed.

The evidence contract and current empty state are recorded in
`research/gates/phase-0-customer-evidence-ledger.md`; no external customer
evidence is being claimed by this release record.

**Current release pointer:** current-head runtime evidence is verified through
`c904771` (clean-volume Compose health, stable worker and 18-test browser
replay). The HTTP MCP replay remains verified through `d2fccc9`; the latest
source verifier run covers the current application and documentation boundary.
Historical rows below retain the
commit at which each check was run; they are not claims that a later
documentation-only commit reran the application.

## Verification record

| Gate | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `pnpm typecheck` completed with 0 errors |
| Lint | PASS | `pnpm --filter web lint` completed; only pre-existing image and hook warnings remain |
| Production build | PASS | `pnpm build` completed successfully at the verified engineering boundary; see the current release pointer above |
| Unit/integration tests | PASS | 55 committed test files, 1,080 tests passed at the current source boundary, including the versioned Phase 0 synthetic-corpus, public-capability-truth, module-classification, activation-event, and security-checklist regressions plus MCP detail redaction, request attribution, explicit text-read authorization, minimized obligation/import projections, individual AI review, manual-versus-AI extraction provenance, duplicate-action guards, and the no-provider cited extraction fallback |
| Organization isolation | PASS | `pnpm --filter web test:isolation`: 11 tests passed |
| End-to-end suite | PASS | `CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3003 pnpm --filter web exec playwright test --retries=0`: 18 tests passed against a real local PostgreSQL 14 database and MinIO object store |
| Contract creation regression | PASS | New-account upload-first flow reaches a contract detail page and a real generated PDF produces five reviewable fields with exact source text and `Source page 1` citations without an external AI provider |
| MCP security regressions | PASS | 45 MCP tests passed, including the standard initialize/initialized/tools-list/ping handshake; viewer writes and API-key text reads without `text_read` are rejected, and contract/obligation/import responses omit raw extraction values, source excerpts, raw extracted text, storage keys and tenant identifiers |
| MCP HTTP compatibility replay | PASS | `MCP_API_KEY=... MCP_URL=http://localhost:3000/api/mcp bash scripts/verify-mcp-http.sh` passed against the disposable deployment: initialize, `notifications/initialized` (202), `tools/list` (13 tools), ping, `list_contracts`, and read/write scope guards |
| Agent/API attribution | PASS | Activity records preserve the acting user plus request source and request ID for session and API-key/MCP mutations; focused attribution tests pass |
| AI review safety | PASS | Bulk acceptance endpoint and UI removed; individual accept/reject/edit actions remain reviewable |
| Authenticated workflow usability | PASS | Cookie consent no longer blocks authenticated routes; onboarding tour is hidden synchronously on the dedicated onboarding page |
| Activation instrumentation | PASS | `workspace_created`, `file_uploaded`, `contract_fact_reviewed`, `obligation_created`/`obligation_completed`, consented return pageviews, and `/api/health` cover the required milestones; the event contract explicitly excludes contract/org IDs, extracted values, source text, file names, credentials and file size |
| Capability truth boundary | PASS | `research/gates/phase-0-capability-matrix.md` defines available, paused, and absent surfaces for the release |
| Synthetic/adversarial corpus | PASS | Versioned eight-document fixture covers amendments/conflicts, duplicate import, precedence ambiguity, missing evidence, departed owner, timezone-sensitive notice, failed delivery, and low-confidence critical clauses; its expected outcomes are validated by `phase-0-synthetic-corpus.test.ts` |
| Agent security matrix | PASS | `research/gates/phase-0-agent-security-matrix.md` indexes the authenticated, scoped, minimized-read, and approval-boundary cases covered by tests |
| Security release checklist | PASS | `research/gates/phase-0-security-release-checklist.md` records the Phase 0 checks, evidence references, non-claims, and release recheck triggers |
| API route authorization inventory | PASS | All 102 API route files were audited. The only five without `resolveAuth` are deliberate auth, health, unsubscribe, CRM webhook, and DocuSeal webhook endpoints with rate-limit, signed-token, provider-signature, HMAC, scope, and state/host guards documented in the Agent Security Matrix |
| Compose syntax and required interpolation | PASS | `scripts/validate-self-hosting.sh` validates development and production Compose files with generated placeholder secrets; shell syntax checks pass for deploy/update/doctor/backup/restore/validator scripts |
| Reproducible Phase 0 verifier | PASS | `scripts/verify-phase-0.sh` completed successfully on the current source: Compose validation, typecheck, lint, 55-file/1,080-test suite, dedicated tenant-isolation suite, and production build |
| Local integrated runtime | PASS | The application served the full no-retry E2E suite with PostgreSQL and MinIO running as separate local services; this verifies authenticated upload/onboarding behavior with real database and object-storage boundaries |
| Clean Compose install | PASS | A disposable project with empty PostgreSQL, MinIO and DocuSeal volumes built both application images, applied all 29 migrations, started app/worker/Redis/DB/object storage, and returned `200` from `/api/health` with DB and Redis checks green |
| Containerized end-to-end suite | PASS | `PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter web exec playwright test --retries=0` against the disposable Compose app: 18 tests passed |
| Exact `origin/main` replay | PASS (historical) | An archive of commit `bbbde93` was built without the dirty worktree, booted from empty named volumes, returned healthy DB/Redis checks, and passed the same 18-test browser suite. Current head is covered by the separate `9708b6d` replay below. |
| Clean Compose replay at `e693e2f` | PASS (health) | A clean archive of commit `e693e2f` was built without the dirty worktree, booted with empty database/object-storage volumes, applied the migrations, started app/worker/Redis/DB/object storage, and returned HTTP 200 from `/api/health` with DB and Redis green. The subsequent search/localization commits were verified by build and tests; this disposable replay was not rerun for those commits. |
| Current-head Compose replay at `d2fccc9` | PASS | An isolated project from empty volumes built both current app/worker images, applied migrations, started DB/Redis/MinIO/DocuSeal/app/worker, kept the worker running, and returned `200` from `/api/health` with DB and Redis green on Docker Engine 29.5.2. |
| Current-head Compose replay at `c904771` | PASS | An isolated project from empty volumes built the pushed app/worker images, applied migrations, started DB/Redis/MinIO/DocuSeal/app/worker, kept the worker running, returned `200` from `/api/health` with DB and Redis green, and passed the 18-test browser suite. |
| Real Codex CLI MCP client replay | PASS | On 2026-08-17, the bundled Codex CLI v0.148.0-alpha.9 used a native temporary MCP registration against the current disposable Compose app, authenticated with a read+`text_read` API key, discovered all 13 Aakd tools, and successfully invoked `list_contracts`, returning an empty tenant-scoped result (`total: 0`, `page: 1`, `limit: 20`). No data was modified. The normal Codex profile was untouched; the stack and volumes were removed afterward. |
| Fresh VM/container boot | PASS (container) | Current-head Docker Compose boot was verified from empty named volumes on 2026-08-17. A separate cloud VM has not been used; VM-specific diversity remains a deployment follow-up. |

## Known non-blocking warnings

- Next/Sentry deprecation warnings are emitted during lint/build.
- Existing tests intentionally log simulated Redis, storage, CRM, webhook, and provider failures while asserting graceful handling.
- A clean cloud VM install and real customer evidence are still required before claiming operational or product-market readiness.
- The disposable Compose run initially exposed two startup defects: the development Redis URL did not follow its configured password, and the minimal app image omitted Prisma's `@next/env` loader. Both are fixed and the exact `origin/main` replay passed.
- GitHub Actions runs for commits `e33a3b3` and earlier terminated before any step started because no hosted runner was assigned (`runner_id: 0`). Local verification is therefore the authoritative current evidence until repository Actions capacity is restored.
- The integrated E2E run used local PostgreSQL and MinIO services rather than Docker; the subsequent disposable Compose run closed the container portion of the clean-install gate. A separate cloud VM and the external customer-evidence gates remain open.
- The current worktree contains additional unrelated dashboard, operations, settings, and responsive UI changes. They remain intentionally excluded from this release evidence until separately committed and replayed.

## Release interpretation

The Phase 0 engineering checks are PASS at current-head runtime boundary `c904771` and the latest source verifier boundary: the disposable clean-volume stack is healthy, the worker remains stable, the 18-test browser suite reaches the contract-first path without an AI key, and a real Codex CLI client completed MCP discovery plus a read-only contract listing. The Agent Gateway hardening is covered by clean typecheck, 1,080-test suite, focused MCP/security tests, the HTTP MCP compatibility replay at `d2fccc9`, the Codex client replay, and production build verification. Public copy is aligned across all five supported locales with the capability matrix. The evidence-intake and security checklists make the customer and release gates operational without claiming any customer evidence. Customer evidence remains open; do not publish claims of production adoption, formal certifications, hosted availability, or enterprise identity support.
