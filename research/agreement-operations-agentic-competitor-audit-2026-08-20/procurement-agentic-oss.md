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

**Claimed-agent capability maturity:** **PRODUCTION-PROVEN** requires a named operating deployment of the claimed agent; **LIMITED-EARLY-ACCESS** requires a dated live/beta access path without named production proof; **ANNOUNCED-COMING** is roadmap or launch-announcement evidence only; **CLAIM-ONLY** is an undifferentiated current marketing claim without qualifying deployment/access proof; **NONE-FOUND** means no material agent claim was found in the inspected evidence. This axis is independent of company/product maturity.

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
| Gatekeeper | Vendor/contract lifecycle and renewals | OPERATING-PROVEN | UNKNOWN | INDEPENDENT |
| Vertice | Procurement/SaaS spend and renewals | OPERATING-PROVEN | GROWTH | INDEPENDENT |
| Tropic | Procurement/SaaS spend | OPERATING-PROVEN | GROWTH | INDEPENDENT |
| Spendflo | SaaS procurement/management | OPERATING-PROVEN | GROWTH | INDEPENDENT |
| CloudEagle | SaaS management/procurement | OPERATING-PROVEN | EARLY | INDEPENDENT |
| Levelpath | Procurement orchestration | OPERATING-PROVEN | GROWTH | INDEPENDENT |
| Zip | Procurement orchestration | OPERATING-PROVEN | GROWTH | INDEPENDENT |
| Coupa | Source-to-pay/spend management | OPERATING-PROVEN | SCALED | ACQUIRED-INTEGRATED |
| SAP Ariba | Source-to-pay/procurement | OPERATING-PROVEN | SCALED | ACQUIRED-INTEGRATED |
| Pactum | Autonomous commercial negotiation | OPERATING-PROVEN | GROWTH | INDEPENDENT |

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
**FACT:** All ten mandatory companies are classified below; product, market, corporate, and agent maturity are kept separate.

## 8. Mandatory company audit matrix

All source IDs resolve in §13. “Quote” means no public numeric price was found in the inspected sources; it does not prove no public price exists.

