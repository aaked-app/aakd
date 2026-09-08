# Current-head Phase 0/1 release acceptance matrix — 2026-09-08

**Candidate:** `4aed272` (PR #38, `feat: instrument activation review timing`)

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
| Functional browser E2E | `PASS_REMOTE` | Public CI run `34192696894`, job `101953833055`: the full functional browser suite passed after rerun against isolated dependencies, including the standards-based MCP client replay. |
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
| Public CI | `PASS_REMOTE` | PR #38 merged as `4aed272`; TypeScript, Lint, Prisma migrations, Production container images, Self-hosting configuration, Functional browser E2E, Unit & Integration Tests, and Build all passed after the failed jobs were rerun. |
| Activation instrumentation | `PASS_REMOTE` | Public CI run `34192696894`, including the rerun of job `101954012209`, passed the privacy-minimal activation timing integration test; reviewed actions record only action kind and minutes since account creation when operator telemetry is configured. |
| Standards MCP client compatibility | `PASS_REMOTE` | Public CI run `34189837571`, job `101945456045`, exercised a real `@modelcontextprotocol/sdk` Streamable HTTP client: UI-created API key, MCP handshake, `tools/list`, `list_contracts`, and key revocation. |
| HTTP MCP compatibility replay | `PASS_LOCAL` | `scripts/verify-mcp-http.sh` passed against the running candidate with a disposable read-only `cf_live_` key: initialize, initialized notification (202), 15 tools, ping, list_contracts, and text-read/write scope guards; key deleted after replay |

## Phase 0 gates

| Gate | Result | Remaining condition |
| --- | --- | --- |
| Truthful capability surface | `PASS_LOCAL` | Recheck after any release/deployment change |
| Auth, tenant isolation, MCP scope enforcement | `PASS_REMOTE` | HTTP MCP replay and a standards SDK client replay passed with disposable scoped keys; provider-specific Claude/Codex desktop validation remains external. |
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
| Agent boundary | `PASS_REMOTE` | Standards SDK Streamable HTTP replay passed in public CI; real Claude/Codex desktop client replay remains external |
| Corpus quality | `OPEN` | At least 100 documents across three contract types with measured precision/recall |
| Activation time | `OPEN` | Instrumentation is now present; customer sessions are still required to establish the median signup-to-first-confirmed-action. |
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

## 2026-09-08 current-head re-verification addendum

The synchronized internal checkout was re-verified after the activation
instrumentation and acceptance-ledger commits. The exact local commit is
`797168a044f85a12b17cfb2906b6cfbd9d2dca13`; the synchronized public `main`
content is `9969f6979a7b67c3df04123a88047e10bcb6c184` (different ancestry,
identical tracked content at the time of this check).

| Check | Result | Evidence |
| --- | --- | --- |
| Full Phase 0 verification on current checkout | `PASS_LOCAL` | `bash scripts/verify-phase-0.sh` completed successfully on 2026-09-08: 101 test files / 1,545 tests, 11 isolation tests, typecheck, lint, and production build all passed. |
| Working tree and branch synchronization | `PASS_LOCAL` | Clean `internal-main`; `origin/main` points to `797168a`; `public/main` content comparison is clean. |
| Customer, deployment, and economic gates | `OPEN` | This re-verification changes no external state and supplies no customer corpus, live deployment, repeat-use, support, or funding evidence. |

The build emits expected configuration warnings when production secrets and
`BETTER_AUTH_URL` are intentionally absent from the local build environment;
the self-hosting validator and production runtime smoke require those values
at deployment time. These warnings are not evidence of a production failure.
