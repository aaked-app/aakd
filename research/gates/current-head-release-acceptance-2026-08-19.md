# Current-head release acceptance matrix — 2026-08-19

**Status:** `NOT_READY`
**Scope:** the present dirty working tree; this record does not replace the
immutable historical Phase 0/1 scorecards or claim that their older runtime
evidence applies to these changes.
**Decision owner:** Aakd engineering/product owner

## Evidence boundary

The working tree contains concurrent, uncommitted work. Evidence below is
therefore local current-head verification, not a release commit or deployment
candidate. No commit, push or deployment is authorized from this matrix.

### Current engineering evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Frozen dependency resolution | PASS | Lockfile install verification completed without retained changes. |
| TypeScript | PASS | `pnpm --filter web typecheck` completed with zero errors. |
| Lint | PASS | `pnpm --filter web lint` completed with zero errors (31 existing warnings). |
| Production build | PASS | Next 16.3.1 production build completed after the runtime-mode guard; 79 static pages generated. |
| Full unit/integration suite | PASS | `pnpm --filter web test`: 99 files, 1,509 tests. |
| Large-document cited Q&A fallback | PASS_LOCAL | A 10 MiB no-soft-break contract completed chunking and lexical ranking in 65 ms and retrieved a final-document IP clause. The regression test prevents reintroducing the former quadratic boundary scan. |
| Tenant isolation | PASS | `pnpm --filter web test:isolation`: 11/11. |
| Diff integrity | PASS | `git diff --check` completed cleanly. |
| Additive suggestion migration on clean local stack | PASS_LOCAL | Native disposable PostgreSQL stack records `20260819010000_fix_obligation_suggestion_identity` as applied; all 4 rows have a non-null `sourceKey` and the new unique index exists. |
| Current-schema migration consistency on representative local clone | PASS_LOCAL | A separately named disposable clone of the local representative database completed `prisma migrate deploy` with all 33 migrations recorded and no pending migration. This confirms current-state consistency only, not a pre-upgrade replay. |
| Runtime health | PASS_LOCAL | The current standalone production build contains the required ESM helper and, with the explicit local runtime-mode override, returned `/api/health` 200 with PostgreSQL and Redis both `ok`; no unsafe-production configuration rejection was emitted. The existing Docker app image predates this correction and has not been rebuilt because Docker's internal storage is constrained. |
| Worker startup | PASS_LOCAL | The rebuilt production worker image started against the Compose PostgreSQL/Redis network with the required encryption key, verified migrations and registered all job schedules; the isolated probe was then removed. |
| Browser upload-to-action replay | PASS_LOCAL | Current-code Playwright replay passed (1/1): account/workspace creation, generated PDF upload through an isolated host-backed MinIO instance, source-backed auto-renewal and 45-day notice review, and local obligation suggestion. The preview route now makes those deterministic source facts override contradictory provider values. |
| Production dependency audit | PASS_LOCAL | `pnpm audit --prod --audit-level=high --json`: zero high, zero critical. A narrow `@prisma/config>deepmerge-ts` override pins 8.0.0; frozen install, Prisma generation, build, isolation and the full 377-file/1,511-test suite pass. |

Prisma 7.9.1 still publishes `deepmerge-ts` 7.1.5. The scoped override is
qualified by current compatibility evidence: Prisma's config layer uses only
the stable `deepmerge` operation, while the 8.x breaking changes do not touch
that call path. Track Prisma upstream and remove this override once Prisma
ships a patched dependency itself.

## Phase 0

| Gate | Required behavior | Test/evidence | Result | Blocking? |
| --- | --- | --- | --- | --- |
| Engineering: typecheck | 0 errors | Current-head typecheck above | PASS | Yes |
| Engineering: production build | Successful production build | Current-head build above | PASS | Yes |
| Engineering: automated suite | All committed tests pass | Current-head suite above | PASS | Yes |
| Engineering: security findings | No release-blocking finding | Production audit: zero high/critical; independent C1-C7 security review approves the narrow Prisma configuration override | PASS_LOCAL | **Yes** |
| Engineering: protected APIs | Authenticated and organization-scoped | Current isolation suite; independent MCP/route review | PASS | Yes |
| Engineering: MCP mutation authorization | Role, scope and attribution enforced | MCP regressions and isolation suite | PASS | Yes |
| Engineering: minimized agent reads | No unauthorized raw-text/cross-tenant disclosure | MCP projection and scope regressions | PASS | Yes |
| Engineering: clean install/Compose | Empty-volume documented replay | The application and worker images built successfully after context/worker-image fixes. The rebuilt worker also passed its startup probe. A later app-image rebuild required for the local runtime-mode correction was terminated by Docker's internal storage pressure; no empty-volume replay was completed. Only unused builder cache and dangling-image checks were performed; no containers, volumes, or project data were removed. | BLOCKED_LOCAL | **Yes** |
| Engineering: existing-database migration | Additive migration and recovery verified on representative existing data | PASS_LOCAL: a clean disposable PostgreSQL database applied 31 historical migrations, received representative legacy Contract and duplicate-title suggestion rows, then applied both current migrations. `renewalReminderEnabled` defaulted true and each legacy suggestion received its distinct deterministic `sourceKey`. A compressed PostgreSQL backup restored into a second disposable database with the contract, both suggestions, and reminder state intact. | PASS_LOCAL | **Yes** |
| Engineering: cited first action | Supported document to cited reviewable action | Current local fallback regression plus current-code browser replay (1/1) | PASS_LOCAL | Yes |
| Engineering: public capability truth | No unsupported claims | PASS_LOCAL: public-truth and five-locale presentation regressions passed 68/68; README, capability matrix, activation contract and security non-claims were all checked. | PASS_LOCAL | **Yes** |
| Product: repeated target failure | At least five organizations | Customer evidence ledger | OPEN | **Yes** |
| Product: representative corpora | Three organizations | Customer evidence ledger | OPEN | **Yes** |
| Product: funded pilots | Two economic owners | Customer evidence ledger | OPEN | **Yes** |
| Product: repeat organizational use | Two organizations within 90 days | Customer evidence ledger | OPEN | **Yes** |
| Product: support burden | At most two founder-hours per 25 contracts | Delivery/support ledger | OPEN | **Yes** |