| Company | Directness; qualifying status evidence; product/customer/current activity | Funding/stage; price; integration/deployment/security | Claimed agent maturity and actual authority | T1 and longer-chain overlap; strategic inference; limitation |
|---|---|---|---|---|
| **Gatekeeper** | **Direct. FACT:** OPERATING-PROVEN: current vendor/CLM platform and substantive cases for Redwood, Funding Circle, CompSource, Canstar, Mailchimp, and others [GK1–GK3]. **OPEN GAP:** no hard independent scale evidence located, so maturity UNKNOWN rather than SCALED. | **OPEN GAP:** funding/stage and numeric price; demo-led quote. **FACT:** cloud product; native NetSuite/customer integrations, MCP connection, SOC 1/2 Type 2 and ISO 27001 claims [GK2–GK4]. | **PRODUCTION-PROVEN (2026-07-18):** Redwood’s Contract Renewal Agent gathers context, produces a recommendation, and logs supporting data; people start the actual decision/negotiation. Other agents flag, validate, route, and chase. No proof found of autonomous legal notice or binding renewal [GK2–GK3]. | **FACT:** closest observed T1 match: contract/owner/performance context, notice guard, renewal brief, recommendation, workflow/audit record. **INFERENCE:** can absorb generic T1 and complements ERP/spend sources; a new layer must beat a configured Gatekeeper workflow on governing truth, cross-system completion proof, and correction propagation. |
| **Vertice** | **Direct. FACT:** OPERATING-PROVEN + GROWTH: live intake, contract center, purchasing and renewals; many named cases; TechCrunch independently reported hundreds of customers and a 13× three-year growth claim [VE1–VE3]. | **FACT:** $50m Series C in 2025, about $100m total; pricing is quote-led on its pricing page; integrations include NetSuite, Xero, QuickBooks, Ironclad and Jira; cloud deployment [VE2–VE4]. **OPEN GAP:** product-specific certification evidence was not captured. | **CLAIM-ONLY:** official 2026 material claims 60+ specialist agents and autonomous negotiation, but inspected evidence did not tie the agent itself to a named production episode [VE3]. Human procurement experts still lead negotiations [VE4]. | **FACT:** flags notice/renewal terms, usage, risk and pricing; supports retain/rightsize/terminate and negotiation. **INFERENCE:** strongly absorbs SaaS-renewal decision support and complements CLM/finance systems; broader cross-party action proof remains unverified. |
| **Tropic** | **Direct. FACT:** OPERATING-PROVEN + GROWTH: live procurement platform, well over 100 customers reported in 2022, current 2026 releases and named renewal examples [TR1–TR4]. | **FACT:** $40m Series B in 2022; public starting price $3,167/month based on employees; cloud service with Claude/ChatGPT MCP and Omnea partnership [TR1–TR4]. **OPEN GAP:** certification/deployment detail not captured. | **CLAIM-ONLY:** pricing advertises Renewal, Proposal and Intake agents; current releases show AI-generated review/benchmark/scripts and event-created tasks. No named case proved autonomous notice, commitment, or binding action [TR1–TR3]. | **FACT:** direct SaaS renewal priority, benchmark, stakeholder-survey and negotiation support. **INFERENCE:** generic T1 is already commercially packaged; cross-system evidence and governing-family correctness beyond uploaded contracts remain open. |
| **Spendflo** | **Direct. FACT:** OPERATING-PROVEN + GROWTH: renewal management, contract repository, escalation and usage/sentiment decisions, with named Puffco, Reveal Data, Acumatica and Ottimate evidence [SF1–SF3]. | **FACT:** $11m Series A (2023) and $15.4m total reported by an independent 2025 evaluator; quote/fixed-fee share of managed spend rather than a public numeric plan; Slack, Teams, Okta, NetSuite; SOC 2 Type II, SSO/SCIM/RBAC [SF3–SF5]. | **LIMITED-EARLY-ACCESS (2026-05):** Flo launched as an “autonomous procurement workforce” triggered by invoice, contract upload, or request; evidence proves launch/access, not a named production autonomous renewal. Human analysts/services remain part of delivery [SF2, SF4]. | **FACT:** centralizes contracts, renewal decisions, escalations, approval and negotiated outcome. **INFERENCE:** can absorb SaaS T1, but services content creates ambiguity over software autonomy and repeatability. |
| **CloudEagle** | **Direct. FACT:** OPERATING-PROVEN + EARLY: numerous named deployments; DataStax uses extracted metadata, 90-day renewal workflows, approval/escalation across Ironclad, Jira, OneTrust and Slack [CE1–CE4]. **OPEN GAP:** credible funding/growth evidence was not captured, so not GROWTH. | **FACT:** quote-led; cloud; 200+ integration claim, AWS Marketplace, SSO/finance/HRIS/Slack connections, and SOC/GDPR/ISO badges [CE3–CE5]. **OPEN GAP:** exact certification scope and stage. | **NONE-FOUND** for a separately evidenced renewal agent. **FACT:** automation extracts, alerts, routes and escalates; outsourced human procurement negotiates. This is workflow automation, not evidence of agent authority [CE2–CE5]. | **FACT:** nearly complete T1 workflow for SaaS, including notice data, owner/spend/usage context, approvals and visible status. **INFERENCE:** direct absorption threat; it complements existing CLM/risk tools rather than displacing them in the DataStax case. |
| **Levelpath** | **Direct/adjacent. FACT:** OPERATING-PROVEN + GROWTH: named GATX, SSM Health, Emerald, Acrisure and other deployments; current 2026 product activity; reported $55m Series B in 2025 [LP1–LP5]. | **FACT:** quote-led cloud platform; Ironclad connection and API capabilities, plus ERP/workflow integration claims [LP2–LP5]. **OPEN GAP:** public numeric pricing and product-specific security evidence not captured. | **PRODUCTION-PROVEN:** SSM Health reports a Contract Agent in a named deployment; other cases show AI bid analysis, contract analysis and risk scoring. Authority is customer logic, routing and analysis; no binding contract/notice authority proved [LP2–LP5]. | **FACT:** repository, intake/orchestration, renewal visibility and contract analysis overlap T1, though sourcing/new intake is stronger. **INFERENCE:** can host T1 and parts of longer evidence chain; cross-party completion and corrections remain gaps. |
| **Zip** | **Direct/incumbent surface. FACT:** OPERATING-PROVEN + GROWTH: live intake-to-pay and Contract Orchestration; extensive named deployments; $190m Series D and $2.2bn 2024 valuation [ZI1–ZI4]. No independent installed-base/financial signal meeting SCALED was captured. | **FACT:** quote-led cloud service; 60+/200+ integration claims depending product scope, ERP/CLM/Jira/Slack examples; RBAC, policy, approval and audit infrastructure [ZI3–ZI6]. | **PRODUCTION-PROVEN:** Cribl named use of AI agents; Superagents launched 2026. Official authority boundary is configurable: agents draft/flag/route and act across systems, while material contract changes, execution, supplier offboarding and high-value payment stay human-approved [ZI2–ZI6]. | **FACT:** Renewal Assist, contract repository, playbooks, routing, contract-to-spend compliance, approvals and audit trails substantially overlap T1 and the longer chain. **INFERENCE:** one of the strongest absorption threats; it explicitly positions as a connective layer over ERP/P2P/CLM. |
| **Coupa** | **Incumbent surface. FACT:** OPERATING-PROVEN + SCALED: live total-spend platform, 3,000+ claimed customers and 121 published stories; 2023 $8bn acquisition independently documented [CO1–CO4]. | **FACT:** private under Thoma Bravo; enterprise quote-led cloud deployment; broad marketplace including Ironclad connector; source-to-contract, P2P, risk and performance [CO1–CO4]. **OPEN GAP:** current contract-agent security/authority documentation not captured. | **NONE-FOUND:** inspected evidence supports AI extraction/intake and conventional workflow, not a qualifying named production agent [CO2–CO5]. | **FACT:** owns supplier/spend/PO/payment context and can connect a CLM; contract/renewal detail is not as explicit as Gatekeeper/Zip. **INFERENCE:** likely complement/absorb through workflow, data, marketplace or acquisition; displacement of core P2P is implausible for a wedge. |
| **SAP Ariba** | **Incumbent surface. FACT:** OPERATING-PROVEN + SCALED: current Ariba Contracts/S2P, multiple customer deployments, and SAP’s audited 2025 €36.8bn revenue hard-scale signal [SA1–SA5]. Ariba has been integrated into SAP since its acquisition. | **FACT:** price stated per-user/month without a public amount; cloud with SAP ERP/S/4HANA and inbound/outbound web services; SAP Trust Center/certification scope [SA2–SA6]. | **LIMITED-EARLY-ACCESS (2025-11 to 2026-05):** Joule/Contract Assistant is documented as generally available or deployable, with drafting, monitoring and renewal recommendations. No named production customer case for that agent was found; binding authority not evidenced [SA2–SA4]. | **FACT:** stores owners/dates/terms, monitors spend/compliance, connects sourcing/buying/supplier context, and recommends renewal strategy. **INFERENCE:** powerful absorption path inside SAP estates; external cross-system/counterparty proof may still require orchestration. |
| **Pactum** | **Direct for negotiation, adjacent for contract truth. FACT:** OPERATING-PROVEN + GROWTH: named Walmart, Honeywell, Suez and others; $54m Series C in 2025 and $100m+ total funding [PA1–PA4]. | **FACT:** enterprise quote-led cloud/integrated deployment; implementation includes system integration, agent training and supplier outreach. Enterprise security is claimed but certification specifics were not captured [PA1–PA4]. | **PRODUCTION-PROVEN:** named enterprise agents conduct supplier negotiations and may close deals autonomously. Authority is bounded by buyer-set strategy/parameters, with autonomous, advisory and watch/help modes and buyer approval available [PA2–PA4]. | **FACT:** strongest proof of external counterparty action, mainly negotiation/payment terms/tail spend—not agreement-family reconstruction, notice control, or end-to-end post-action correction. **INFERENCE:** complements a T1/control layer or absorbs its negotiation step, not the whole chain. |

