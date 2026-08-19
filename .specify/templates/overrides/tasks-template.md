# Tasks: [FEATURE NAME]

**Input**: [feature specification and plan]

## Required Task Rules

- Every task names the exact repository path it changes.
- Tests are required for every acceptance scenario, not optional.
- Put isolation tests beside auth, membership, API-key, or org-data work.
- Include i18n/RTL and accessibility work for user-facing changes.
- Include worker idempotency, retry, and failure handling for async work.
- Do not add GitHub Issues automatically during the pilot.

## Tasks

- [ ] T001 [P] [US1] Add failing focused test at [path] for [acceptance scenario].
- [ ] T002 [US1] Implement [behavior] at [path], preserving [Aakd invariant].
- [ ] T003 [US1] Add integration/E2E test at [path] for [user outcome].
- [ ] T004 [US1] Run [exact verification command].
