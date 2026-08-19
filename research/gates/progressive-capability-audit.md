# Aakd progressive capability audit

Updated: 2026-08-18
Status: product direction and implementation map
Owner: Aakd product/engineering owner

## Decision

Aakd should remain a complete professional CLM. We do not delete useful
capabilities to make the product appear simple. Instead, the interface exposes
the common path first and progressively reveals advanced controls.

The five labels below describe the next product posture, not whether code is
deleted:

| Label | Meaning |
| --- | --- |
| **keep and improve** | Core capability users should be able to use now; fix correctness, trust, accessibility and UX. |
| **keep, progressive UX** | Capability remains available, but advanced configuration stays behind an explicit advanced path. |
| **add** | Missing capability required by the target CLM vision. |
| **later / evidence-gated** | Keep compatibility or a safe preview, but do not expand until the relevant phase gate or customer evidence passes. |
| **unsupported / correct claims** | Do not present as available until implementation and verification exist. |

"Later" never means delete. It means the capability must not complicate the
first-run workflow or make an unsupported promise.

## Capability matrix

| Capability | Current state | Target posture | Phase | Main improvement or gap |
| --- | --- | --- | --- | --- |
| Repository, folders, tags, versions | Working | Keep and improve | 0 | Upload-first flow, relationship-aware navigation and better empty states. |
| PDF/DOCX upload, validation, storage, preview | Working | Keep and improve | 0 | Preserve safe file checks, queued processing and fast preview. |
| OCR and text extraction | Working with deterministic fallback | Keep and improve | 0 | Clear processing states, retry/recovery, source page retention and no silent failure. |
| AI metadata extraction | Working | Keep and improve | 0/1 | Show citation, confidence, extracted-vs-user-entered state, correction history and explicit unknowns. |
| Custom metadata and schemas | Partial fixed fields | Add progressively | 1/2 | Defaults first; custom fields and schemas in an advanced configuration path. |
| Full-text and semantic search | Working | Keep, progressive UX | 0/1 | Permission-filtered results with exact excerpts and predictable fallback when embeddings are unavailable. |
| Contract Q&A | Working with provider configuration | Keep, progressive UX | 1 | Read-only by default, cited answers, clear model/provider state and no unsupported legal certainty. |
| AI risk analysis | Working | Keep and improve | 1 | Explain every finding with rule, source, confidence and review state. |
| Obligations | Working | Keep and deepen | 0/1 | Owners, recurring obligations, dependencies, evidence, escalation, blocker and exception states. |
| Renewals and notice windows | Working | Keep and deepen | 0/1 | Per-contract reminder toggle, history, decision workflow, escalation and price/change tracking. |
| Contract Action Ledger | Partial action/obligation foundation | Add / unify | 1 | One queue for obligations, renewals, approvals and follow-up actions with source, owner, due date, evidence and status. |
| Fulfilment and completion evidence | Partial | Add / deepen | 1 | Attach evidence, distinguish complete/blocked/excepted, verify or reject immutably. |
| Dashboard and analytics | Working but broad | Keep, progressive UX | 0/1 | Action queue first; portfolio and cycle-time analytics remain available to advanced users. |
| Approvals | Working basic flow | Keep, progressive UX | 1 | Simple sequential default; conditional, parallel, thresholds, fallback and escalation for advanced teams. |
| Comments and collaboration | Working | Keep and improve | 1 | Tie comments to facts, actions, approvals and evidence instead of leaving context in a generic thread. |
| Templates and clause libraries | Working/partially paused | Keep, progressive UX | 1/2 | Preserve templates, variables and approval rules; do not force template setup on repository users. |
| Authoring and document export | Working/partially paused | Keep, progressive UX | 1/2 | Separate create-a-contract journey from executed-contract operations. |
| Redlining and comparison | Partial/experimental | Keep, evidence-gated | 2 | Improve version semantics and Word interoperability before expanding playbooks. |
| E-signature / DocuSeal | Adapter and webhook paths exist | Keep, optional setup | 1 | Make signing order, reminders, audit trail and configuration status explicit; verify with a real DocuSeal instance. |
| Notifications and digests | Email, in-app, Slack/Teams/webhooks exist | Keep and improve | 0/1 | Delivery observability, preference handling, retries, digest summaries and clear SMTP diagnostics. |
| CRM integrations | HubSpot, Salesforce, Pipedrive adapters | Keep selectively | 1/2 | Start with one evidence-backed connector and prefer reviewable one-way outputs. |
| Cloud storage connectors | UI placeholders | Later / evidence-gated | 1/2 | Add Drive/SharePoint/OneDrive only when a real import or sync job is evidenced. |
| Accounting connectors | UI placeholders | Later / evidence-gated | 2 | Add only for a demonstrated contract-to-finance workflow. |
| Webhooks and REST API | Working | Keep and improve | 0/1 | Stable events, idempotency, examples, delivery logs and citation-preserving payloads. |
| MCP / Agent Gateway | Working tested surface | Keep and harden | 0/3 | Typed capabilities, least privilege, previews, approvals, attribution, stale-state checks and replay tests. |
| Autonomous agent builder | Mock/unfinished | Later / evidence-gated | 3 | Do not expose autonomous side effects; begin with read-only reviewed suggestions and approved recipes. |
| Agreement relationships | Missing/partial | Add | 1/2 | Link MSA, SOW, order form, DPA, amendment and renewal with parent, precedence and supersession. |
| Governing-truth / precedence | Missing | Add | 2 | Resolve which agreement and version governs each fact or action. |
| Correction propagation | Missing | Add | 2 | A reviewed correction must identify affected obligations, actions, approvals and briefs. |
| Stale-state invalidation | Missing | Add | 2/3 | Block or re-review actions after governing documents or facts change. |
| Contract recipes | Missing | Add gradually | 3 | Proven renewal, onboarding, SLA and vendor-obligation patterns before a generic builder. |
| Imports and migration | Multiple adapters exist | Keep and improve | 0/1 | Mapping preview, partial-failure recovery, provenance and safe re-run behavior. |
| Audit history | Working | Keep and strengthen | 0/1 | Immutable, human-readable records for changes, review, approval, signing and evidence. |
| Permissions and tenant isolation | Working foundation | Keep and expand | 0/2 | Simple roles by default; granular views, sensitivity and egress controls later. |
| SSO/SCIM and enterprise identity | Not implemented/proven | Unsupported / correct claims | 4 | Remove claims until implemented, tested and supported operationally. |
| Retention and legal hold | Missing | Add for enterprise | 2/4 | Policy-based retention, legal hold, export and restore evidence without default UX burden. |
| Billing and managed Cloud | Preview/scaffolding only | Later / evidence-gated | 4 | Add only after operated provisioning, backups, support, incidents, billing and portability exist. |
| Self-hosting and deployment | Compose and health paths exist | Keep and improve | 0 | Clean-machine install, worker/storage checks, backup/restore and upgrade documentation. |
| Localization and Arabic RTL | Existing locales | Keep and improve | 0/1 | Keep released workflows translated and test RTL for every new control. |

