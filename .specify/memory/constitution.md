# Aakd Spec Kit Constitution

This file is Aakd's feature-specification layer. `AGENTS.md` and `CLAUDE.md`
remain authoritative for implementation, operations, security, and releases.

## Core Principles

### I. Tenant isolation is a product requirement

Every organization-scoped operation must authenticate, preserve request context,
perform route-level authorization, and return `404` rather than `403` for another
organization's resource. Relevant plans must include isolation coverage.

### II. Contract data is durable and auditable

Contract state changes require an `Activity` record. Contract records are archived,
never hard-deleted. Files use the storage abstraction and their lifecycle must be
explicit: durable uploads are never treated as disposable worker inputs.

### III. Async work is owned by the worker

Long-running extraction, AI, imports, exports, notifications, signing, and CRM work
use existing BullMQ queues and the standalone worker. Plans cover retry, idempotency,
and an end-user-visible failure path where applicable.

### IV. Test the user outcome and the boundary

Every acceptance scenario has focused automated coverage. Auth, API-key, membership,
or organization-data changes also run isolation coverage. Cross-service and
end-user-critical flows need integration or E2E coverage, not only a unit test.

### V. Reuse the platform and keep it accessible

Use existing Aakd abstractions for auth, storage, signing, CRM, notifications, AI,
and localization. User-facing work covers every supported locale, Arabic RTL, and
accessible loading, empty, and error states.

## Required Feature Checks

Feature specifications state which of these apply and why: authentication and
tenancy; validation and audit; storage object lifetime; queue idempotency/retry;
AI source evidence and human review; and i18n, RTL, accessibility, and E2E outcomes.

## Workflow

Use Spec Kit for substantial features, integrations, schema/auth changes, and
workflow redesigns. Skip it for small fixes and urgent patches. Use
`$speckit-specify`, optional `$speckit-clarify`, `$speckit-plan`,
`$speckit-tasks`, and `$speckit-analyze` before implementation. Run
`$speckit-converge` after implementation; it never replaces tests, QA, review, CI,
or release approval.

## Governance

Specs may not weaken `AGENTS.md` or `CLAUDE.md`. Principles change only through a
reviewed repository change. During the pilot, do not install external presets or
extensions, and do not use automated GitHub Issue creation.

**Version**: 1.0.0 | **Ratified**: 2026-08-16 | **Last Amended**: 2026-08-16
