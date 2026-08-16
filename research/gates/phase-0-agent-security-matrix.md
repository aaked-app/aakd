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
| Malformed JSON-RPC envelope | JSON-RPC invalid-request error | MCP protocol tests |
| Unknown tool or method | JSON-RPC/tool error; no side effect | MCP protocol tests |
| Individual obligation mutation | Member/write-scope check, organization scope, activity record | Obligation route and MCP tests |
| Approval request | Legal-or-higher role, write scope, separation of duties, auditable approval state | Approval route tests |
| Raw contract question | Provider receives only the authorized contract context; response is not exposed through list/detail tools | AI and MCP tests |

## Explicit non-goals

- No autonomous agent may send messages, sign, approve, or mutate a contract
  without a future approval/idempotency policy.
- No analytics event contains contract IDs, organization IDs, extracted values,
  document contents, or file sizes.
- This matrix does not claim external Claude or Codex client certification. The
  JSON-RPC initialize, tools/list, tools/call, ping, and notification behavior
  is tested locally; external-client replay remains a release follow-up.
