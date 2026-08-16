# Phase 0 engineering release evidence

Date: 2026-08-17
Scope: Aakd OSS core, contract-first activation, Agent Gateway/MCP controls

This record covers engineering readiness only. Product evidence remains open in the Phase 0 scorecard until real organizations, paid pilots, and repeat usage are observed.

## Verification record

| Gate | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `pnpm typecheck` completed with 0 errors |
| Lint | PASS | `pnpm --filter web lint` completed; only pre-existing image and hook warnings remain |
| Production build | PASS | `pnpm build` completed successfully |
| Unit/integration tests | PASS | 49 files, 1,051 tests passed, including the localized landing-page truth and CTA contract |
| Organization isolation | PASS | `pnpm --filter web test:isolation`: 11 tests passed |
| End-to-end suite | PASS | `CI=1 pnpm --filter web test:e2e`: 18 tests passed |
| Contract creation regression | PASS | New-account upload-first flow reaches a contract detail page |
| MCP security regressions | PASS | 41 MCP tests passed, including the standard initialize/initialized/tools-list/ping handshake; viewer writes are rejected and contract list/detail responses omit raw extracted text and tenant identifiers |
| AI review safety | PASS | Bulk acceptance endpoint and UI removed; individual accept/reject/edit actions remain reviewable |
| Authenticated workflow usability | PASS | Cookie consent no longer blocks authenticated routes; onboarding tour is hidden synchronously on the dedicated onboarding page |
| Activation instrumentation | PASS | Server-side events cover contract creation, file upload, individual fact review, and obligation create/complete; telemetry excludes contract, organization, extracted-value, and file-size identifiers |
| Capability truth boundary | PASS | `research/gates/phase-0-capability-matrix.md` defines available, paused, and absent surfaces for the release |
| Agent security matrix | PASS | `research/gates/phase-0-agent-security-matrix.md` indexes the authenticated, scoped, minimized-read, and approval-boundary cases covered by tests |
| Compose syntax and required interpolation | PASS | `scripts/validate-self-hosting.sh` validates development and production Compose files with generated placeholder secrets; shell syntax checks pass for deploy/update/doctor/backup/restore/validator scripts |
| Fresh VM/container boot | HOLD | Docker daemon was unavailable in this workstation session, so a clean runtime boot was not claimed |

## Known non-blocking warnings

- Next/Sentry deprecation warnings are emitted during lint/build.
- Existing tests intentionally log simulated Redis, storage, CRM, webhook, and provider failures while asserting graceful handling.
- A clean cloud VM install and real customer evidence are still required before claiming operational or product-market readiness.
- The local Docker daemon was unavailable during this run; the Compose files were validated syntactically with all required variables supplied.
- GitHub Actions runs for commits `e33a3b3` and earlier terminated before any step started because no hosted runner was assigned (`runner_id: 0`). Local verification is therefore the authoritative current evidence until repository Actions capacity is restored.

## Release interpretation

The tested local/CI engineering gates are green, with fresh container boot still held for a machine with a running Docker daemon. Phase 0 is not a customer-validation pass: do not publish claims of production adoption, formal certifications, hosted availability, or enterprise identity support.
