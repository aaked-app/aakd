# OSS-First SaaS Research — Completeness Audit

**Audit date:** 2026-08-17  
**Purpose:** distinguish completed, evidence-backed deliverables from work that remains before a final build recommendation.

| Required deliverable / rule | Current evidence | Status | Required next evidence |
|---|---|---|---|
| Broad current industry universe | 450 row-level commercial tools across all 50 mapped categories, with official URLs | **Pass, working-universe scope** | Periodically refresh status and add regional/vertical coverage rather than claiming literal completeness |
| Every individual tool has official URL and status | All 450 CSV rows have `https` URLs and a current-commercial status field. Automated HTTPS pass reached 387/450; the remainder are WAF/TLS/404 inconclusive and one confirmed stale route was corrected. | **Partial for live-route verification; pass for URL coverage** | Directly recheck the 63 inconclusive routes/pricing signals before publication as a paid database |
| Category buyer, workflow, pricing model | CSV has buyer, core-use-case, and pricing-model fields; market map gives category buyers/workflows | **Pass for all 50 row-level categories** | Add regional/vertical fields and per-category evidence citations for a publishable catalogue |
| 40–50 category completeness: incumbents, buyer, workflow, pricing, pain, self-hosting value, paid layer for every category | Market map reaches 50 categories, but pain/self-hosting/paid-layer analysis is deep only for screened categories | **Partial** | Add a compact per-category screen for the remaining 40+ categories |
| OSS competitor audit: license, real product, deployment, workflow, maintenance, paid boundary | Hard-gate table plus fresh repository checks for Papermark, Documenso, DocuSeal, Comp AI, ERPNext, Odoo, Wraft, OpenContracts | **Partial / strong for named candidates** | Complete workflow and maintenance review for every competitor that could change a finalist verdict |
| Self-hosting verification of deep finalists | DocuSeal setup surface deployed in a disposable environment; no deep-finalist end-to-end workflow deployed | **Partial** | Exercise a protected VDR flow if VDR remains a finalist; resolve Comp AI deployment or retain it as failed |
| Repeated buyer-pain threshold | Compliance has review-volume and buyer-discussion evidence; CLM is directional; VDR explicitly fails threshold | **Partial** | Collect three like-for-like buyer complaints from two independent channels for each recommended wedge |
| Scored category table with nine raw subscores | Top-10 screen uses nine raw subscores, weighted totals, confidence, and verdicts | **Pass for shortlist** | Add score rationale/citation links at per-cell granularity if publishing externally |
| Top 3 recommendations | Two candidates satisfy all recommendation gates; no third is forced | **Honest no-pass for third** | Promote a third only when it reaches 75+, Medium/High confidence, all required raw scores ≥3, and no kill criterion |
| Three deep dives | Two recommended deep dives, plus a VDR conditional-validation deep dive and procurement conditional validation | **Partial** | Either validate VDR pain or replace it with a fully qualifying third candidate |
| False-positive appendix | Kill-gate appendix covers common clone theses and their failed rule | **Pass for screened categories** | Expand only if new categories reach shortlist review |

## Publication rule

The current materials are suitable for internal strategy and interview planning. They are **not** suitable for a public claim that every known industry tool or OSS alternative has been exhaustively verified. Any external version must retain the working-universe wording and publish access dates beside the claims it relies on.
