# Current-head Phase 0/1 release acceptance matrix — 2026-09-08

**Candidate:** `7683449` (`ci: enforce functional browser e2e`)

**Decision:** `ENGINEERING_READY_LOCAL / PRODUCT_GATES_OPEN`

This record distinguishes executable local evidence from gates that require a
clean deployment, real external providers, or customer evidence. It does not
claim that the Phase 0 or Phase 1 product gates have passed.

## Engineering evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Unit and integration suite | `PASS_LOCAL` | 101 files, 1,544 tests passed |
| TypeScript | `PASS_LOCAL` | `pnpm --filter web typecheck` |
| Lint | `PASS_LOCAL` | Zero errors; existing warnings remain |
| Production build | `PASS_LOCAL` | `pnpm build` completed successfully |
| Functional browser E2E | `PASS_REMOTE` | Public CI run `34188515440`, job `101941600473`: all 20 Playwright tests passed against fresh PostgreSQL, Redis, MinIO, and Mailpit with the app and worker running from source. |
| Visual/localization matrix | `PASS_LOCAL` | Full 234-test matrix: 224 passed, 10 intentional skips, zero failures with per-project auth-state isolation. |
| Tenant isolation | `PASS_LOCAL` | 11/11 isolation tests passed |
| Targeted security/integration matrix | `PASS_LOCAL` | 260/260 passed |
| Runtime health | `PASS_LOCAL` | PostgreSQL and Redis returned `ok` from `/api/health`; migrations 38/38 are applied |
| Self-hosting configuration | `PASS_LOCAL` | `scripts/validate-self-hosting.sh` and development/production Compose config validation passed; fresh-volume production replay is covered by the remote runtime smoke below |
| Production image build | `PASS_REMOTE` | Public CI job `Production container images` built both web and worker images successfully in 13m17s on a clean GitHub runner; PR #29 merged as `47c2ba7`. Local replay reached the worker's 282-package LibreOffice installation with cached dependencies, but local Alpine throughput remains too slow to complete within this run. |
| Fresh production runtime smoke | `PASS_REMOTE` | Public CI run `34185424014`, job `101932691539`, built both images, booted fresh PostgreSQL/Redis/MinIO volumes, applied migrations, returned `/api/health` successfully, observed the BullMQ worker startup log, created and validated a compressed PostgreSQL backup, restored it into an isolated database, and verified the restored Prisma schema. |
| Pinned Caddy configuration | `PASS_REMOTE` | Public CI run `34186052985`, job `101934478886`, and local replay validated `Caddyfile` with the exact production Caddy image and `DOMAIN=example.com`; real DNS and certificate issuance remain environment-specific. |
| Live `aakd.app` deployment probe | `BLOCKED_EXTERNAL` | Read-only probe on 2026-09-08 found `aakd.app` resolving to Namecheap parking (`198.54.117.242`); HTTPS failed and HTTP returned the Namecheap parking page, so the hosted app cannot currently be used as deployment evidence. |
| PDF page citations | `PASS_LOCAL` | Single-page fallback preserves a page boundary and reports page 1 |
| Worker extraction | `PASS_LOCAL` | Worker restarted with the candidate code and contract creation/operations E2E passed |
| Working tree | `PASS_LOCAL` | Clean `main`; candidate committed locally |
| Full Phase 0 verification runner | `PASS_LOCAL` | `bash scripts/verify-phase-0.sh` completed successfully, including self-hosting validation, typecheck, lint, full tests, isolation tests, and production build |
| Public CI | `PASS_REMOTE` | PR #29 merged as `47c2ba7`; Build, Lint, Prisma migrations, Production container images, Self-hosting configuration, TypeScript, and Unit & Integration Tests all passed |
| HTTP MCP compatibility replay | `PASS_LOCAL` | `scripts/verify-mcp-http.sh` passed against the running candidate with a disposable read-only `cf_live_` key: initialize, initialized notification (202), 15 tools, ping, list_contracts, and text-read/write scope guards; key deleted after replay |

## Phase 0 gates

| Gate | Result | Remaining condition |
| --- | --- | --- |
| Truthful capability surface | `PASS_LOCAL` | Recheck after any release/deployment change |
| Auth, tenant isolation, MCP scope enforcement | `PASS_LOCAL` | HTTP MCP compatibility replay passed with a disposable scoped key; external Claude/Codex client compatibility remains validation work |
| Cited first useful action | `PASS_REMOTE` | Public functional browser E2E exercised first-use registration, organization creation, contract creation, upload, operations, AI configuration, and responsive onboarding. |
| Clean install and Compose replay | `PASS_REMOTE_PARTIAL` | Fresh production PostgreSQL/Redis/MinIO/app/worker plus backup/restore replay passed in public CI run `34185424014`; Caddy syntax is validated in run `34186052985`, while real DNS/certificate issuance and authenticated browser replay remain open |
| Repeated target failure | `OPEN` | Evidence from at least five organizations |
| Representative corpora | `OPEN` | Three organizations and the agreed document corpus |
| Funded pilots | `OPEN` | Two economic owners fund the same pilot |
| Support burden | `OPEN` | Delivery/support ledger after real usage |

## Phase 1 gates

| Gate | Result | Remaining condition |
| --- | --- | --- |
| Unified action model | `PASS_LOCAL` | None in the current implementation |
| Source traceability and human review | `PASS_LOCAL` | Real-corpus accuracy still open |
| Completion evidence and stale safety | `PASS_LOCAL` | Evidence verification/rejection is append-only; assignee self-attestation is server-authorized and cannot overwrite an existing review |
| First useful action | `PASS_LOCAL` | Clean-install replay still required |
| One cited work-tool output | `PASS_LOCAL` | Real provider delivery remains external; Mailpit path is verified |
| Team Brief and exception handoff | `PASS_LOCAL` | Named-recipient, reviewed-action snapshots, acknowledgement and exception filtering are implemented and integration-tested |
| Agent boundary | `PASS_LOCAL` | HTTP compatibility replay passed; real Claude/Codex client replay remains external |
| Corpus quality | `OPEN` | At least 100 documents across three contract types with measured precision/recall |
| Activation time | `OPEN` | Instrumented customer sessions |
| Silent critical errors | `OPEN` | Real-corpus review ledger |
| Repeat use | `OPEN` | Two organizations complete a second comparable cycle |
| Managed-operation funding | `OPEN` | Two qualified organizations fund the same offer |

## Release blockers and next actions

1. Restore an authorized live deployment for the canonical domain, then verify
   real DNS/certificate issuance and authenticated browser journeys; core
   production runtime, backup/restore, and Caddy syntax smoke now pass in
   public CI.
2. Run isolated real-provider tests only after credentials and sandbox accounts
   are available. Until then, label those surfaces `BLOCKED_EXTERNAL` rather
   than treating mocks as live proof.
3. Collect the Phase 0/1 customer corpus, repeat-use, support and economic
   evidence through authorized customer work. Synthetic fixtures do not close
   those gates.
4. After those gates pass, run independent QA/security review on the exact
   release commit, then push and deploy.
