# Phase 0 engineering release evidence

Date: 2026-08-17
Scope: Aakd OSS core, contract-first activation, Agent Gateway/MCP controls

This record covers engineering readiness only. Product evidence remains open in the Phase 0 scorecard until real organizations, paid pilots, and repeat usage are observed.

The evidence contract and current empty state are recorded in
`research/gates/phase-0-customer-evidence-ledger.md`; no external customer
evidence is being claimed by this release record.

## Verification record

| Gate | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `pnpm typecheck` completed with 0 errors |
| Lint | PASS | `pnpm --filter web lint` completed; only pre-existing image and hook warnings remain |
| Production build | PASS | `pnpm build` completed successfully |
| Unit/integration tests | PASS | 53 test files, 1,090 tests passed on commit `9889af2`, including MCP detail redaction, request attribution, responsive search behavior, individual AI review, and duplicate-action guards |
| Organization isolation | PASS | `pnpm --filter web test:isolation`: 11 tests passed |
| End-to-end suite | PASS | `CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3003 pnpm --filter web exec playwright test --retries=0`: 18 tests passed against a real local PostgreSQL 14 database and MinIO object store |
| Contract creation regression | PASS | New-account upload-first flow reaches a contract detail page |
| MCP security regressions | PASS | 42 MCP tests passed, including the standard initialize/initialized/tools-list/ping handshake; viewer writes are rejected and contract list/detail responses omit raw extraction values, source excerpts, raw extracted text, and tenant identifiers |
| Agent/API attribution | PASS | Activity records preserve the acting user plus request source and request ID for session and API-key/MCP mutations; focused attribution tests pass |
| AI review safety | PASS | Bulk acceptance endpoint and UI removed; individual accept/reject/edit actions remain reviewable |
| Authenticated workflow usability | PASS | Cookie consent no longer blocks authenticated routes; onboarding tour is hidden synchronously on the dedicated onboarding page |
| Activation instrumentation | PASS | Server-side events cover contract creation, file upload, individual fact review, and obligation create/complete; telemetry excludes contract, organization, extracted-value, and file-size identifiers |
| Capability truth boundary | PASS | `research/gates/phase-0-capability-matrix.md` defines available, paused, and absent surfaces for the release |
| Agent security matrix | PASS | `research/gates/phase-0-agent-security-matrix.md` indexes the authenticated, scoped, minimized-read, and approval-boundary cases covered by tests |
| API route authorization inventory | PASS | All 102 API route files were audited. The only five without `resolveAuth` are deliberate auth, health, unsubscribe, CRM webhook, and DocuSeal webhook endpoints with rate-limit, signed-token, provider-signature, HMAC, scope, and state/host guards documented in the Agent Security Matrix |
| Compose syntax and required interpolation | PASS | `scripts/validate-self-hosting.sh` validates development and production Compose files with generated placeholder secrets; shell syntax checks pass for deploy/update/doctor/backup/restore/validator scripts |
| Local integrated runtime | PASS | The application served the full no-retry E2E suite with PostgreSQL and MinIO running as separate local services; this verifies authenticated upload/onboarding behavior with real database and object-storage boundaries |
| Clean Compose install | PASS | A disposable project with empty PostgreSQL, MinIO and DocuSeal volumes built both application images, applied all 29 migrations, started app/worker/Redis/DB/object storage, and returned `200` from `/api/health` with DB and Redis checks green |
| Containerized end-to-end suite | PASS | `PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter web exec playwright test --retries=0` against the disposable Compose app: 18 tests passed |
| Exact `origin/main` replay | PASS (historical) | An archive of commit `bbbde93` was built without the dirty worktree, booted from empty named volumes, returned healthy DB/Redis checks, and passed the same 18-test browser suite. The latest main commit is recorded separately below because it has not had a disposable Compose replay. |
| Clean Compose replay at `e693e2f` | PASS (health) | A clean archive of commit `e693e2f` was built without the dirty worktree, booted with empty database/object-storage volumes, applied the migrations, started app/worker/Redis/DB/object storage, and returned HTTP 200 from `/api/health` with DB and Redis green. The subsequent search/localization commits were verified by build and tests; this disposable replay was not rerun for those commits. |
| Fresh VM/container boot | PASS (container) | Docker Compose boot was verified from empty named volumes on 2026-08-17. A separate cloud VM has not been used; the VM-specific path remains a deployment follow-up |

## Known non-blocking warnings

- Next/Sentry deprecation warnings are emitted during lint/build.
- Existing tests intentionally log simulated Redis, storage, CRM, webhook, and provider failures while asserting graceful handling.
- A clean cloud VM install and real customer evidence are still required before claiming operational or product-market readiness.
- The disposable Compose run initially exposed two startup defects: the development Redis URL did not follow its configured password, and the minimal app image omitted Prisma's `@next/env` loader. Both are fixed and the exact `origin/main` replay passed.
- GitHub Actions runs for commits `e33a3b3` and earlier terminated before any step started because no hosted runner was assigned (`runner_id: 0`). Local verification is therefore the authoritative current evidence until repository Actions capacity is restored.
- The integrated E2E run used local PostgreSQL and MinIO services rather than Docker; the subsequent disposable Compose run closed the container portion of the clean-install gate. A separate cloud VM and the external customer-evidence gates remain open.
- The current worktree contains additional uncommitted dashboard, operations, and responsive UI tests and changes. The committed verification at `9889af2` reached 53 test files and 1,090 tests; the latest dashboard/operations changes remain intentionally excluded from release evidence until committed and replayed.

## Release interpretation

The engineering release gates are green, including a clean disposable Compose boot and containerized E2E run. Phase 0 is not a customer-validation pass: do not publish claims of production adoption, formal certifications, hosted availability, or enterprise identity support.
