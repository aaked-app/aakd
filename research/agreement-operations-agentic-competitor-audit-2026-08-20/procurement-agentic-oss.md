# Procurement, agentic, open-source, and status-quo competitor audit

**Research date:** 2026-08-20  
**Track scope:** renewal/procurement/SaaS-spend platforms; agentic and niche entrants; relevant open-source projects; and non-product status-quo alternatives.  
**Decision informed:** whether supplier-renewal decision control and a longer event → action → evidence control layer are already served, readily absorbable by incumbents, or plausibly open; and what authority an agentic approach could safely hold.  
**Exclusions:** generic legal AI without a verifiable connection to the workflow; feature architecture; invented market size, prevalence, ROI, or customer outcomes; and product framing around any existing project.

## 1. Evidence and classification rules

Every material entry uses one of four labels:

- **FACT** — directly supported by the cited source.
- **VENDOR CLAIM** — an official vendor assertion that was not independently verified; customer stories remain vendor-attributed unless the customer independently corroborates them.
- **INFERENCE** — a bounded interpretation of cited facts or claims.
- **OPEN GAP** — evidence needed but not found or not publicly available.

Evidence priority is: official product, documentation, security, pricing, release, repository, filing, or customer sources for present capabilities; independent filings/reporting for funding and scale; official GitHub repository metadata and contents for open-source activity. A funding announcement, customer logo, integration-directory entry, AI label, empty/demo repository, or undated landing page does not by itself prove a live production deployment.

### Deterministic dual-axis taxonomy

The originally requested compound labels are retained as a crosswalk, but product reality and market maturity are audited independently so a vendor-hosted case cannot be mistaken for company scale.

| Axis | Label | Required evidence |
|---|---|---|
| Product reality | **OPERATING-PROVEN** | Current usable product plus at least one substantive named deployment/customer case. |
| Product reality | **OPERATING-CLAIMED** | Current product/access claim, but no substantive named deployment was verified. |
| Product reality | **PRODUCT-WAITLIST** | Product/beta or gated access path, with neither verified operating use nor sufficient evidence of general availability. |
| Product reality | **LANDING-PAGE** | Marketing claims without verified usable product or customer proof. |
| Product reality | **ACTIVE-OSS** | Substantive installable public repository plus a release or commit since 2025-08-20. |
| Product reality | **INACTIVE** | Current operating/product/activity evidence cannot be verified. |
| Product reality | **SUNSET** | Product discontinued. |
| Market maturity | **SCALED** | Public/audited financial evidence, independently corroborated installed base/customer count, public-company segment evidence, or an equivalent hard scale signal. |
| Market maturity | **GROWTH** | At least two substantive named deployments plus credible funding/growth evidence, without a hard SCALED signal. |
| Market maturity | **EARLY** | At least one substantive named deployment and current activity, without the GROWTH evidence bundle. |
| Market maturity | **UNKNOWN** | Public evidence does not support a maturity conclusion. |
| Corporate disposition | **INDEPENDENT** | Operates as an independent company. |
| Corporate disposition | **ACQUIRED-INTEGRATED** | Acquired and continuing as a product or integrated offering. |
| Corporate disposition | **ACQUIRED-SUNSET** | Acquired and the independent product is discontinued. |

**Requested-label crosswalk:** OPERATING-SCALED = OPERATING-PROVEN + SCALED; OPERATING-GROWTH = OPERATING-PROVEN + GROWTH; OPERATING-EARLY = OPERATING-PROVEN + EARLY; PRODUCT/WAITLIST = PRODUCT-WAITLIST; LANDING-PAGE-ONLY = LANDING-PAGE; ACTIVE-OSS = ACTIVE-OSS; INACTIVE/AMBIGUOUS = INACTIVE or unresolved OPERATING-CLAIMED + UNKNOWN; ACQUIRED/SUNSET is represented by the separate corporate-disposition axis. A dossier receives exactly one value on each applicable axis. Borderline cases are identified explicitly; no axis is upgraded unless every conjunctive requirement is evidenced.

