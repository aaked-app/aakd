# Phase 1 scorecard: simple professional core and first useful action

Status: engineering surface implemented locally; product evidence not collected
Version: 1
Phase: PRODUCT.md Phase 1
Accountable owner: Aakd engineering/product owner
Review authority: Founder/CEO
Evidence-collection start: 2026-08-18

This scorecard separates the Phase 1 engineering surface from the customer
evidence required to advance the roadmap. Shipping the surface does not pass
the product gate.

## Gate A: engineering surface

| Measure | PASS threshold | Evidence source | PASS action | FAIL/redirect action |
|---|---:|---|---|---|
| Unified action model | One persisted action representation serves obligation and renewal projections | Prisma schema, migration, route and projection tests | Continue | Fix model/projection boundary |
| Source traceability | 100% of persisted AI-derived actions retain source text, page when available, confidence and review state | Integration tests and fixture corpus | Continue | Block release |
| Human control | 100% of action creation, assignment, approval, completion and external delivery mutations enforce auth, organization scope, role and API-key scope | Isolation/security tests | Continue | Block release |
| Completion evidence | Every completion path records actor, timestamp, evidence state and immutable activity | Route tests and activity assertions | Continue | Block release |
| Stale safety | 0 stale-source actions may be silently executed after a source version changes | Adversarial tests | Continue | Block release |
| First useful action | A clean account can upload a supported file and create one cited, assigned action without an external AI key | Browser replay | Continue | Repair activation path |
| Work-tool output | One configured destination receives a cited action with a deep link and delivery activity | Provider contract test plus browser/manual replay | Continue | Keep output behind experimental flag |
| Agent boundary | Read-first MCP/API access returns minimized, scoped action data; mutations remain approval-bound | MCP matrix and compatibility replay | Continue | Block release |

## Gate B: product evidence

| Measure | PASS threshold | Evidence source | PASS action | FAIL/redirect action |
|---|---:|---|---|---|
| Corpus quality | At least 100 documents from at least 3 selected contract types; at least 70% of eligible documents yield one accepted action; critical-action citation precision and recall are measured separately | Redacted customer receipts and benchmark report | Advance | Revise extraction/action scope |
| Activation time | Median signup-to-first-confirmed-action under 10 minutes on the reference setup | Instrumented product events and session evidence | Advance | Simplify activation |
| Silent critical errors | 0 critical actions silently accepted with invalid source or materially wrong deadline | Adversarial corpus and customer review ledger | Advance | Block and remediate |
| Marginal support | At most 4.8 correction/support minutes per processed contract after the first 25-contract cycle and at most 2 support/customer-communication hours per organization per subsequent 25-contract cycle | Delivery/support ledger | Advance | Simplify or reject entry workflow |
| Repeat use | At least 2 organizations independently complete a second comparable cycle at least 7 days after first activation and within 90 days | Product events and customer confirmation | Advance | Keep Phase 1 open or redirect |
| Managed operation funding | At least 2 qualified organizations fund the same managed-operation offer | Payment records and signed pilot terms | Advance | Do not build Cloud expansion |

## Scope and exclusions

In scope: the unified action queue, cited reviewed action state, owner/deadline/
condition, completion evidence, one-way work-tool output, progressive access to
existing CLM surfaces, read-first Agent Gateway controls, privacy-safe action
summaries, action proposals and approval requests.

Out of scope for this scorecard: agreement-family precedence, correction
propagation across dependent actions, generic recipes, autonomous execution,
managed Cloud billing/operations, enterprise identity, additional connectors,
and customer claims based only on GitHub stars or synthetic data.

## Decision history

| Date | Version | Decision | Reason | Authority |
|---|---:|---|---|---|
| 2026-08-18 | 1 | ENGINEERING SURFACE IMPLEMENTED / PRODUCT OPEN | Action ledger, projections, review controls, one-way delivery, Agent Gateway list, UI and verification are implemented locally. Customer corpus, repeat use and managed-operation funding remain untested. | Founder/CEO |
