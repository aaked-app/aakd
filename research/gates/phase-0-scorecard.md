# Phase 0 scorecard: truth, safety, activation and evidence

Status: open
Version: 1
Phase: PRODUCT.md Phase 0
Accountable owner: Aakd engineering/product owner
Review authority: Founder/CEO
Evidence collection start: 2026-08-17

This scorecard separates engineering release readiness from product evidence. A passing build and test suite cannot substitute for customer evidence, and customer evidence cannot waive a release blocker.

## Gate A: engineering release readiness

| Measure | PASS threshold | Evidence source | PASS action | FAIL action |
|---|---:|---|---|---|
| TypeScript typecheck | 0 errors | `pnpm typecheck` | Continue release verification | Fix all errors |
| Production build | 1 successful build | `pnpm build` | Continue release verification | Fix build failure |
| Automated tests | 100% of committed test files and tests pass | Vitest, Playwright, isolation and security reports | Continue release verification | Fix or explicitly remove invalid tests; no ignored failures |
| Release-blocking security findings | 0 open P0/P1 findings | Security and isolation test report | Continue release verification | Block release |
| Protected API authentication | 100% of protected routes have authentication and organization scope | Route inventory plus tests | Continue release verification | Block release |
| MCP mutation authorization | 100% of mutation cases enforce role, scope, attribution and approval policy | MCP security matrix | Continue release verification | Block release |
| Agent read minimization | 0 unauthorized raw-text or cross-tenant disclosures in the adversarial suite | MCP/API adversarial tests | Continue release verification | Block release |
| Clean install | 1 clean environment reaches the app using documented steps and accepts a real PDF/DOCX | Fresh-machine run log | Continue release verification | Fix setup/docs |
| First useful action | 1 real PDF/DOCX reaches a cited, reviewable action without external operator help | E2E run and screen recording/log | Continue release verification | Fix activation flow |
| Public capability truth | 0 unsupported capability, customer, security or deployment claims in supported locales | Copy audit | Continue release verification | Correct claims before release |

Engineering release decision: PASS only when every row above passes. Any failed row keeps Phase 0 engineering status OPEN.

## Gate B: product evidence readiness

| Measure | PASS threshold | Evidence source | PASS action | FAIL action |
|---|---:|---|---|---|
| Organizations reporting the same recent target failure | >=5 organizations | Interview/observation ledger | Keep the workflow hypothesis | Revisit target workflow |
| Representative corpora | >=3 organizations | Redacted corpus receipt and provenance | Run benchmark | Continue evidence collection |
| Economic owners funding the same pilot | >=2 owners | Paid pilot records | Authorize deeper product investment | Reject or revise the wedge |
| Repeat organizational usage | >=2 organizations repeat within 90 days | Product events and customer confirmation | Advance to next roadmap gate | Keep Phase 0 open |
| Support burden | <=2 founder-hours per 25 contracts | Delivery/support ledger | Continue validation | Simplify or reject workflow |

Product evidence decision: PASS only when every row above passes. This gate cannot be satisfied by tests, GitHub stars, feature breadth or inferred willingness to pay.

## Decision history

| Date | Version | Decision | Reason | Authority |
|---|---|---|---|---|
| 2026-08-17 | 1 | OPEN | Initial scorecard created before Phase 0 evidence collection | Founder/CEO |
