# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

For every independently testable user journey, state priority, acceptance scenarios,
and the automated test level: unit, integration, isolation, or E2E.

## Functional Requirements *(mandatory)*

- **FR-001**: [Specific observable capability]

## Aakd Safety and Workflow Requirements *(mandatory)*

Mark each item applicable or not applicable, with rationale and acceptance scenarios.

| Area | Applicability and requirements |
| --- | --- |
| Auth and tenancy | `resolveAuth`, request context, route authorization, `404` cross-org behavior, API-key write scope |
| Data and audit | Zod validation, `Activity` records, soft delete, relationship authorization |
| Files | PDF/DOCX and size validation, sanitized names, storage ownership, signed access, durable vs temporary source lifecycle |
| Async jobs | named queue, idempotency, retries, failure recovery and user-facing status |
| AI | source text, page, confidence, human review, provider failure behavior |
| Experience | supported locales, Arabic RTL, accessibility, loading/empty/error states, E2E outcome |

## Edge Cases *(mandatory)*

- Unauthorized, stale-session, cross-organization, invalid-input, duplicate-submit,
  external-service failure, and recovery behavior as applicable.

## Success Criteria *(mandatory)*

- **SC-001**: [Measurable user outcome]
- **SC-002**: [Automated verification command and expected result]

## Out of Scope

- [Explicitly deferred work and rationale]
