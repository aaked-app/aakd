# Contributing to Aakd

Thank you for your interest in contributing. Aakd is an open-source, self-hostable Contract Lifecycle Management platform licensed under AGPL-3.0.

## Getting Started

Use Node.js 24 LTS and the pnpm version pinned in `package.json` for source
development. Release images and CI use Node.js 24; other Node majors are not
part of the supported release baseline.

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Install dependencies and start the dev environment:
   ```bash
   pnpm install
   cp .env.example .env        # fill in required values (see .env.example comments)
   pnpm db:migrate             # run Prisma migrations
   pnpm dev                    # Next.js dev server
   pnpm worker:dev             # BullMQ worker (separate terminal)
   ```

3. Read the [README](README.md), [security policy](SECURITY.md), and relevant
   [deployment and API documentation](docs/) before changing behavior. Preserve
   existing authorization, storage, queue and provider abstractions.

4. Check `.env.example` for every environment variable the app needs. AI and email are optional — the app runs without them.

## Making Changes

- Match the existing code style. The codebase uses TypeScript, Tailwind CSS, and Prisma — no exceptions.
- Keep changes focused. Touch only what your PR needs.
- Every API route must call `resolveAuth(req)` and be org-scoped via Prisma middleware — never bypass this.
- New background work goes through BullMQ queues in `worker/`, not inline in API routes.
- Validate all request bodies with Zod before touching the database.

## Tests

```bash
pnpm test               # vitest unit + integration
pnpm test:e2e           # playwright end-to-end
pnpm test:isolation     # org-scope isolation test — must pass before any merge
pnpm typecheck          # tsc --noEmit across all packages
```

The org-scope isolation test is a hard gate. PRs that fail it will not be merged.

Production builds use `pnpm build`, which selects Next's supported Webpack
builder. In Next 16.3.1, Turbopack's custom file-tracing includes can recursively
follow pnpm's workspace link into previous build outputs. Do not remove the
`--webpack` flag without verifying repeated builds, standalone size and runtime
assets. Development still uses the existing development-server configuration.

## Submitting a Pull Request

- Open a PR against `main`.
- Describe what changed and why.
- Reference any related issue.
- PRs require passing CI and at least one code review before merge.

## Reporting Bugs

Open a GitHub issue with steps to reproduce, expected behavior, and actual behavior. For security vulnerabilities, see `SECURITY.md` — do not open a public issue.

## Code of Conduct

Be respectful. Harassment of any kind is not tolerated.