## 9. Routed direct, emerging, inactive, and niche candidates

This set is deliberately narrow. It includes candidates routed from the parallel discovery stream before the stop-search checkpoint. `[H]` means the status fact came from that dated cross-track handoff; where an exact URL was not included, the ledger records that provenance gap rather than inventing one.

| Candidate | Deterministic status; evidence limit | Agent maturity / authority | Overlap and treatment |
|---|---|---|---|
| **Tonkean** | OPERATING-PROVEN / GROWTH / INDEPENDENT. The operating orchestration platform has named deployments; the routed 2026 evidence identifies a cross-system contract-renewal agent [H1]. **OPEN GAP:** qualifying case URL and hard scale signal were not supplied in the handoff. | CLAIM-ONLY for the renewal agent: it gathers cross-system context and orchestrates work, but no named production episode proving a renewal decision, notice, or completion was supplied [H1]. | **Direct T1/longer-chain challenger. INFERENCE:** if configuration in Tonkean closes governing truth → approval/action → proof, the standalone thesis fails. |
| **ServiceNow Contract Management Pro** | OPERATING-PROVEN / SCALED / INDEPENDENT. ServiceNow is a scaled public workflow incumbent; routed official 2026 evidence covers extraction, obligations, renewal reminders and agentic workflows [H2]. | LIMITED-EARLY-ACCESS: official product evidence, but no named production case for the new agentic workflow was supplied. Authority is workflow extraction/reminder/routing; binding notice/action remains unproved [H2]. | **Incumbent surface.** Strong absorption path through enterprise workflow, records and integrations; not evidence that full counterparty completion/correction chain exists. |
| **Atlas** | OPERATING-PROVEN / EARLY / INDEPENDENT. Routed evidence includes real public docs/API and a named Mercoa testimonial, barely satisfying operating proof [H3]. | CLAIM-ONLY; exact permissions, approvals and audit behavior were not supplied [H3]. | Potentially direct event/action integration; **OPEN GAP:** renewal-specific scope, agreement-family truth, and verified completion. |
| **SaySigned** | OPERATING-CLAIMED / UNKNOWN / INDEPENDENT. Public docs and pricing indicate an access path, but no substantive customer proof was found in the routed search [H4]. | CLAIM-ONLY; no operating agent episode or authority boundary verified [H4]. | Relevant signing/action endpoint, not a proven T1 controller. Downweight until a named deployment and evidence-chain behavior are shown. |
| **CovalentDocs** | PRODUCT-WAITLIST / UNKNOWN / INDEPENDENT. Landing/trial claims were found, but no substantive customer proof [H5]. | CLAIM-ONLY; no production authority evidence [H5]. | Potential document/workflow adjacency only. Do not count as an operating competitor or market proof. |
| **Contracko** | OPERATING-CLAIMED / UNKNOWN / INDEPENDENT. Routed as SOW/change-control adjacent; qualifying deployment proof was not supplied [H6]. | NONE-FOUND in supplied evidence. | T3-adjacent; insufficient evidence to infer recurrence, authority, or commercial traction. |
| **SiraDocs** | OPERATING-CLAIMED / UNKNOWN / INDEPENDENT. Routed as SOW/evidence adjacent; qualifying deployment proof was not supplied [H7]. | CLAIM-ONLY; authority boundary not supplied [H7]. | T3-adjacent; does not establish a production cross-party acceptance-to-billing chain. |
| **Datagrid** | OPERATING-CLAIMED / UNKNOWN / INDEPENDENT. Routed as agentic SOW/document-work adjacency; the handoff did not include qualifying customer proof [H8]. | CLAIM-ONLY; no verified external action or binding authority [H8]. | T3-adjacent. Relevant to automation pressure, not proof the residual is occupied. |