## Phase 1

| Gate | Required behavior | Test/evidence | Result | Blocking? |
| --- | --- | --- | --- | --- |
| Unified action model | Obligation/renewal projections share one persisted action representation | Schema, projection and action-ledger regressions | PASS_LOCAL | Yes |
| Source traceability | Cited source/page/confidence/review retained | Exact quote verification, control/hallucination rejection properties (300 inputs), document-derived page regressions, and independent QA PASS | PASS_LOCAL | Yes |
| Human control | Auth, org, role and API-key write enforcement | Isolation and adversarial action regressions | PASS | Yes |
| Completion evidence | Actor, time, evidence state and immutable activity | Action-ledger adversarial regression | PASS_LOCAL | Yes |
| Stale safety | Stale source cannot persist or execute actions | Contract-first lock serialization across upload, extract, AI extraction, embeddings, and review decisions; independent QA and security review PASS | PASS_LOCAL | Yes |
| First useful action | Clean account reaches cited assigned action without AI key | Disposable-stack contract-operations E2E | PASS_LOCAL | Yes |
| Citation-preserving output | Configured destination receives cited action | PASS_LOCAL: the worker's Mailpit SMTP route delivered a cited action message with exact quote, page, due date and deep link; route/worker/adversarial delivery lifecycle suite passed 32/32. Real-provider delivery remains EXTERNAL_BLOCKED. | PASS_LOCAL | **Yes** |
| Agent boundary | Minimized read-first data; mutations approval-bound | MCP scope/projection/pagination regressions | PASS | Yes |
| Corpus quality | 100 documents/3 contract types and accuracy threshold | Customer corpus/benchmark evidence | OPEN | **Yes** |
| Activation time | Median under 10 minutes | Product event/session evidence | OPEN | **Yes** |
| Silent critical errors | Zero silently accepted critical errors | Real-corpus/customer-review ledger | OPEN | **Yes** |
| Marginal support | Scorecard support thresholds | Delivery/support ledger | OPEN | **Yes** |
| Repeat use | Two organizations complete a second cycle | Product events/customer confirmation | OPEN | **Yes** |
| Managed-operation funding | Two qualified funded organizations | Payment records/pilot terms | OPEN | **Yes** |

## Required before any publication decision

1. Preserve the narrow Prisma/deepmerge override until Prisma ships a patched
   dependency; on that update, remove the override and rerun audit, frozen
   install, build, full suite, isolation and review.
2. Recover sufficient Docker build storage through a targeted Docker Desktop
   storage adjustment, then replay clean Compose,
   migration on an existing representative database,
   backup/restore and authenticated browser journeys on the exact release
   commit, not this shared dirty tree. A protected pre-migration local backup
   was captured for the current local database, but this does not constitute
   the required existing-data replay.
   The original Docker-volume object store remained full, so the replay used a
   temporary host-mounted MinIO instance rather than deleting unrelated Docker
   images, volumes, or user data.
3. Collect the explicitly quantified Phase 0 and Phase 1 customer evidence;
   tests cannot substitute for it.
4. Inspect an isolated intended diff, run independent QA and security review,
   then create a release commit. Only then may `public/main` be pushed or a
   configured production target be deployed.

### Migration recovery notes

The two current migrations are additive. If a production rollout needs to be
reverted, restore a verified pre-migration PostgreSQL backup rather than
editing migration history in place. A manual schema-only rollback would drop
`Contract.renewalReminderEnabled` and recreate the former
`ContractObligationSuggestion(contractId, sourceHash, title)` unique index
before removing `sourceKey`; it can discard per-contract reminder choices and
source identities, so it is not the preferred recovery path.
