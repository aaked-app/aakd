# M14: Phase 1 simple professional core and first useful action

Status: implementation started; customer gate remains open
Owner: Aakd engineering
Product source of truth: `PRODUCT.md`
Gate: `research/gates/phase-1-scorecard.md`

## Objective

Deliver one complete, safe journey:

```text
executed contract
  -> cited reviewed fact
  -> owned action
  -> deadline/condition
  -> approval when required
  -> one-way work-tool output
  -> completion evidence
  -> auditable history
```

The implementation must coexist with Drive, SharePoint, CRM, task tools and
existing CLM/e-signature systems. It must not become a migration project or an
autonomous legal agent.

## Customer job and phase mapping

Customer job: a startup or lower-midmarket service/software company needs to
know what a signed agreement requires next, who owns it, why it is required,
and whether it was completed, without searching PDFs and spreadsheets.

Roadmap: Phase 1 simple professional core and first useful action. The Phase 0
engineering boundary remains a prerequisite. Product success still requires
the signed Phase 1 scorecard; code and synthetic fixtures cannot substitute for
customer evidence.

## Verified facts

- `ContractObligation` already stores owners, due dates, status, reminders,
  subtasks and completion actor/time.
- Renewal records are currently computed from contract end date, notice period
  and auto-renewal fields rather than persisted action records.
- AI extraction and obligation suggestions retain source text/page/confidence
  and require human acceptance.
- Approvals, activity history, notification fan-out and scoped MCP/API paths
  already exist.

## Design decision

Add a first-class `ContractAction` projection rather than overload the
obligation schema with renewal-specific semantics. Existing obligations remain
API-compatible and gain a one-to-one action projection. Renewal deadlines are
materialized idempotently from the current reviewed contract facts. A source
version/hash is stored on every action so a changed document marks affected
actions stale instead of silently executing them.

`ContractAction` is the user-facing ledger. It contains:

- `contractId`, organization and optional source obligation/alert identifiers;
- `kind` (`OBLIGATION`, `RENEWAL_NOTICE`, `EXPIRY`, `CUSTOM`);
- title, condition, owner, due date and optional notice date;
- source text, source page, confidence, source version/hash and review state;
- status (`PROPOSED`, `PENDING_REVIEW`, `ACKNOWLEDGED`, `IN_PROGRESS`,
  `COMPLETED`, `BLOCKED`, `STALE`, `DISMISSED`);
- evidence requirement and completion evidence metadata;
- escalation state and timestamps;
- activity and delivery relations.

No raw contract text is returned by default from MCP/API action lists. Source
text/page is available only through the existing explicit text-read boundary
and authorized UI review.

## Implementation slices

### Slice 1: domain and migration

- Add `ContractAction`, `ContractActionEvidence` and delivery-attempt records.
- Add unique source keys for idempotent obligation/renewal projection.
- Add indexes for organization, status, due date, owner and stale state.
- Backfill existing obligations and active renewal deadlines in a resumable
  worker job. Never delete or rewrite existing obligation data.
- Add migration rollback notes and a feature flag for the new UI.

### Slice 2: projection and safety

- Project accepted obligation suggestions into actions.
- Materialize renewal/notice actions only from reviewed facts; unknown dates do
  not create invented deadlines.
- Re-run projections after new uploads or reviewed corrections.
- Mark actions stale when source hash/version changes; block completion/output
  while stale until reviewed.
- Use transactions and idempotency keys to prevent duplicate actions.
- Write activity for create, review, assign, acknowledge, start, complete,
  stale, dismiss, delivery and evidence changes.

### Slice 3: unified action API and UI

- Add organization-scoped list/filter API for owner, status, due window, kind,
  confidence and review state.
- Add review, assign, acknowledge, complete, reopen, dismiss and evidence
  endpoints with role and API-key write-scope enforcement.
- Replace the dashboard attention area with the action queue while retaining
  existing obligation/renewal URLs for compatibility.
- Add a contract brief showing next action, citation, confidence, owner,
  deadline/condition, evidence and history.
- Preserve progressive links to approvals, signing, analytics and advanced
  screens rather than placing them in first-run flow.

### Slice 4: approval and one-way output

- Allow a proposed action to request an existing approval before external
  delivery or consequential completion.
- Implement one output first: cited email digest/deep link using the existing
  queued notification infrastructure. Do not add a new connector yet.
- Record delivery attempt, provider response category, retry state and activity.
- Keep Slack/Teams/webhooks as compatibility paths; do not claim bidirectional
  task synchronization.

### Slice 5: Agent Gateway and privacy

- Add action list/detail tools with minimized projections and organization
  scope. Default reads omit raw source text and storage keys.
- Require explicit `text_read` for source excerpts and write scope plus member
  role for mutations.
- Require approval state for external delivery and completion side effects.
- Add privacy-safe summary generation that never treats a summary as canonical
  contract truth.
- Add replay, stale-state, duplicate-delivery and cross-tenant adversarial
  tests.

### Slice 6: activation, benchmark and release

- Add events for action proposed, reviewed, assigned, acknowledged, delivered,
  completed and second-session start without contract contents or identifiers.
- Version a 100-document synthetic benchmark across at least three contract
  types with expected critical actions and citation spans.
- Add timing and support ledger hooks; report engineering metrics separately
  from customer evidence.
- Update README/capability matrix and all locales.
- Run full Phase 0 verifier plus Phase 1 tests and a clean Compose replay.

## Stress-test and failure controls

| Failure mode | Required control |
|---|---|
| Renewal action duplicated every daily run | Unique source key plus transaction/upsert test |
| Manual correction overwritten by AI | Reviewed/manual facts are canonical; projection uses reviewed version only |
| Amendment makes old deadline unsafe | Source hash/version mismatch marks dependent action `STALE` and blocks side effects |
| Viewer or read-only API key mutates action | Server-side role and scope checks plus isolation tests |
| Agent sees unrelated source content | Minimized action projection and explicit `text_read` gate |
| Email retry creates duplicate external work | Idempotency key, delivery log and retry state |
| Completion claimed without proof | Evidence requirement enforced at transition; activity records actor/time |
| Missing date becomes invented deadline | Unknown remains unknown; action is review-blocked |
| Migration damages existing data | Additive migration, resumable backfill, feature flag and compatibility routes |
| Queue/worker outage blocks user request | API returns durable pending state; worker retry and visible error state |
| Broad feature creep | Phase 1 scorecard and explicit out-of-scope list block new connectors, recipes, Cloud and enterprise controls |

## Non-goals

Agreement-family precedence, correction propagation across multiple agreements,
generic recipes, autonomous agents, Cloud billing/operations, SSO/SCIM,
additional connectors, full bidirectional task synchronization, drafting and
template expansion remain later phases or evidence-gated experiments.

## Completion definition

Engineering Phase 1 is complete only when every Gate A row in the scorecard is
PASS, the code is committed and cleanly replayed from empty volumes, and the
release documentation names remaining product-evidence failures. Overall
Phase 1 advances only after every Gate B row passes.
