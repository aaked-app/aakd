# Aakd Spec Kit Constitution

`AGENTS.md` and `CLAUDE.md` are authoritative. This constitution is a concise
feature-specification layer and must not duplicate or weaken them.

## Core Principles

### I. Tenant isolation

Authenticate protected work, preserve request context, authorize routes and
relationships, and use `404` for another organization's resource. Include
organization-isolation coverage whenever this area changes.

### II. Durable contract records and files

Audit contract state transitions with `Activity`, archive instead of hard-delete,
and make durable-versus-temporary storage object lifetime explicit.

### III. Worker-owned asynchronous work

Use the existing named BullMQ queues and worker. State idempotency, retry, and
recoverable failure behavior for relevant work.

### IV. Verifiable user outcomes

Every acceptance scenario gets focused automated coverage. Critical user and
cross-service paths need integration or E2E coverage; auth/tenant changes need the
isolation suite.

### V. Existing abstractions and inclusive experience

Reuse Aakd's established auth, storage, signing, CRM, notification, AI, and
localization modules. User-facing work covers supported locales, Arabic RTL,
accessibility, and loading, empty, and error states.

## Workflow

Use Spec Kit only for substantial features, integrations, workflow redesigns, and
auth/schema work. Do not use it for small fixes or urgent patches. The pilot forbids
external extensions, presets, and automatic GitHub Issue generation.

## Governance

This document is governed by `AGENTS.md` and `CLAUDE.md`. Amend it only with a
reviewed repository change.

**Version**: 1.0.0 | **Ratified**: 2026-08-16 | **Last Amended**: 2026-08-16
