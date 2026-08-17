# Aakd Phase 0 security release checklist

Updated: 2026-08-17
Scope: AGPL self-hosted core and the tested Agent Gateway/MCP surface
Decision owner: Aakd engineering/product owner
Review authority: Founder/CEO

This checklist is the release boundary for Phase 0. Every item must be marked
PASS, FAIL, or NOT IN SCOPE with an evidence reference. A warning, an optional
integration, or an untested future feature cannot be presented as a security
claim.

| Area | Required check | Evidence | Result |
| --- | --- | --- | --- |
| Authentication | Protected application routes reject unauthenticated requests with `401` | Route inventory, integration tests | PASS |
| Tenant isolation | Cross-organization reads and mutations return `404` and disclose no data | `tests/security/org-isolation.test.ts`, isolation suite | PASS |
| Role authorization | Viewer/member/admin/legal/owner boundaries are enforced for mutations and approvals | route tests and role helpers | PASS |
| API keys | Raw keys are shown once, hashed at rest, revoked keys reject, and scopes are enforced | API-key tests and route review | PASS |
| MCP text access | API-key contract text requires explicit `text_read`; metadata reads do not expose raw text | MCP tests and HTTP replay | PASS |
| MCP mutations | Mutations require role, write scope, organization scope, activity attribution, and existing approval boundaries | MCP security matrix and tests | PASS |
| MCP projections | Contract, obligation, and import responses omit tenant IDs, emails, storage keys, provider IDs, mappings, and raw excerpts unless explicitly authorized | projection regression tests | PASS |
| MCP protocol | Initialize/initialized, tools/list, tools/call, ping, malformed envelopes, and unknown methods have deterministic responses | protocol tests and `scripts/verify-mcp-http.sh` | PASS |
| Upload handling | PDF/DOCX magic bytes, file size, names, and storage paths are validated; parsing is asynchronous | upload route, magic-byte tests, worker architecture | PASS |
| Archive semantics | Contracts are archived by status and state changes create activity; no destructive hard-delete path is used | route review and activity tests | PASS |
| AI safety | Provider is optional; egress is explicit; outputs retain source/page/confidence and require individual human review | extraction/Q&A tests and capability matrix | PASS |
| SSRF and webhooks | Outbound webhook URLs are validated at delivery time; DocuSeal/CRM callbacks require signatures and scope | webhook/SSRF tests and endpoint inventory | PASS |
| Secrets | Production Compose requires auth, database, Redis, storage, notification, and DocuSeal secrets; no credentials are committed | Compose interpolation validation and `.env.example` | PASS |
| Telemetry privacy | Activation events exclude contract text, IDs, extracted values, credentials, tokens, file names, and file size; client capture respects consent | activation event contract and tests | PASS |
| Error handling | Storage, queue, provider, webhook, and database failures return safe errors and do not leak tenant or secret material | failure-path tests | PASS |
| Recovery | Backup, restore, update, doctor, and health scripts are documented and shell-validated | self-hosting validation and release verifier | PASS |
| Dependency/runtime boundary | No client-specific Claude/Codex certification, formal compliance certification, hosted availability, or SSO/SCIM claim is made | capability matrix and public-copy tests | PASS (claim boundary) |

## Required recheck triggers

Rerun this checklist before a release that changes authentication, tenant
scoping, file processing, AI provider egress, MCP tools/scopes, webhooks,
secrets, storage, migrations, or deployment scripts. A new connector or agent
mutation cannot inherit a PASS from an unrelated module.

## Explicit non-claims

This checklist is engineering evidence, not a penetration test, certification,
DPA, SOC 2 report, legal opinion, or proof of customer adoption. The customer
evidence gate remains governed by
[`phase-0-customer-evidence-ledger.md`](phase-0-customer-evidence-ledger.md).
