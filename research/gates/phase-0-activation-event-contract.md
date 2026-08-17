# Phase 0 activation event contract

Updated: 2026-08-17
Status: implemented and verified by source review plus the Phase 0 test/build
boundary

The Phase 0 roadmap requires measurement of workspace creation, healthy
installation, first upload, first review, first action, and return. This is the
event contract for that measurement. Events are optional and no-op when
PostHog is not configured or the user has not consented to client capture.

| Milestone | Evidence / event | Allowed properties | Privacy boundary |
| --- | --- | --- | --- |
| Workspace creation | `workspace_created` after successful organization creation | none | No organization name, ID, email, or contract data |
| Healthy installation | `/api/health` response plus Compose replay | `status`, `checks.db`, `checks.redis` in the operational response | No tenant data; health is a probe, not a customer-adoption claim |
| First upload | `file_uploaded` | MIME type and version only | No file name, contract ID, organization ID, text, or byte size |
| First review | `contract_fact_reviewed` | action and field name | No contract ID, organization ID, extracted value, or source text |
| First action | `obligation_created` and `obligation_completed` | priority, due-date presence, completion state | No contract ID, organization ID, title, owner email, or obligation text |
| Return | consented PostHog `$pageview` / pageleave | current route URL | No contract content; query strings must not contain secrets or document data |

## Rules

1. Server events use the authenticated user as the distinct ID only when an
   analytics key is configured; they do not use organization or contract IDs as
   the identity.
2. Client events are wrapped so telemetry failures never block signup,
   workspace creation, upload, review, or action completion.
3. A healthy install is deployment evidence, not activation or customer
   evidence. It cannot satisfy the customer ledger.
4. Event counts are directional activation signals. They do not prove a first
   successful workflow, retention, willingness to pay, or product-market fit.
5. Any new property requires a privacy review and a focused regression test;
   raw contract text, source excerpts, credentials, tokens, file names, IDs, and
   personal data are prohibited.
