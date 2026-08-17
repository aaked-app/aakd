# Aakd Phase 0 capability matrix

Updated: 2026-08-17

This is the release boundary for the open-source core. A capability is listed as
available only when its current behavior is documented and covered by the Phase 0
verification record. Marketing copy must not promote capabilities marked paused,
experimental, or absent.

| Capability | Phase 0 status | Release boundary | Evidence / owner |
| --- | --- | --- | --- |
| PDF/DOCX upload | Available | Real-file upload with type and size validation; processing is queued | `apps/web/app/api/contracts/[id]/upload/route.ts`; release evidence |
| Contract metadata review | Available | User reviews and edits extracted fields individually; no bulk acceptance | `apps/web/app/api/contracts/[id]/extractions/route.ts`; extraction tests |
| Source citations | Available | Extracted values retain source text/page/confidence where available | extraction schema and contract workspace |
| Repository and search | Available | Organization-scoped listing and search; raw extracted text is not exposed by MCP list/detail tools | MCP tests and route selectors |
| Obligations | Available | Create, assign, remind, and complete obligations with audit activity | obligation routes and tests |
| Approvals | Available | Existing approval workflow remains available for review-gated changes | approval routes and e2e coverage |
| Optional AI extraction/Q&A | Available with explicit setup | Provider configuration is optional; AI output remains reviewable and attribution-aware | AI settings and review tests |
| MCP / Agent Gateway | Available with limits | Authenticated, role-checked, scope-checked reads/writes; metadata-only API-key reads by default; explicit `text_read` required for contract Q&A; minimized projections; no autonomous bulk mutations | `apps/web/app/api/mcp/route.ts`; MCP security matrix and regression tests |
| Audit activity | Available | Contract and obligation state changes write activity records | activity helper and route tests |
| Self-hosted Compose deployment | Available for configuration | Development and production Compose interpolation is CI-validated; runtime boot still needs a Docker-capable environment | `scripts/validate-self-hosting.sh`; self-hosting docs |
| Signing integration | Available, optional | DocuSeal integration is not required for core activation and needs external credentials | signing routes; deployment docs |
| Templates / authoring editor | Paused | Hidden from Phase 0 activation and marketing until a supported authoring workflow is verified | landing/onboarding scope |
| Autonomous agents / agent builder | Paused | No autonomous execution or invented performance claims in Phase 0 | landing scope; agent pages |
| Billing / hosted Cloud | Absent | No hosted availability, billing, or subscription promise | billing preview remains disabled |
| SSO/SAML/SCIM, SOC 2, Helm | Absent | Do not claim enterprise identity, certification, or Kubernetes packaging | truthful landing copy |

## Phase 0 rule

The supported path is: create a workspace, upload a real PDF or DOCX, review
individual extracted facts with citations, and create or complete an obligation.
Anything outside that path must be labeled optional or paused until it has a
separate evidence record and release decision.
