# Aakd — Project Guide for Claude Code and Codex

Read this file before changing code. It is shared guidance for Claude Code, Codex, and human contributors. `AGENTS.md` contains the repository's additional operating rules; when both apply, follow the more specific instruction.

## Product and current state

Aakd is an open-source, self-hostable, AI-native Contract Lifecycle Management (CLM) platform. The public repository is [aaked-app/aakd](https://github.com/aaked-app/aakd); the current release is v1.2.1.

It supports contract storage and search, AI extraction and cited Q&A, renewals and obligations, approvals and DocuSeal signing, authoring/templates/redlining, notifications and webhooks, CRM integrations, imports, an MCP endpoint, and English/French/German/Spanish/Arabic (RTL).

## Workspace map

```text
apps/web/
  app/                 Next.js 14 App Router pages and API routes
  components/          React UI (Tailwind CSS)
  lib/                 auth, Prisma, storage, AI, jobs, imports, CRM, editor, notifications
  prisma/schema.prisma Prisma schema and migrations
  worker.ts            standalone BullMQ worker entry point
  tests/               unit, integration, security, and E2E tests
  messages/            next-intl translations
worker/jobs/           worker modules shared by apps/web/worker.ts
docs/                  API, self-hosting, deployment, and integration guides
docker-compose*.yml    local/dev and production stacks
```

This is a pnpm workspace, but the only active package is `apps/web` (`web`). Use `@/` for imports inside that package.

## Commands

Run these from the repository root:

```bash
pnpm install
pnpm dev                         # Next.js development server
pnpm --filter web worker:dev      # BullMQ worker in watch mode
pnpm build
pnpm typecheck
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web test:e2e
pnpm --filter web test:isolation  # cross-organization isolation regression test
pnpm --filter web db:generate
pnpm --filter web db:migrate
pnpm --filter web db:studio
```

For the complete local stack, copy `.env.example` to `.env` and run `docker compose up`. Use `docker-compose.dev.yml` for development overrides and `docker-compose.prod.yml` only with `.env.prod` for production. Do not expose the development MinIO or Mailpit defaults publicly.

CI runs Prisma generation, type checking, linting, tests, and a production build. Match the narrowest relevant check locally; run `pnpm --filter web test:isolation` for changes that touch auth, organization membership, API keys, or organization-scoped data.

## Architecture and non-negotiable boundaries

- **Framework/UI:** Next.js 14 App Router, React 18, TypeScript strict mode, Tailwind CSS. Keep server/client boundaries explicit.
- **Data:** PostgreSQL 16 with pgvector through Prisma 7. Schema and migrations live in `apps/web/prisma/`.
- **Auth:** Better Auth supports browser sessions and `Authorization: Bearer cf_live_...` API keys. Raw API keys are never stored: use SHA-256 lookup hashes and bcrypt key hashes.
- **Multi-tenancy:** `resolveAuth(req)` returns the authenticated organization context. Protected API handlers must authenticate first and execute organization-scoped database work inside `requestContext.run(ctx, async () => ...)`. The Prisma extension in `lib/db/client.ts` injects scope for direct-org models, but it is not permission to bypass route-level authorization or relationship checks.
- **Access control:** Return `401` when unauthenticated and `404`, not `403`, for resources belonging to another organization. API-key write operations must also enforce `requireWriteScope(ctx)`.
- **Validation/auditing:** Parse request bodies with Zod before database work. Contract state changes must create an `Activity` record. Archive contracts by setting their status; do not hard-delete them.
- **Files:** PDF and DOCX only; validate magic bytes, sanitize names, limit uploads to 50 MB, and use `lib/storage/`. Do not parse large uploads inline in routes.
- **Async work:** Use BullMQ queues from `lib/jobs/queues.ts`; `apps/web/worker.ts` owns the workers. Current queues include extraction, embeddings, AI extraction, alerts, obligations, signing sync, email, notifications, document conversion/export, CRM polling, and imports.
- **AI:** Anthropic, OpenAI, and Ollama are supported through the AI helpers. Embeddings are fixed at 1536 dimensions. AI-derived contract data needs exact source text, source page, confidence, and human review; do not silently write it as canonical data.
- **External services:** use the S3-compatible storage abstraction, DocuSeal for signing, and the existing CRM/notification abstractions. Never introduce direct AWS SDK usage outside the storage layer or heavy background processing in a route handler.

## Change workflow

1. Inspect the affected route, component, schema, worker handler, and nearest tests before editing.
2. Keep changes surgical and preserve existing conventions. Avoid unrelated refactors and do not overwrite uncommitted user changes.
3. Add or adjust focused tests whenever behavior changes. Security-sensitive changes need organization-isolation coverage.
4. Run the relevant commands above and report what ran and what did not.

For user-facing changes, maintain all supported locales in `apps/web/messages/` and account for Arabic RTL. For schema changes, add a Prisma migration instead of editing the schema alone. For secrets/configuration changes, update `.env.example` and deployment documentation when appropriate.

## Configuration and observability

Required runtime infrastructure is PostgreSQL, Redis, S3-compatible storage, and Better Auth. `NOTIFICATION_ENCRYPTION_KEY` is required when the worker starts; AI, SMTP, DocuSeal, CRM, OpenTelemetry, Sentry, and PostHog are optional integrations with their variables documented in `.env.example`.

Use structured logging from `lib/logger.ts`; retain the request ID propagated by `middleware.ts`. OpenTelemetry is opt-in. Never log API keys, passwords, encryption material, OAuth tokens, uploaded contract text, or other secrets.

## Naming note

The product is **Aakd**. Some internal identifiers and deployment defaults still use the historical `clauseflow` name (for example database names, bucket names, Docker volume names, and API-key prefix `cf_live_`). Treat them as compatibility-sensitive: do not rename them casually or as part of unrelated work.

## Reference material

- `README.md` — product overview and quick start
- `CONTRIBUTING.md` — contributor workflow
- `docs/self-hosting.md` and `docs/deploy-oracle-cloud.md` — operations
- `docs/api-reference.md` and `docs/zapier-integration.md` — integrations
- `SECURITY.md` — vulnerability reporting and security policy
- `CHANGELOG.md` — release history
