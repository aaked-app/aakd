# Phase 1 engineering release checklist

Date: 2026-08-18
Status: engineering implementation complete locally; release rehearsal blocked by environment configuration

## Verified

- Prisma schema validates and the Phase 1 migration is present.
- TypeScript typecheck passes.
- ESLint completes with warnings only. Existing image and hook warnings remain.
- Full web test suite: 94 files and 1,453 tests passed.
- Focused action, extraction, obligation and MCP tests pass: 148 tests.
- Organization-isolation suite passes: 11 tests.
- Production build compiles and reaches page-data collection.
- CI includes an isolated PostgreSQL/pgvector migration job that applies the
  complete Prisma migration chain to an empty database.
- Supported locale JSON files parse successfully.
- Action writes require authentication, organization scope, member role and API-key write scope.
- AI-derived actions retain source text/page/confidence/review state when available.
- Stale actions block completion and delivery until reviewed.
- Completion evidence can be recorded from the action queue and is enforced server-side when required.
- Approval decisions transition linked actions transactionally.
- Reminder delivery has an idempotency key, durable failure state and activity record.

## Not yet verified

- Applying the migration to an existing production-like PostgreSQL database.
  The CI migration job covers an empty PostgreSQL/pgvector database; the local
  run has no `DATABASE_URL`.
- Clean Docker/Compose replay with PostgreSQL, Redis, object storage and worker.
- A real configured email provider receiving the cited action output.
- The 100-document product benchmark and customer evidence gates in the Phase 1 scorecard.
- Two repeat organizations or two organizations funding managed operation.

## Release decision

Do not call Phase 1 product-complete or claim customer readiness yet. The engineering surface is ready for a configured local/CI replay. Set a non-default `BETTER_AUTH_SECRET`, configure `BETTER_AUTH_URL`, provide `DATABASE_URL`, run the migration, start the worker, and execute the clean Compose replay before publishing a release artifact.
