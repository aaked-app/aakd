# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

## Summary

[Requirement, user outcome, and smallest compatible approach]

## Existing Aakd Components to Reuse

- [Existing route, component, abstraction, queue, and tests]

## Technical Context

- **Application**: Next.js 14, React 18, strict TypeScript, Tailwind CSS
- **Data**: Prisma 7, PostgreSQL 16 + pgvector
- **Testing**: Vitest, Playwright, organization-isolation suite

## Constitution Check

| Gate | Status | Evidence |
| --- | --- | --- |
| Tenant isolation and route authorization | [PASS/N/A] | [Plan and test] |
| Audit and state transition | [PASS/N/A] | [Plan and test] |
| Storage and file lifecycle | [PASS/N/A] | [Plan and test] |
| Worker queue, idempotency, and retry | [PASS/N/A] | [Plan and test] |
| Localization, RTL, and accessibility | [PASS/N/A] | [Plan and test] |
| User-facing integration/E2E coverage | [PASS/N/A] | [Plan and test] |

## Implementation and Test Plan

Describe each change with its owning module, error path, and test coverage. Run
`pnpm --filter web test:isolation` when the feature affects auth, membership,
API keys, or organization-scoped data.

## Rollout, Observability, and Recovery

[Migration, backfill, job retry, feature flag, rollback, logs, and user recovery]

## Out of Scope

- [Explicitly deferred work and rationale]