## UX rules

1. A new user can upload one executed contract and reach a cited reviewed
   action without configuring integrations, templates or AI infrastructure.
2. Every advanced control has a clear explanation of what it changes and a
   safe default.
3. The user sees one concept once: obligations and renewals feed the Action
   Ledger rather than competing dashboards with duplicate states.
4. AI never silently overwrites a user-entered value or turns an inference into
   canonical contract truth.
5. Every consequential action shows source, confidence, owner, due/condition,
   approval state and completion evidence.
6. Integrations produce reviewable, citation-linked outputs before we attempt
   bidirectional synchronization.

## Prioritized implementation order

### P0: preserve and make trustworthy

- Finish the contract-first upload, extraction, review and action path.
- Fix processing/error states and SMTP/worker delivery observability.
- Keep approvals, signing, templates and integrations available through
  advanced or optional paths without forcing setup.
- Remove unsupported claims and label unfinished capabilities accurately.

### P1: unify the professional core

- Unify obligations, renewals, approvals and follow-up into the Action Ledger.
- Add evidence, blocked/excepted states, escalation and immutable verification.
- Add agreement-family links and a simple relationship view.
- Add one citation-preserving work-tool output and one tested CRM connector.

### P2/P3: governing intelligence and safe automation

- Add precedence, correction propagation and stale-state invalidation.
- Add contract recipes with dry-run, idempotency, retries and approvals.
- Add governed Team Briefs and approved agent skills; keep autonomous actions
  disabled by default.

### Enterprise / Cloud later

- Add granular policy views, retention/legal hold, SSO/SCIM, managed Cloud,
  billing, support and operational evidence only when their gates are met.

## Verification and invalidation

This audit is a roadmap classification, not customer validation. A capability
can move forward only when its phase gate is met with real workflow evidence.
The direction must be revisited if users cannot complete the default path,
advanced controls remain unused after repeated qualified workflows, or a
feature creates silent stale state, unauthorized access, unsupported legal
claims or disproportionate support burden.
