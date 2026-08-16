# Governance

Aaked is currently maintained by a single maintainer ([@wassimbensalem](https://github.com/wassimbensalem)). This document exists so contributors know how decisions actually get made today, and how that can change as the project grows.

## Decision making

- The maintainer has final say on what gets merged, the architecture direction, and the roadmap.
- Feature direction and locked architectural decisions are documented in [`CLAUDE.md`](CLAUDE.md). If a change conflicts with something documented there, open an issue to discuss it before submitting a PR, not after.
- Non-trivial changes (new dependencies, schema changes, anything touching auth or multi-tenancy) should be discussed in an issue before a PR is opened, so the direction is agreed on before the work is done.

## Pull requests

- All PRs go through the checks defined in [`CONTRIBUTING.md`](CONTRIBUTING.md): CI must pass (typecheck, lint, tests, the org-isolation test), and at least one maintainer review is required before merge.
- The maintainer aims to respond to new issues and PRs within a week. If you haven't heard anything in longer than that, a polite ping is welcome, it's not being ignored on purpose.

## Becoming a maintainer

There's no formal process yet, there's only been one maintainer so far. In practice, this happens the way it does in most small open-source projects: someone shows up, submits good PRs consistently over time, engages constructively on issues, and gets asked. If that happens, this document will be updated to reflect however many maintainers exist and how decisions get made between them.

## Scope of this document

This covers how the open-source project itself is run: what merges, what the roadmap looks like, and how contributors get involved. It does not cover the separate hosted/cloud version of Aaked, which is operated independently and is not part of this governance process.