## 2. Comparison model

### Workflow definitions

- **T1 supplier-renewal decision control:** before a supplier renewal or notice deadline, reconstruct the governing agreement family, reliable deadline and terms, accountable decision owner, renewal decision, required approval, and evidence that any notice/action was completed.
- **Longer event → action → evidence vision:** detect a contractual/business event; determine the governing context and authorized response; route or execute the bounded action; retain proof, approvals, and correction history.

### Directness scale

- **Direct:** owns or explicitly orchestrates the renewal decision, governing agreement context, action, and/or evidence chain.
- **Adjacent:** owns a material input or downstream action, but not the whole decision-control job.
- **Incumbent surface:** already owns the system of record, workflow, spend, procurement, or relationship context and could absorb the job.
- **Status quo:** the current manual/tool assemblage against which any change must win.

### Per-company dossier fields

Each named dossier records: directness; maturity and qualifying evidence; operating product; customer-proof quality; dated current activity; funding/stage evidence; public pricing or quote-only state; integrations, deployment, and security; agentic claims versus demonstrated authority; T1 overlap; longer-vision overlap; displacement/complement/absorption inference; limitations and open gaps.

## 3. Mandatory company register

| Company | Track | Product reality | Market maturity | Corporate disposition |
|---|---|---|---|---|
| Gatekeeper | Vendor/contract lifecycle and renewals | Not yet classified | Not yet classified | Not yet classified |
| Vertice | Procurement/SaaS spend and renewals | Not yet classified | Not yet classified | Not yet classified |
| Tropic | Procurement/SaaS spend | Not yet classified | Not yet classified | Not yet classified |
| Spendflo | SaaS procurement/management | Not yet classified | Not yet classified | Not yet classified |
| CloudEagle | SaaS management/procurement | Not yet classified | Not yet classified | Not yet classified |
| Levelpath | Procurement orchestration | Not yet classified | Not yet classified | Not yet classified |
| Zip | Procurement orchestration | Not yet classified | Not yet classified | Not yet classified |
| Coupa | Source-to-pay/spend management | Not yet classified | Not yet classified | Not yet classified |
| SAP Ariba | Source-to-pay/procurement | Not yet classified | Not yet classified | Not yet classified |
| Pactum | Autonomous commercial negotiation | Not yet classified | Not yet classified | Not yet classified |

## 4. Candidate admission and rejection rules

An emerging or niche company is admitted only if a current source shows material overlap with supplier renewal, procurement negotiation, contract event/action control, or evidence continuity. Search results that merely contain “AI,” “agent,” “contract,” or “procurement” are recorded as noise rather than treated as competitors. The audit deliberately seeks counterexamples in PRODUCT/WAITLIST, LANDING-PAGE-ONLY, INACTIVE/AMBIGUOUS, and ACQUIRED/SUNSET categories.

An open-source candidate is classified ACTIVE-OSS only after inspection of repository contents, installation documentation, releases or commits, and recency. Readme-only, template, abandoned, or non-installable demo repositories fail that category even if their descriptions match.

## 5. Status-quo categories to audit

1. Spreadsheet + calendar + task tooling.
2. Word + email + shared storage + e-signature.
3. Procurement/source-to-pay suites.
4. ERP systems.
5. CRM/revenue suites.
6. Outside counsel + manual operations.

## 6. Source ledger schema

The final ledger records source ID, company/category, URL, publisher, source type, publication/update date when disclosed, access date, fact supported, and limitation. URLs are retained directly so every label can be reconstructed.

## 7. Increment status

**FACT:** The audit contract, evidence labels, deterministic taxonomy, comparison unit, mandatory register, candidate rules, and status-quo scope are fixed in this increment.  
**OPEN GAP:** No company has been classified yet; source collection and individual rule application follow in later increments.
