# Aakd — Repository Instructions for Codex, Claude, and Contributors

Read this file and `CLAUDE.md` before changing code. They deliberately share the same project facts. If they ever conflict, stop and reconcile the guides before relying on either one.

Read `PRODUCT.md` for the canonical product vision, ICP, roadmap, feature boundaries, agent/security principles and cross-team decision rules. Every material change should map to one of its phases and gates.

“Material change” means a user-visible capability, schema/domain primitive, authorization or data boundary, edition placement, public product claim, or roadmap priority. Routine fixes and maintenance do not need an invented roadmap justification.

## Project

Aakd is an open-source, self-hostable, AI-native Contract Lifecycle Management platform. It is publicly hosted at `aaked-app/aakd` and is currently released as v1.2.1.

The active application is the `apps/web` workspace: Next.js 14 App Router, React 18, strict TypeScript, Tailwind CSS, Prisma 7/PostgreSQL 16 + pgvector, Better Auth, BullMQ/Redis, S3-compatible storage, TipTap, next-intl, Vitest, and Playwright. `apps/web/worker.ts` is the separate BullMQ worker; `worker/jobs/` holds shared worker modules. There is no active `packages/` implementation.

Product capabilities already include authoring/templates/redlining, obligations, analytics, CRM, imports, notifications, signing, MCP, and i18n. Do not reject work merely because it falls in one of those areas; inspect existing code and confirm scope with the user when it is genuinely unclear.

## Commands

Run from the repository root:

```bash
pnpm install
pnpm dev
pnpm --filter web worker:dev
pnpm build
pnpm typecheck
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web test:e2e
pnpm --filter web test:isolation
pnpm --filter web db:generate
pnpm --filter web db:migrate
pnpm --filter web db:studio
```

Use `docker compose up` with a populated `.env` for the local stack. Production uses `docker-compose.prod.yml` and `.env.prod`; never expose the development MinIO or Mailpit defaults. CI generates Prisma client code, then runs typecheck, lint, tests, and a production build.

## Security and implementation rules

1. **Authenticate and scope every protected API route.** Call `resolveAuth(req)` and return `401` when it is null. Wrap organization-scoped work in `requestContext.run(ctx, async () => ...)` so the Prisma extension receives `AsyncLocalStorage` context.
2. **Maintain tenant isolation.** The Prisma extension in `apps/web/lib/db/client.ts` applies direct organization filters, but route-level authorization and relationship checks are still required. For another organization's resource, return `404`, not `403`.
3. **Respect API-key authorization.** Bearer keys use the `cf_live_` compatibility prefix; never store raw keys. Enforce `requireWriteScope(ctx)` for API-key mutations.
4. **Validate and audit.** Validate request bodies with Zod. Contract state changes must write an `Activity` record. Contracts are archived via status—do not hard-delete them.
5. **Process files safely.** Accept only PDF/DOCX, validate magic bytes, sanitize names, cap uploads at 50 MB, and use `lib/storage/`. Do not parse, embed, or call AI inline in an API route.
6. **Use the worker architecture.** Enqueue named BullMQ jobs through the lazy queue getters in `apps/web/lib/jobs/queues.ts`; the standalone worker owns the processing. Do not create ad hoc async processing paths.
7. **Keep AI reviewable.** AI-derived contract data must retain exact source text, source page, confidence, and human review. Aakd resolves AI configuration through its existing helpers; do not assume nonexistent provider interfaces.
8. **Preserve localization and secrets.** User-facing changes must cover the supported translations and Arabic RTL. Do not log or commit credentials, raw contract content, OAuth tokens, or encryption keys.
9. **Use existing abstractions.** Storage calls go through `lib/storage/`; signing goes through DocuSeal; notifications and CRM use their respective modules. Do not introduce direct service integrations without a clear need.

## Working method

- Inspect the touched route/component/schema/worker path and closest tests before editing.
- Make surgical changes only; preserve unrelated user work and avoid opportunistic refactors.
- Add focused tests for behavior changes. Run the narrowest relevant verification, and also run `pnpm --filter web test:isolation` for auth, membership, API-key, or org-data work.
- For schema changes, create a Prisma migration. For environment changes, update `.env.example` and relevant deployment documentation.
- Before destructive or external actions (force pushes, production changes, deletions, messages, releases), confirm authorization and exact scope.

## Compatibility note

The product name is **Aakd**, but historical `clauseflow` identifiers remain in database/bucket/Compose defaults and the API-key prefix. Treat them as compatibility-sensitive: do not rename them as incidental cleanup.

## Documentation parity

`CLAUDE.md` is the longer assistant guide; this file is the Codex-friendly operational equivalent. When one changes a shared architecture, safety, command, or workflow fact, update the other in the same change.