### Consolidation/sunset counterexample

**FACT:** Coupa and SAP Ariba demonstrate **ACQUIRED-INTEGRATED**, not sunset: acquisition removed independence but retained active product surfaces [CO3, SA5]. **OPEN GAP:** the stopped discovery set produced no confidently evidenced **ACQUIRED-SUNSET** direct player. This is an honest category gap, not permission to reclassify an acquired live product as sunset.

## 10. Open-source inspection

| Repository | Repository evidence | Classification | Relevance and limitation |
|---|---|---|---|
| **Draft Legal** | **FACT:** routed GitHub inspection found a substantive public code repository, installation material, 11 stars, two contributors, and a push after 2025-08-20 [OSS1]. | **ACTIVE-OSS / UNKNOWN / INDEPENDENT** (barely meets recency/code rule). | Contract drafting/review adjacency; repository activity proves code availability, not adoption, production reliability, renewal control, or an agent authority boundary. |
| **Documenso** | **FACT:** public repository and install documentation are known [OSS2]. **OPEN GAP:** under the stop-search constraint, a post-2025-08-20 release/commit was not captured in this track. | **INACTIVE** under the deterministic audit rule, not because the project is known to be abandoned but because qualifying recency was not recorded. | Open-source e-signature/action endpoint; adjacent to completion proof, not a renewal-decision controller. |
| **DocuSeal** | **FACT:** public repository and self-host installation documentation are known [OSS3]. **OPEN GAP:** a qualifying post-cutoff release/commit was not captured in this track. | **INACTIVE** under the deterministic audit rule for missing recency evidence. | Open-source e-signature/action endpoint; could complement a control layer, but does not prove governing truth or event-to-action orchestration. |

**Rule result:** one of three inspected candidates qualifies ACTIVE-OSS; two are deliberately not upgraded without cutoff-date evidence. No inspected OSS project proves customer adoption or the complete T1/longer chain.
