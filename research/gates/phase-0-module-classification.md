# Aakd Phase 0 module classification

Updated: 2026-08-17
Status: release-boundary decision record
Owner: Aakd product/engineering owner
Review authority: Founder/CEO

This matrix satisfies the Phase 0 rule in `PRODUCT.md`: every product
subsystem is assigned one investment posture before new feature work resumes.
“Module” means a user-facing or operational product subsystem, not generated
Next.js output, Prisma internals, third-party dependencies, or individual
utility files. The route inventory covers 102 API route files; routes are
grouped under the owning subsystem below.

This is a Phase 0 investment boundary, not a long-term product deletion list.
For the complete professional capability strategy and progressive-disclosure
plan, see [`progressive-capability-audit.md`](progressive-capability-audit.md).

## Classification rules

| Status | Meaning in Phase 0 |
| --- | --- |
| **maintain** | Required for the truthful contract-first path, self-hosting, privacy, or safe agent boundary. Bug fixes, tests, accessibility, localization, and security work are allowed. |
| **security-only** | Retain for compatibility, but make no product expansion. Fix vulnerabilities, data loss, isolation, reliability, and regressions only. |
| **experimental** | Optional or provider-dependent behavior that may be tested behind explicit setup and review. No performance, compliance, or adoption claims. |
| **retire-candidate** | Hidden, paused, or duplicate breadth that receives no investment until a later roadmap gate or direct evidence reopens it. Deletion requires a separate migration decision. |

## Complete product-subsystem matrix

| Subsystem | Representative paths / routes | Status | Phase 0 decision |
| --- | --- | --- | --- |
| Authentication, organizations, membership and RBAC | `lib/auth/`, `/api/auth`, `/api/org`, invitation/member pages | maintain | Preserve login, organization scope, roles, owner protections, and tenant isolation. |
| Contract records and metadata | `/api/contracts`, contract list/detail pages, Prisma contract models | maintain | Preserve the contract-first record and manual correction path. |
| PDF/DOCX upload, storage and document preview | `/api/contracts/[id]/upload`, `lib/storage/`, document routes | maintain | Preserve magic-byte checks, 50 MB cap, queued processing, preview, and safe deletion/archive behavior. |
| Text extraction and cited fact review | worker extraction jobs, `/extractions`, `lib/ai/local-extract.ts` | maintain | Preserve deterministic fallback, source text/page, confidence, and individual review. |
| Obligations, renewals and alerts | obligation routes/pages, alert worker, renewal page | maintain | Preserve owners, deadlines, reminders, completion evidence, and timezone-safe dates. |
| Search and repository navigation | contract listing/search routes, full-text search | maintain | Preserve organization-scoped discovery needed for first value. |
| Activity and audit records | activity routes, activity helpers, audit-log page | maintain | Preserve actor, request source, request ID, and state-change auditability. |
| MCP / Agent Gateway | `/api/mcp`, API-key scopes, MCP tests and replay | maintain | Preserve default-deny text access, write scopes, minimized projections, attribution, and approval boundaries. |
| API keys and REST surface | `/api/org/api-keys`, scoped API routes | maintain | Preserve hashed keys, read/text_read/write scopes, tenant scope, and mutation attribution. |
| Worker, queues and recovery | `worker.ts`, `lib/jobs/`, BullMQ queues | maintain | Preserve asynchronous extraction, retries, health, and graceful failure behavior. |
| Localization and RTL | `messages/*`, locale middleware, Arabic RTL | maintain | Preserve supported translations and accessible directionality for the released path. |
| Approvals and comments | approval/comment routes and pages | security-only | Keep review gating and audit records; no workflow expansion before customer evidence. |
| Signing / DocuSeal | signing routes, DocuSeal integration and webhook | security-only | Keep optional integration safe and fail-closed; no signing-surface expansion in Phase 0. |
| Notifications and outgoing webhooks | email, Slack/Teams, webhook routes | security-only | Fix delivery, SSRF, secrets, and unsubscribe behavior; no new channels. |
| Imports and CRM connections | import routes, Drive/PandaDoc/CRM modules | security-only | Retain compatibility for existing users; no new connectors or migration claims. |
| AI provider adapters, Q&A and risk | provider resolution, embeddings, ask/risk routes | experimental | Optional setup only; reviewable outputs, citations, egress controls, and no autonomous decisions. |
| Snapshots, comparison and redlining | snapshot/compare routes, editor comparison UI | experimental | Retain code for later evidence; do not present as the Phase 0 first-run path. |
| Analytics and dashboards | analytics routes/pages and telemetry | experimental | Keep privacy-safe activation instrumentation; no unsupported business or accuracy claims. |
| Templates, authoring and clause studio | `/templates`, editor routes, template APIs | retire-candidate | Hidden from Phase 0 navigation and marketing; revisit only after the core gate or explicit evidence. |
| Autonomous agents and agent builder | `/ai/agents`, `/ai/create`, agent UI | retire-candidate | Redirected/paused; no autonomous side effects or invented usage/accuracy claims. |
| Billing and hosted Cloud | billing page, subscription scaffolding | retire-candidate | No hosted or subscription promise until managed operations and customer evidence exist. |
| Enterprise identity and compliance controls | SSO/SAML/SCIM, SOC 2, Helm/Kubernetes | retire-candidate | Absent, not a Phase 0 promise; future work requires a separate roadmap gate. |
| Deployment, backups and health | Compose files, deploy/update/doctor/backup/restore scripts | maintain | Preserve reproducible self-hosting, secret requirements, health checks, and recovery documentation. |

## Investment rule

Only **maintain** modules may receive ordinary Phase 0 implementation work. A
**security-only** module may receive a change that reduces risk or preserves
compatibility. **Experimental** and **retire-candidate** modules are frozen
unless a written evidence record names the customer job, owner, gate, and
verification condition. This matrix does not delete code or claim that paused
modules are unsupported forever; it prevents breadth from being mistaken for
validated product value.

## Review trigger

Revisit a row only after a Phase 0 evidence record, a security finding, a
release-blocking regression, or a founder-approved roadmap decision. Customer
evidence remains in
[`phase-0-customer-evidence-ledger.md`](phase-0-customer-evidence-ledger.md)
and is not implied by this classification.
