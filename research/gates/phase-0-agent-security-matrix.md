# Phase 0 Agent Gateway security matrix

Updated: 2026-08-17

This matrix is the adversarial corpus index for the MCP surface. It records the
boundary that is actually released in Phase 0. Autonomous workflow execution,
approval bypass, and external side effects remain outside this release.

| Scenario | Expected result | Verification |
| --- | --- | --- |
| Unauthenticated MCP request | `401` | MCP integration tests |
| Viewer calls `create_contract` | Tool error; no write | MCP integration tests |
| API key without `write` scope calls any mutation | Tool error; no write | MCP integration tests |
| Cross-organization contract ID | Not found / no data | MCP and isolation tests |
| `get_contract` request | Safe metadata and cited fields only; no raw extracted text or tenant ID | MCP response-shape tests |
| `list_contracts` request | Safe list projection only; no raw extracted text or tenant ID | MCP query projection tests |
| `ask_contract` with API key lacking `text_read` | Tool error before contract lookup or provider call | MCP text-access regression |
| `ask_contract` with session member or API key carrying `text_read` | Contract text may be sent only for the requested contract; provider remains optional and no mutation occurs | MCP text-access boundary and AI tests |
| `list_obligations` request | Safe obligation projection; no organization identifier, creator/assignee email or hidden fields | MCP projection regression |
| `get_import_job` request | Safe job/row projection; no storage keys, drive IDs, mappings, error-report keys or organization identifier | MCP projection regression |
| Malformed JSON-RPC envelope | JSON-RPC invalid-request error | MCP protocol tests |
| Unknown tool or method | JSON-RPC/tool error; no side effect | MCP protocol tests |
| Individual obligation mutation | Member/write-scope check, organization scope, activity record | Obligation route and MCP tests |
| MCP/API mutation attribution | Activity metadata records request source and request ID alongside the acting user | Activity attribution unit tests and MCP mutation tests |
| Approval request | Legal-or-higher role, write scope, separation of duties, auditable approval state | Approval route tests |
| Raw contract question | Provider receives only the authorized contract context; response is not exposed through list/detail tools; API keys require explicit `text_read` | AI and MCP tests |

## Public endpoint inventory

The route audit covered all 102 `apps/web/app/api/**/route.ts` files. The five
routes without `resolveAuth` are deliberate integration or probe endpoints, not
unscoped application APIs:

| Endpoint | Why it is public | Compensating control | Verification |
| --- | --- | --- | --- |
| `/api/auth/[...all]` | Better Auth must receive sign-in, sign-up, and callback requests | Better Auth validates the session flow; POST is rate-limited per source IP and sign-up input is bounded/sanitized | Auth integration tests; route inspection |
| `/api/health` | Orchestrators need a liveness/readiness probe before a session exists | Read-only DB/Redis probes, bounded timeouts, secure response headers, no tenant data | Health integration tests |
| `/api/user/unsubscribe` | Email clients follow one-click unsubscribe links without an active session | HMAC-signed, expiring token is required; token subject must still be an organization member; only that event preference is changed | Notification integration tests |
| `/api/webhooks/docuseal` | DocuSeal calls the signing callback directly | Raw-body HMAC-SHA256 is mandatory; missing secret/signature fails closed; signed document URL is host allow-listed; contract update is organization-scoped and state-guarded | Webhook integration tests |
| `/api/crm/[provider]/webhook` | CRM providers call deal-stage callbacks directly | Provider-specific signature verification occurs inside `parseWebhookEvent`; only a matched integration enters an organization request context; writes are link-scoped and state-guarded | CRM integration tests; provider implementation audit |

No other API route is intentionally unauthenticated. Public webhook handlers
must remain fail-closed for writes even when their provider has no connected
integration, and must never echo tenant or contract data in their responses.

## Explicit non-goals

- No autonomous agent may send messages, sign, approve, or mutate a contract
  without a future approval/idempotency policy.
- API-key `read` is metadata-only. Contract text access is a separately granted
  `text_read` capability and is never implied by `write`.
- No analytics event contains contract IDs, organization IDs, extracted values,
  document contents, or file sizes.
- This matrix does not claim external Claude or Codex client certification. The
  JSON-RPC initialize, tools/list, tools/call, ping, and notification behavior
  is tested locally; external-client replay remains a release follow-up.
