# Aakd Cloud ICP evidence report

**Date:** 2026-08-16
**Decision status:** No Cloud ICP selected yet.
**Purpose:** Compare plausible segments using public, first-person evidence. This is a desk-research artifact, not proof of willingness to pay.

## Method and limits

- Sources are public Reddit and Hacker News discussions plus Aakd's checked-in product documentation. No private data was collected and no platform restrictions were bypassed.
- A source is counted as a signal only when the author describes a workflow, incident, or tool use. Vendor replies and posts that may be seeded marketing are explicitly labelled.
- Public posts cannot establish buyer authority, budget, managed-Cloud preference, retention, or a repeatable acquisition channel. Those are open validation requirements.

## Product facts relevant to an ICP

The current repository documents: PDF/DOCX ingestion and OCR; cited AI Q&A; extraction of metadata, risk and obligations; renewals; approvals; redlining; signing; CRM links; notifications; API; MCP; self-hosting; and local Ollama support. See [README](../README.md).

**Important constraint:** the repository has self-hosting documentation, but not a documented, operated Aakd Cloud offering, pricing, SLA, managed onboarding, or customer evidence. Cloud conversion is therefore a business hypothesis, not a product fact.

## Raw public evidence ledger

| ID | Segment | First-person signal | Workflow / workaround | Consequence | Quality and caveat |
|---|---|---|---|---|---|
| E1 | Medium IT services / legal ops | A medium-sized IT-services company reported high CLM license cost, poor adoption, clunky legal review and slow support after 1.5 years. | Vendor CLM; considering SharePoint/PowerApps. | The firm considered rebuilding internally. | Firsthand author claim, but anonymous and single-company. Comments include vendors and speculative estimates. [Source](https://www.reddit.com/r/legaltech/comments/1nbm01z/build_vs_buy_for_clm_we_tried_vendor_thinking/) |
| E2 | Contract management practitioner | One organization uses separate internal systems for sales details, obligations, finance clauses, an XLS calendar and OneNote summaries. | Manual entry plus Excel and OneNote alongside internal systems. | Fragmented contract execution and reporting. | Firsthand workflow description; organization, buyer and spend unknown. [Source](https://www.reddit.com/r/ContractManagement/comments/1n5s564/cm_software_2025/) |
| E3 | Growing procurement team | A procurement lead reported supplier contracts expiring or auto-renewing without a flag, with manual follow-ups and weak visibility. | Spreadsheet, Power Automate, Airtable, or a bespoke system appear in the discussion. | Expired/outdated terms and operational risk. | Firsthand initial post, with corroborating comments; anonymity and vendor replies lower confidence. [Source](https://www.reddit.com/r/procurement/comments/1qknvxh/any_practical_contract_management_training/) |
| E4 | Small/rapidly expanding finance-purchasing team | A finance/purchasing practitioner had no live-contract database, was losing track, and had renewed unused services after missed cancellation notice. | Sporadically maintained Excel. | Direct avoidable spend. | Strong firsthand incident; one organization, UK-specific and budget unknown. [Source](https://www.reddit.com/r/smallbusinessuk/comments/1l07rv6/contract_management_system_for_sme/) |
| E5 | Maintenance-contract manager | A practitioner tracks about 700 low-value service/maintenance contracts in a spreadsheet because existing systems are asset-centric or too deep. | Spreadsheet plus finance and tender systems. | Scale and financial-risk assertion; daily-job mismatch with existing software. | Firsthand volume/workflow; vertical-specific and several replies are vendor recommendations. [Source](https://www.reddit.com/r/ContractManagement/comments/1ok6jbr/maintenance_contract_management/) |
| E6 | Early startup | A six-person edtech startup with about fifteen active customers called contracts scattered across emails, Notion, Docs and Slack; it said CLM felt too heavy. | Manual documents and collaboration tools; tested a lightweight tool. | Tracking risk, but not an established Cloud budget. | Firsthand author claim; it is direct counter-evidence against targeting very early startups with a broad CLM. [Source](https://www.reddit.com/r/projectmanagement/comments/1sb8nx1/how_your_contract_lifecycle_management_works/) |
| E7 | SME operations / vendor renewals | A consultant described an SME auto-renewing a vendor contract because the signer had left and notice language was buried; a commenter described progression from Excel to Microsoft Lists to a lightweight CLM. | Folders, calendars, Excel, Microsoft Lists. | Unwanted renewal. | Initial post is consultant-reported, not a buyer; reply may be vendor affiliated. Use as directional only. [Source](https://www.reddit.com/r/SaaS/comments/1q7187s/vendor_renewal_controls/) |
| E8 | Self-hosted microbusiness | A small website operator said missed end dates let customers continue without payment and asked for open-source, self-hosted contract visibility, reminders, customer history and API access. | Calendar had failed; wanted a simple dashboard. | Lost income. | Firsthand and specific; explicitly asks for self-hosted/open source, so it supports OSS adoption, not managed-Cloud demand. [Source](https://www.reddit.com/r/selfhosted/comments/1huyhwz/looking_for_a_really_simple_contract_lifecycle/) |
| E9 | Technical/legal AI privacy | A self-described CISO described slow, error-prone manual cleaning of sensitive legal documents before external AI; discussion includes demand for approved/private deployments. | Manual redaction, bans, private-cloud environments and local models. | Confidentiality and policy risk. | Strong topic signal, but the original poster may be market research and commenters disagree on the risk model. It does not prove a CLM purchase. [Source](https://www.reddit.com/r/legaltech/comments/1qtd1h8/how_are_legal_teams_handling_sensitive_data_when/) |
| E10 | Small law firm / sensitive review | A small-firm user sought a secure way to process 6,000 pages of sensitive material with AI. | Consumer AI evaluation, enterprise plans and proposed private Ollama. | Confidentiality concern. | Firsthand need but this is legal document review, not CLM; it suggests a different buyer and product category. [Source](https://www.reddit.com/r/legaltech/comments/1tuyuhp/best_ai_for_small_law_firm_to_review_sensitive/) |
| E11 | Agency | A marketing-agency owner missed a HubSpot renewal reminder and faced an unexpected annual commitment. | SaaS vendor renewal email. | About $12K annual cost was cited. | Firsthand incident; it validates renewal risk but not an agency-wide contract-operations use case. [Source](https://www.reddit.com/r/hubspot/comments/1ukoasy/stay_away_from_hubspot_contracts/) |
| E12 | Startup / CLM buyer context | A Hacker News commenter said a startup-focused CLM that could migrate an existing Ironclad user was attractive, while open contract standards resonated. | Existing Ironclad. | Indicates migration/price interest. | Anonymous, old, one comment; useful only as a lead, not quantitative demand. [Source](https://news.ycombinator.com/item?id=36043944) |
| E13 | Disconfirmation: incumbent coverage | ContractSafe publicly documents post-signature obligation records with source clauses, business owners, due dates/triggers, alerts, status, completion proof, AI-assisted extraction and reports. | ContractSafe product. | Shows the proposed action-ledger primitives are already commercially addressed. | Official vendor material, not customer evidence; strong for feature coverage but not adoption/quality. [Source](https://www.contractsafe.com/blog/contract-obligation-management) |
| E14 | Disconfirmation: MSP platform coverage | SuperOps publicly positions its PSA contract-management product as linking client contracts, service assignments and billing for IT service providers. | SuperOps PSA product. | Shows that a core MSP contract-to-delivery/billing workflow already has a specialist category. | Official vendor material, not customer evidence; strong for category coverage but not adoption/quality. [Source](https://superops.com/psa-software/contract-management) |
| E15 | Procurement workload / renewal operations | A procurement practitioner said they were expected to manage roughly 300 renewals; their three-person team completed 1,200 contracts in 2025. | Contract-renewal list; finance questions procurement about uncontrolled spend. | Capacity and accountability pressure. | Firsthand employment account, but company, exact scope, budget and current stack are unknown. [Source](https://www.reddit.com/r/procurement/comments/1snpnox/it_procurement_is_managing_300_renewals_510_new/) |
| E16 | Small-business renewal tracking | A small-team poster said a missed SaaS renewal cost about EUR3,000. | The post asks whether a renewal tracker is worth building. | Direct avoidable cost. | The initial post is product-validation framing; treat it as potentially promotional, not willingness-to-pay evidence. [Source](https://www.reddit.com/r/smallbusiness/comments/1nlxo2z/is_it_worth_building_a_tool_just_to_track/) |
| E17 | Existing CLM buyer / price pressure | A Hacker News commenter who identified as a current Ironclad user called it their “single-most expensive SaaS subscription” and asked about migration. | Existing Ironclad workflow and repository. | Price and switching interest. | Anonymous one-person comment from 2023; it indicates an actual incumbent user, not present demand for Aakd. [Source](https://news.ycombinator.com/item?id=36043944) |

### Source dates

| ID | Published or page-visible date |
|---|---|
| E1 | 2025 (page reports “1y ago”; exact date not exposed) |
| E2 | 2025 (page reports “1y ago”; exact date not exposed) |
| E3 | 2026-01-23 |
| E4 | 2025 (page reports “1y ago”; exact date not exposed) |
| E5 | 2025-10-30 |
| E6 | 2026-04-03 |
| E7 | 2026-01-08 |
| E8 | 2025-01-06 |
| E9 | 2026-02-01 |
| E10 | 2026-06-02 |
| E11 | 2026-07-01 |
| E12 | 2023-05 |
| E13 | 2026-05-14 |
| E14 | 2026 (page date not exposed) |
| E15 | 2026-04-17 |
| E16 | 2025 (page reports “11mo ago”; exact date not exposed) |
| E17 | 2023-05-23 |

### Verbatim excerpts and interpretation boundaries

These short excerpts preserve the source language used for the most decision-relevant evidence. They are not extrapolated into market-size, buyer, or pricing claims.

| Evidence | Exact public excerpt | What it supports—and what it does not |
|---|---|---|
| E1 | “License costs were high”; “Adoption has been a real challenge”; “AI features were quoted in the 7 figures (USD).” | A medium IT-services firm reports price, adoption and support friction with a vendor CLM. The post may be synthetic or marketing-adjacent and cannot prove prevalence. |
| E2 | “manual entry of all customer and vendor obligations”; “An XLS sheet for capturing the Contract Calendar”; “A wiki per contract using OneNote.” | A practitioner describes a fragmented post-signature workflow. Company profile and budget are unknown. |
| E3 | “supplier contracts had already expired without anyone flagging them”; “too much depends on manual follow-ups.” | A procurement lead reports renewal/obligation visibility failure. Its post asks about training, so it cannot establish purchase intent for software. |
| E4 | “no database of live contracts”; “pay/renew services that we no longer use”; “haven’t given our cancellation notice in time.” | A finance/purchasing practitioner reports a direct missed-notice consequence and an Excel workaround. It remains one anonymous small-company case. |
| E6 | “SOWs, NDAs and renewals are scattered”; “CLM tools seem too heavy for us”; “six people… fifteen active customers.” | Very small teams can have the problem yet reject a full CLM; this is direct counter-evidence to an early-startup Cloud ICP. The thread contains vendor-affiliated replies. |
| E9 | “manual ‘pre-cleaning’ step is slow, error-prone, and doesn’t scale.” | A claimed CISO describes a privacy workflow around AI. It does not establish CLM demand, nor a preference for Aakd Cloud over private/self-hosted systems. |
| E15 | “roughly 300 renewals”; “My team of 3 did 1200 contracts in 2025.” | Contract-renewal workload can be material. It does not prove the author lacks a suitable procurement suite or has buying authority. |
| E16 | “missed a SaaS contract renewal… cost us about €3,000.” | A concrete small-business consequence. Because the post asks for feedback on a tool, it is deliberately not treated as independent buying evidence. |
| E17 | “our single-most expensive SaaS subscription”; “Do you plan on offering migration services from Ironclad?” | An anonymous existing CLM customer expresses cost and migration interest. It is old, single-source and not evidence for current Aakd demand. |

## Evidence synthesis by segment

### 1. Commercial-stage B2B SaaS / AI companies with lean operations

**Facts from the ledger**

- The startup evidence is mixed. A six-person company with fifteen customers found a full CLM too heavy (E6), while E7 and E12 show renewal/migration problems but not verified Cloud buying.
- Separate systems, spreadsheets, and missing ownership appear in adjacent operations/procurement evidence (E2–E4).

**Hypothesis**

Commercial-stage B2B SaaS companies may be a viable Cloud ICP once customer/vendor agreements become cross-functional. The most credible job is not a broad CLM replacement: turn executed agreements into owned, cited renewal and obligation actions.

**Unknowns**

- Contract count, trigger, and buyer threshold.
- Whether the buyer is legal, RevOps, finance, procurement or COO.
- Whether SaaS companies would buy managed Cloud versus retain Drive, Microsoft 365, DocuSign, a CRM, or an existing CLM.

**Disconfirming evidence**

Very early teams perceive CLM as too heavy (E6); generic renewals/reminders are already available in lighter tools and Microsoft workflows.

### 2. Privacy-sensitive / regulated technical teams

**Facts from the ledger**

- Legal AI users express concern about unredacted sensitive material and mention private-cloud, local-model, or approved-vendor approaches (E9–E10).

**Hypothesis**

Data control and reviewable citations can differentiate Aakd for regulated teams.

**Unknowns**

- This evidence concerns legal-document AI, not contract operations or a Cloud CLM.
- The cloud-versus-self-hosting conflict: the strongest sovereignty preference may reduce Cloud conversion unless Cloud offers a credible isolated/private deployment model.
- Required controls, certifications, procurement pathway, and sales cycle.

**Disconfirming evidence**

Some practitioners prefer approved enterprise SaaS rather than self-hosting; others prefer local models. There is no evidence that a new CLM is the selected vehicle.

### 3. Agencies / consultancies

**Facts from the ledger**

- One agency owner missed a SaaS-vendor renewal (E11). This is insufficient to establish an agency-specific repeated workflow.

**Hypothesis**

Agencies or fractional operators might eventually need multi-client renewal and obligation management.

**Unknowns and disconfirmation**

No qualifying public evidence shows an agency paying for a multi-client contract-operations product. Do not create an ICP or build agency features from this hypothesis.

### 4. Self-hosted small businesses and technical operators

**Facts from the ledger**

- A small operator sought a self-hosted dashboard because a calendar could not provide ongoing visibility and missed end dates caused lost income (E8).
- Self-hosted discussions also ask for quotations, approvals and expiry tracking, but often compare point tools or build their own solutions.

**Hypothesis**

This is a credible OSS-adoption and contributor audience for an easy demo or starter kit.

**Disconfirming evidence**

The desire to self-host and avoid complexity is directly at odds with an assumed managed-Cloud purchase. Treat it as a distinct funnel, not the initial Cloud ICP.

### Additional hypothesis: lower-midmarket post-signature execution

**Facts from the ledger**

- E2–E5 repeatedly show signed-contract data spread across spreadsheets and specialist systems, especially when the work is renewal, obligations, finance terms, and accountability rather than drafting.
- Current Aakd functionality already covers extraction, citations, obligations, renewals, API/webhooks, and collaboration. It is therefore possible to test a narrow workflow without first adding a broad CLM surface.

**Hypothesis**

For small and lower-midmarket services, IT-services, or procurement teams, the narrow outcome could be: ingest executed agreements and produce a human-reviewed action ledger with owners, notice windows, citations, and destination-system tasks.

**Unknowns**

Who pays, whether their exports can be ingested, whether existing CLMs/consultants already meet this need, and whether this becomes a repeat cycle.

**New disconfirming evidence**

ContractSafe publicly describes source-linked obligation records, owner assignment, due dates/triggers, alerts, completion proof, AI-assisted extraction and reports (E13). Aakd cannot assume that a generic “cited action ledger” is unserved. The real-world test must prove a specific incumbent failure, an integration/distribution advantage, or a workflow outcome that the customer cannot obtain from an existing tool.

For managed-service providers, SuperOps publicly claims the more specific contract-to-service-assignment-and-billing link (E14). MSPs therefore are not an assumed target segment: they qualify only if an account identifies a post-signature contract-intelligence gap its PSA cannot cover.

## Segment comparison

| Segment | Repeated public pain | OSS reach | Cloud reason evidenced | Product fit today | Decision |
|---|---:|---:|---:|---:|---|
| Commercial B2B SaaS / AI | Weak to moderate | Moderate | No | Partial | Keep as a research hypothesis; not selected. |
| Regulated technical/legal AI | Moderate for confidentiality | Moderate | No; self-hosting may be preferred | Partial | Do not pursue first without Cloud deployment proof. |
| Agencies / consultancies | Insufficient | Unknown | No | Partial | Park. |
| Self-hosted small operators | Moderate | Strong | No; counter-evidence | Strong for basic job | OSS/community segment, not Cloud ICP. |
| Lower-midmarket post-signature execution | Moderate | Moderate | No | Testable fit, but incumbent-covered | Admit only to differentiated-failure validation, not ICP selection. |

## Role and job map

“Unknown” is deliberate: the public evidence does not establish a role merely because a role seems commercially plausible.

| Segment | User | Buyer / economic customer | Installer | Core job, trigger and workaround | Why current tools fall short | Aakd / Cloud fit and gap | Distribution signal |
|---|---|---|---|---|---|---|---|
| Commercial B2B SaaS / AI | Legal, finance, RevOps or operations user — unknown by company | Unknown; COO/Head of Legal/RevOps is an untested hypothesis | Technical ops or IT — unknown | Keep customer/vendor agreements, notice dates and obligations from falling through email, docs, Slack and spreadsheets; trigger is deal/renewal complexity. | E6 says broad CLM is too heavy at six people; E7 suggests spreadsheet/Microsoft workflows can work before teams outgrow them. | Aakd can test cited action extraction and tasks. Cloud reason, implementation tolerance and required integrations are unknown. | OSS developer/technical-champion story is plausible but not proven for this buyer. |
| Privacy-sensitive / regulated technical | Legal AI user, security reviewer or firm operator — mixed evidence | Unknown; security/legal approval is evidenced, budget holder is not | Internal IT/security or managed provider | Process sensitive documents with an approved data boundary; trigger is client or policy restriction. | Consumer AI and manual redaction are viewed as risky or slow by some participants. | Aakd's local AI/citations are relevant; a managed Cloud product would need an evidenced isolation, retention and compliance model that does not yet exist. | Legal-tech and self-hosted communities show interest, but they are not a proven Cloud channel. |
| Agencies / consultancies | Agency owner or finance operator — unverified | Unknown | Unknown | Hypothesized multi-client renewals and obligations. | No qualifying evidence of a repeated agency-specific failure or unmet tool requirement. | Do not build multi-client/white-label features from the current evidence. | No credible channel evidence. |
| Self-hosted small operators | Founder/operator | Same individual, typically price-sensitive | Same individual | Keep simple customer agreements and end dates visible; trigger is lost revenue from missed expiry. | Calendar is too easy to lose among other events; CRM is perceived as overkill. | Aakd's basic workflow fits, but explicit self-hosted preference is counter-evidence for Cloud conversion. | r/selfhosted and GitHub can support OSS discovery and contribution. |
| Lower-midmarket post-signature execution | Procurement, finance or operations action owner | Unknown; likely same function or COO, unvalidated | Existing systems owner / IT | Turn signed agreements into owned, cited actions, notice windows and evidence; trigger is a missed renewal, expired contract or untracked obligation. | Spreadsheets and separate specialist systems create manual entry, ownership gaps and fragmented execution. ContractSafe covers comparable general primitives (E13); MSP PSAs cover contract-to-service/billing workflows (E14). | Aakd needs a proven non-replacement difference—e.g. agreement-family precedence, cited evidence-completion, or deployment requirement—before Cloud claims. | Start with non-MSP service/IT/procurement organizations and implementation partners after approval; do not use bulk outreach. |

## Evidence-grounded synthetic panels

These panels are research tools only. They do not represent customers or demand.

### Panel A — procurement/operations action owner

**Evidence packet:** E2, E3, E4, E5.
**Grounded objections:** “Do not make me re-enter metadata”; “show who owns the next action”; “a reminder without a workflow does not complete the job”; “we already have finance/procurement systems.”
**Speculation to test:** Would pay for a reviewable action ledger that pushes tasks to existing systems rather than replacing them.

### Panel B — privacy-sensitive legal/technical sponsor

**Evidence packet:** E9, E10.
**Grounded objections:** “What happens to unredacted documents?”; “which data boundary and retention terms apply?”; “citations and human review are mandatory.”
**Speculation to test:** A managed, isolated deployment can overcome the preference for local/private AI.

### Panel C — self-hosted microbusiness operator

**Evidence packet:** E8.
**Grounded objections:** “A CRM is overkill”; “the calendar was not enough”; “I need reminders, current status, customer history and later API automation.”
**Speculation to test:** This persona would adopt a one-command demo and become a community advocate. It should not be assumed to buy Cloud.

No agency panel is created: the evidence packet is too weak.

## Decision gates

No segment may become Aakd's Cloud ICP until it meets all gates below. These are proposed validation thresholds, not market facts.

1. Five independent organizations describe the same recent post-signature episode, with a visible workaround and consequence.
2. Two economic owners confirm a budget path or pay for a narrow fixed-scope pilot.
3. Three comparable paid workarounds or existing purchases are verified.
4. The proposed outcome is not natively covered by the customers' existing CLM, Microsoft stack, ContractSafe, or two additional credible focused alternatives.
5. A redacted 25-contract corpus produces a useful, human-reviewed action ledger within one business day.
6. Two organizations prepay the same pilot and two repeat the workflow in a second cycle.
7. The delivery process is repeatable within two founder-hours per 25 contracts after correction.
8. A named, reachable channel yields ten qualified prospects without bulk spam or paid lead lists.

## Prioritized real-world validation plan

### Test 1 — fixed-scope Contract Action Diagnostic

**Offer hypothesis:** A lower-midmarket team with a named incumbent or Microsoft-stack failure will pay to turn 25 executed customer/vendor contracts into a cited, human-reviewed action ledger: obligations, notice windows, owner gaps, and an exportable action list. The test must ask why the existing tool cannot do this.

**Target:** operations/procurement/finance leaders at small and lower-midmarket **non-MSP** B2B service businesses that already have contracts in Drive, SharePoint or an existing CLM. MSPs are excluded unless they identify a named gap their PSA cannot solve.

**Success metric:** two prepaid pilots using the same scope; 80%+ of the initial action items are judged useful enough to assign or correct; both teams request a second cycle.

**Invalidation:** Prospects only ask for a generic repository, confirm ContractSafe/their current CLM already performs the job, refuse to provide a redacted corpus, or will not prepay a diagnostic.

**Execution protocol:** use the fixed eligibility screen, interview guide, evidence record and stop conditions in [aakd-contract-action-diagnostic-protocol.md](aakd-contract-action-diagnostic-protocol.md). It intentionally rejects generic feature interest and records Cloud preference separately from workflow value.

### Test 2 — managed Cloud preference

**Offer hypothesis:** Teams with the above job prefer managed operations over self-hosting when the offer includes setup, updates, backups, support, and a clear data boundary.

**Method:** Present the same action-ledger outcome with two explicitly described modes: self-hosted community edition and future managed Cloud. Record the reason for each choice.

**Success metric:** at least two qualified teams prefer and can explain a paid managed option.
**Invalidation:** qualified teams consistently select self-hosting or reject both options.

**Landing-page test:** [aakd-contract-action-diagnostic-landing-test.md](aakd-contract-action-diagnostic-landing-test.md) defines truthful copy, qualification questions, a fair self-hosted-versus-managed comparison, consent-safe measurement and explicit failure conditions. No Cloud availability claim may be published before it is true.

### Test 3 — OSS distribution proof

**Offer hypothesis:** developers and technical operators will run and share a narrowly scoped demo: upload a synthetic executed agreement and receive cited actions, owners, and deadlines.

**Method:** publish a truthful one-command local demo, public synthetic corpus, expected outputs and a connector/error contribution path. Do not promise unsupported Cloud, SSO, compliance, or customer adoption.

**Success metric:** installs that reach first action acknowledgement, plus at least three substantive workflow, connector, extraction, or documentation contributions—not stars alone.

## OSS-to-Cloud model

1. **OSS discovery:** a developer or technical operator runs a trustworthy demo and verifies cited action extraction on safe data.
2. **Champion formation:** the adopter brings the workflow to an operations/procurement/finance owner with real executed agreements.
3. **Cloud evaluation:** only after the job is validated, present managed setup, upgrades, backups, support, observability and a documented data boundary as a convenience/reliability product.
4. **Commercial conversion:** sell managed outcomes and operational assurance, not artificial feature withholding. Keep the open-source core viable for self-hosting.

**Current proof gap:** no public evidence in this report shows that Aakd Cloud exists or that a target buyer would pay for it. The first two real-world tests are therefore mandatory before a Cloud ICP is selected.

## Named non-MSP validation-account hypotheses

These are **research targets, not leads**; no outreach has been sent. The facts below demonstrate a public delivery or contracting surface, not contract-management pain, buying intent, budget, or Cloud preference. They are the primary account-research cohort because they avoid assuming that an MSP's PSA leaves a meaningful gap.

| Priority | Account | Verified public context | Likely role to verify | Why it is worth testing | Mandatory disqualifier / unknown |
|---:|---|---|---|---|---|
| 1 | Gattaca Projects (UK) | Public LinkedIn describes statement-of-work delivery by specialist technology and engineering teams, across defence, energy and transport, and notes JOSCAR registration. [Company page](https://uk.linkedin.com/company/gattaca-projects) | Commercial director, operations director or project-delivery leader. | Explicit SOW delivery in regulated sectors is a concrete surface for testing ownership, deliverables and change-control workflow. | SOW volume, current repository/owners, group-standard tooling, security constraints and Cloud preference are unknown. |
| 2 | Rullion (UK) | Rullion publicly describes contractor screening, compliance, supplier management and reporting; its SOW offer engages talent against defined deliverables for complex infrastructure programmes. [Service page](https://www.rullion.co.uk/our-solutions/temporary-recruitment/) | COO, operations director, commercial operations or compliance operations. | Its actual SOW and contingent-workforce model makes contractual/compliance handoffs observable rather than inferred. | ATS/back-office coverage may already solve this; contract owner, expiry workflow, pain and buyer are unknown. |
| 3 | OFR Consultants (UK) | Public LinkedIn reports 100+ staff, seven UK offices and regulated fire/risk consultancy. A dated case study says OFR adopted Synergy as a cloud practice-management platform for project accounting, CRM, budgets and project progress. [Company page](https://uk.linkedin.com/company/ofr-consultants) · [case study](https://totalsynergy.com/sam-liptrott-olsson-fire-risk-london/) | COO, operations director or commercial manager. | Multi-office regulated engagements with staged delivery make obligations, approvals and deadline ownership worth testing. | **Counter-signal:** a current or successor Synergy setup may already solve the workflow. Verify stack freshness and a contract-specific gap before considering any invitation. |
| 4 | Xcede (UK) | Xcede publicly describes contract talent services. A May 2026 compliance statement describes Legal, Finance and Operations support with audit actions tracked through resolution. [Statement](https://www.xcede.com/blog/strengthening-supply-chain-compliance) | Compliance operations or legal/finance/operations workflow owner. | The cross-functional, tracked-action control model makes it a useful incumbent-coverage test. | **Counter-signal:** the existing control stack may already solve the relevant workflow; contract source-linkage, stack, buyer and Cloud fit remain unknown. |
| 5 | Gate One (UK) | Public LinkedIn describes transformation design and delivery, including programme/portfolio management and regulatory change. [Company page](https://uk.linkedin.com/company/gate-one) | COO, delivery-operations leader or commercial director. | Scope and client-delivery coordination is observable; whether it translates to a contract problem must be tested. | Engagement model, SOW/change-control volume, PMO coverage, CLM coverage, buyer and Cloud policy are unknown. |

**How to use this cohort:** verify one public operational role and the present contract/PM/CLM stack before considering an individual diagnostic invitation. Disqualify any account where its existing stack already produces the cited action workflow or whose security posture rules out a managed Cloud offering.

### Public account-stack check

- **OFR is downgraded.** An older vendor case study documents a cloud practice-management system that already handles project accounting, CRM, budgets, time and project-progress visibility. This is not proof of contract management, but it is enough to prevent treating OFR as an untooled account.
- **Rullion remains testable, not qualified.** Its own service page confirms SOW delivery and contractor compliance/supplier-management operations. It does not reveal the contract-system owner or a failure in the existing stack.
- **Xcede is a counterexample test, not a presumed lead.** Its public governance statement says actions are tracked through resolution with Legal, Finance and Operations support. It should be contacted only to learn whether contract-originated commitments remain a gap.
- **No public tool-stack evidence was located for Gattaca, Xcede or Gate One in this pass.** This is an unknown, not evidence that they have a problem.

## Secondary MSP validation-account hypotheses

These accounts are **not leads yet** and no outreach has been sent. Public material establishes a managed-service or recurring-service footprint, not the target pain, budget, or Cloud preference. Because MSP PSA platforms already cover contract-to-service/billing workflows (E14), this batch is now **secondary**: use it only to discover a named incumbent failure, not as a default outbound list.

| Priority | Account | Verified public context | Likely role to verify | Why it is worth testing | Mandatory disqualifier / unknown |
|---:|---|---|---|---|---|
| 1 | Maintel (UK) | 201–500 employees on public LinkedIn; 2025 results state about £50m total contract value in new business; managed communications services. [Results](https://www.investegate.co.uk/announcement/rns/maintel-holdings--mai/2025-annual-results/9642192) | Commercial operations, service delivery, finance operations or legal/commercial—not CEO by default. | New managed-service business makes contract handoff, renewal and SLA ownership a falsifiable hypothesis. | Existing CLM/process, actual pain, Cloud preference, and buyer authority are unknown. |
| 2 | Transputec (UK) | Company says 120+ specialists, fixed-fee SLA-backed services, quarterly business reviews and recent managed-service migrations. [Site](https://www.transputec.com/) | COO, service-delivery director or finance operations. | Repeated service engagements make post-signature obligations a concrete workflow to test. | Portfolio scale, source of truth, owner and willingness to pay unknown. |
| 3 | razorblue (UK) | Official careers page says 170+ employees, 500 UK clients, seven offices, 35% YoY growth and 24/7 managed IT. [Source](https://careers.razorblue.com/jobs/7643659-account-manager) | Operations or service-delivery leader. | Growth plus a large client base may expose agreement, renewal and service-commitment coordination. | Client count is not proof of contract count or pain; current tools unknown. |
| 4 | Wanstor (UK) | Public policies refer to client-premises work under MSP agreements, third-party suppliers and contracted service charges. [Terms](https://www.wanstor.com/terms-and-conditions/) | COO, commercial operations or service delivery. | Client agreements plus subcontracting show a potentially complex handoff environment. | Contract workflow, cloud policy, buyer and pain are unknown. |
| 5 | Infinity Group (UK) | Managed IT, Dynamics/ERP and AI services for hundreds of UK businesses; publishes an MSA. [Site](https://www.infinitygroup.co.uk/) | COO, commercial director or finance operations. | Multiple service lines make agreement obligations, renewals and delivery handoffs testable. | Operational source of truth, service volume and Cloud appetite unknown. |

**Next research action, not outreach:** find a non-MSP service/procurement cohort, then verify a single relevant operational role and the company’s current contract/PSA/CRM stack using public sources. Only then decide whether a one-to-one diagnostic invitation is appropriate. Do not mass message or infer a buyer from company size.

## Decision-gate audit as of 2026-08-16

| Required gate | Current evidence | Status | What would prove it |
|---|---|---|---|
| Repeated first-person pain across independent organizations | E1–E6, E15 show recurring renewal/obligation and fragmentation signals, but they span different company types and tools. Some are potentially promotional. | **Partial; not passed** | Five independent, comparable non-MSP organizations describing the same post-signature workflow, workaround and consequence. |
| Concrete workaround and visible cost/risk | Spreadsheets, OneNote, manual entry, Microsoft tooling, existing CLM and direct missed-renewal costs appear in E1–E7 and E15–E16. | **Partial; not segment-specific** | Match the workaround and consequence to the same target cohort. |
| Recognizable buyer and budget path | E17 identifies an existing CLM user and price concern; none establish authority, budget ownership or a repeatable role. | **Not passed** | Two economic owners confirm authority or pay for the same pilot. |
| Reason to choose Aakd over existing tools | E1 shows dissatisfaction, while E13, E14 and Microsoft alternatives show credible coverage. | **Not passed** | A named incumbent failure that Aakd demonstrably resolves without a major unproven build. |
| Reason to choose Cloud over self-hosting | E8 and privacy evidence explicitly preserve or prefer self-hosting/local/private routes. | **Not passed** | Two qualified teams choose a managed option over a truthful self-hosted option and explain why. |
| Product fit without major unproven build | Current README supports the proposed diagnostic inputs/outputs at a feature level. Integration, repeatable onboarding, managed operations and a Cloud security model are unproven. | **Partial; not passed** | Two redacted 25-contract diagnostic runs completed inside one business day with useful human-reviewed output. |
| No strong disconfirming evidence | E6, E8, E13, E14 and Microsoft coverage are material counter-evidence. | **Not passed** | A narrow use case that survives an explicit comparison with the account's actual incumbent stack. |

## Current conclusion

**No Aakd Cloud ICP is selected.** Lower-midmarket post-signature execution has the strongest repeated pain and current product fit, but is also explicitly covered by at least one credible incumbent. It is admitted only to a differentiated-failure experiment and has not passed the buyer, Cloud-preference, willingness-to-pay, or competitive-difference gates.
