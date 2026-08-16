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
| Unit/integration tests | PASS | 48 files, 1,046 tests passed |
| Organization isolation | PASS | `pnpm --filter web test:isolation`: 11 tests passed |
| End-to-end suite | PASS | `CI=1 pnpm --filter web test:e2e`: 18 tests passed |
| Contract creation regression | PASS | New-account upload-first flow reaches a contract detail page |
| MCP security regressions | PASS | 40 MCP tests passed; viewer writes rejected and contract list/detail responses omit raw extracted text and tenant identifiers |
| AI review safety | PASS | Bulk acceptance endpoint and UI removed; individual accept/reject/edit actions remain reviewable |
| Authenticated workflow usability | PASS | Cookie consent no longer blocks authenticated routes; onboarding tour is hidden synchronously on the dedicated onboarding page |

## Known non-blocking warnings

- Next/Sentry deprecation warnings are emitted during lint/build.
- Existing tests intentionally log simulated Redis, storage, CRM, webhook, and provider failures while asserting graceful handling.
- A clean cloud VM install and real customer evidence are still required before claiming operational or product-market readiness.

## Release interpretation

The engineering gates are currently green for the tested local/CI environment. Phase 0 is not a customer-validation pass: do not publish claims of production adoption, formal certifications, hosted availability, or enterprise identity support.
