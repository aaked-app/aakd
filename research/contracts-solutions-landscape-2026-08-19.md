# Contract-solutions landscape: small business to enterprise

**Research date:** 2026-08-19  
**Geographic lens:** products available to US and UK organizations; prices use the vendor-selected US page/currency unless stated otherwise. A UK page is cited where it materially changes the claim.  
**Scope:** status-quo methods, e-signature and document automation, dedicated contract lifecycle management (CLM), contract intelligence, and suite-native sales/procurement contract modules.  
**Exclusions:** legal advice, a procurement recommendation, private negotiated prices, and estimates derived from review sites or “starting at” statements.

## How to read this report

Claims are deliberately typed:

- **FACT** — directly observable product, price, documentation, or research-method fact.
- **VENDOR CLAIM** — capability, outcome, security, scale, or implementation statement made by the supplier and not independently tested here.
- **INFERENCE** — analytical conclusion from cited facts; it is not represented as a vendor statement.
- **OPEN GAP** — material information not found in public evidence.

“Public price” means an exact amount, currency, billing unit and billing period was visible on a first-party page on the access date. “Quote-only” means the official page explicitly routes the buyer to sales or omits an amount. No opaque quote is normalized into an annual or per-user figure. Taxes, onboarding, AI credits, storage, signature envelopes and overages are listed only when the source discloses them.

## Executive synthesis

1. **There are five competing object models, not one category.** **INFERENCE:** Word/Docs and e-signature products make the *document or signing envelope* primary; light CLMs make the *contract record plus dates* primary; workflow-first CLMs make the *request-to-signature process* primary; suite modules make a *deal, supplier, order or spend record* primary; the most ambitious enterprise platforms model *agreement families, obligations and operational performance*. This distinction predicts what happens after signature more reliably than an “end-to-end” label.
2. **Small-team products expose prices; enterprise platforms expose architectures.** **FACT:** exact public US pricing was found for Docusign eSignature, PandaDoc, Contractbook, Concord, and Salesforce Revenue Cloud; Oneflow's current official pricing page names Business and Enterprise but currently asks for a demo rather than displaying an amount. Dedicated enterprise CLMs in this sample—Ironclad, Icertis, Sirion, Docusign CLM, Workday/Evisort, Coupa and SAP Ariba—are quote-only or do not publish the amount. [Docusign pricing](https://ecom.docusign.com/plans-and-pricing/esignature), [PandaDoc pricing](https://www.pandadoc.com/pricing/), [Contractbook pricing](https://contractbook.com/pricing), [Concord pricing](https://www.concord.app/pricing/), [Salesforce pricing](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-optimization-pricing/), [Oneflow pricing](https://oneflow.com/pricing/)
3. **Post-signature depth is the main fault line.** **INFERENCE:** reminders and renewal dates are common; assigning, evidencing and reconciling obligations against invoices, orders, service delivery or supplier performance is not. Icertis explicitly describes matching transactional documents to governing terms; Coupa connects terms to purchasing and invoice validation; Salesforce makes the sales contract part of quote-to-cash. [Icertis contract performance](https://www.icertis.com/products/platform/contract-performance/), [Coupa CLM datasheet](https://get.coupa.com/rs/950-OLU-185/images/Coupa-CLM_Datasheet.pdf), [Salesforce Revenue Cloud](https://www.salesforce.com/products/cpq/overview/subscription-management/)
4. **AI availability is ahead of AI evidence disclosure.** **FACT:** extraction, summary, Q&A and playbook review are widely advertised. Publicly explicit evidence trails are rarer: LinkSquares says its new platform provides citation-backed insights and transparency; Ironclad documents human-review flags in AI Playbooks; SpotDraft converts extracted obligations into human-trackable tasks. For most products, field-level provenance, page/quote citation, calibrated confidence and reviewer disposition were not all publicly evidenced. [LinkSquares launch](https://blog.linksquares.com/launches-first-agentic-clm-platform), [Ironclad AI Playbooks](https://support.ironcladapp.com/hc/en-us/articles/12275685560215-Ironclad-AI-Playbooks-Overview), [SpotDraft obligations](https://help.spotdraft.com/articles/9044692601-managing-contract-obligations-beta)
5. **Implementation is process design plus data migration, not merely software setup.** **FACT:** WorldCC's 2025 benchmark says organizations often pursue tools without consistent process or clear accountability; vendors themselves describe workflow configuration, template setup, integration, migration and training as implementation work. [WorldCC Benchmark 2025](https://www.worldcc.com/Portals/IACCM/Reports/Benchmark-Report-2025.pdf), [SpotDraft pricing/implementation](https://www.spotdraft.com/pricing), [LinkSquares services](https://linksquares.com/services/), [Ironclad pricing/deployment](https://ironcladapp.com/pricing)
6. **The status quo remains a real competitor.** **INFERENCE:** Word/Docs plus shared storage can be sufficient when agreement volume, variation and post-signature coordination are low. It fails gradually—ownership, renewal tracking, prevailing terms, and operational handoff become separate human-maintained systems—rather than because the document editor cannot draft or redline.

## The solution stack and the contract object

| Approach | Primary object | What it does well | Structural blind spot |
|---|---|---|---|
| Word/Google Docs + email | Editable file and conversation | Drafting, redlines, comments, universal counterparty access | Request state, approvals, metadata, final-version certainty, obligations and renewal ownership live elsewhere |
| SharePoint/Drive/shared folders | File plus folder permissions/version history | Repository, access control, coauthoring, restore | A folder is not an agreement family; dates and obligations are not inherently executable records |
| Spreadsheet + calendar/task tool | Row, date and assignee | Low-cost register and reminders | Manual synchronization; weak clause/search context; amendments and hierarchies are fragile |
| E-signature | Envelope/transaction | Identity, consent, execution evidence, reminders | Typically starts near signature and treats post-signature work as storage/reporting rather than performance |
| Proposal/quote/document automation | Sales document or deal | Fast generation, branded proposals, CPQ/CRM handoff, signing | Buy-side and complex legal governance may be secondary; operational commitments are often dates/notifications |
| Dedicated CLM | Contract record plus governed workflow | Intake, templates, negotiation, approvals, signature, repository, reporting | Value depends on configuration, adoption, metadata quality and integration; post-signature depth varies widely |
| Contract intelligence | Corpus plus extracted terms/relationships | Legacy ingestion, semantic search, portfolio risk and diligence | May analyze more deeply than it operationalizes; provenance and review evidence are inconsistent publicly |
| CRM/revenue suite | Account/opportunity/quote/order/contract | Sell-side quote-to-cash continuity | Non-sales agreements and enterprise legal portfolio can be a secondary model |
| Procurement/S2P suite | Supplier, sourcing event, catalog/item and spend transaction | Buy-side compliance; terms connected to requisitions, POs and invoices | Sell-side contracts and legal-team authoring may require another module or partner CLM |
| ERP/task systems | Transaction, asset, project, ticket or ledger event | Execution, accounting and operational ownership | The governing language, negotiated context and prevailing-document logic are usually external |

## Status-quo competitors: when they are enough and where they break

### 1. Word or Google Docs + email

**FACT:** Word supports Track Changes, reviewer attribution, accept/reject and locked tracking. When stored in OneDrive or SharePoint, it supports coauthoring and server-side version history. Google Docs/Drive supports viewer/commenter/editor permissions, version history and file approvals. [Microsoft Track Changes](https://support.microsoft.com/en-us/word/training/track-changes-in-word), [Microsoft versioning](https://support.microsoft.com/en-US/Word/use-versioning-with-word), [Google Drive sharing](https://support.google.com/drive/answer/2494822?hl=en), [Google Drive approvals](https://support.google.com/drive/answer/9387535?hl=en_fm)

**Sufficient when — INFERENCE:** a founder, office manager or small legal team processes a low volume of familiar agreements; one person can remember status; counterparty Word compatibility matters; and renewals/obligations are rare or immaterial.

**Where it fails — INFERENCE:** email branches create competing copies; an approval in a message is not reliably joined to the final executed version; no native agreement-family model connects MSA, SOWs, DPAs and amendments; and post-signature commitments must be re-keyed.

### 2. Shared drives, SharePoint and Google Drive

**FACT:** file platforms can provide inherited permissions, coauthoring, version history and restoration. SharePoint versions can be created on upload, property change, save and coauthoring events. [Google Drive sharing](https://support.google.com/drive/answer/2494822?hl=en), [SharePoint versioning](https://support.microsoft.com/en-us/sharepoint/lists/documents-and-library/how-versioning-works-in-lists-and-libraries)

**Sufficient when — INFERENCE:** the problem is discoverability and controlled access rather than workflow, and the organization can enforce a naming/folder taxonomy.

**Where it fails — INFERENCE:** access inheritance is not contract authorization, “latest file” is not necessarily “prevailing legal terms,” and folders do not produce obligation evidence, renewal decisions or spend/revenue reconciliation.

### 3. Spreadsheets, calendars and task systems

**FACT:** these tools are general records and reminders, not contract-aware products. **INFERENCE:** they are often the first operational layer added to a shared drive: one row per contract, manually keyed dates and calendar reminders.

**Sufficient when — INFERENCE:** portfolio size is small, fields are stable, one owner performs quality control, and missing one reminder is low consequence.

**Where it fails — INFERENCE:** the register drifts from executed text; amendments overwrite or duplicate rows; clause context is lost; and the reminder proves a notification, not that an obligation was fulfilled.

### 4. E-signature as the whole “contract system”

**FACT:** Docusign eSignature Personal is US$11/month on an annual commitment with five envelopes/month; Standard is US$30/user/month and Business Pro US$45/user/month, both with 100 envelopes/user/year, before additional tax. It provides templates, signing workflow and audit trails; it is not the same offer as quote-only Docusign CLM. [Docusign eSignature pricing](https://ecom.docusign.com/plans-and-pricing/esignature), [Docusign CLM](https://www.docusign.com/products/clm)

**Sufficient when — INFERENCE:** execution, signer experience and evidence are the bottleneck, while drafting, approval and post-signature tracking are already controlled elsewhere.

**Where it fails — INFERENCE:** an envelope is not a governed intake process or operational relationship. The 100-envelope allowance can also become a material usage constraint in the US plans.

### 5. CRM, procurement/S2P, ERP and work-management suites

**FACT:** Salesforce Revenue Cloud connects quoting, contracts, orders and billing; SAP Ariba Contracts connects contract items and terms to source-to-pay; Coupa's contract model exposes supplier, financial terms, approvals, contract hierarchy and a legal-agreement file; Oracle Procurement supports creation, approval, terms libraries and fulfillment. [Salesforce Revenue Cloud](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-cloud/), [SAP Ariba Contracts](https://www.sap.com/products/spend-management/contract-management-software.html), [Coupa Contracts API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/contracts-api-contracts), [Oracle Procurement 26C](https://docs.oracle.com/en/cloud/saas/procurement/26c/use.html)

**Sufficient when — INFERENCE:** the dominant agreements map cleanly to one operating motion—sales or procurement—and the suite already owns master data, workflow and administration.

**Where it fails — INFERENCE:** cross-functional agreements, third-party paper, nonstandard legal relationships and a portfolio-wide legal view can sit outside the suite's native object. Suite administration and integration can be disproportionate for a small organization.

### 6. Outside counsel and manual contract operations

**FACT:** external lawyers can supply legal judgment and negotiation; they do not, by themselves, create an internal system of record or accountable post-signature operating process. **INFERENCE:** outside counsel is sufficient for low-frequency/high-risk review where buying a platform would not improve the scarce capability. It fails as a repository/workflow substitute because every search, reminder and handoff remains a billable or internal manual event.

## Segmentation method

Segment placement describes a plausible buying context, not a hard employee threshold:

- **Small team:** self-serve/free or exact public pricing; low configuration; vendor language explicitly includes individuals, small companies or small teams.
- **Mid-market:** cross-functional workflows, CRM/HRIS integrations, implementation support and scalable governance without requiring a global enterprise architecture.
- **Enterprise:** explicit large-enterprise positioning, multi-entity/global controls, deep ERP/S2P/CRM integration, complex services/configuration or public-cloud/private-cloud choices.

When a vendor does not publish customer-size criteria, placement is marked **INFERENCE** from packaging and implementation evidence. Overlap is intentional.

## Segment and lifecycle comparison

Legend: **●** substantive public evidence; **◐** partial/adjacent capability; **○** not found in reviewed public evidence. These symbols compare disclosed scope, not product quality.

| Solution | Plausible segment | Core object | Pre-sign | Signature | Repository / intelligence | Obligations / renewal | Operational reconciliation | Price status |
|---|---|---|---:|---:|---:|---:|---:|---|
| Docusign eSignature | Small, mid | Envelope/document | ◐ | ● | ◐ | ○ | ○ | Public exact |
| PandaDoc | Small, mid | Sales document/deal | ● | ● | ◐ | ◐ | ○ | Public exact |
| Contractbook | Small, mid | Contract record + automation | ● | ● | ● | ● | ◐ | Public exact |
| Concord | Small, mid, enterprise | Contract record | ● | ● | ● | ● | ◐ | Public exact |
| Oneflow | Small, mid, enterprise | Structured digital contract | ● | ● | ● | ● | ○ | Quote/demo on current page |
| Zoho Contracts | Small, mid | Contract record + process | ● | ● | ● | ● | ◐ | Public plan page; captured amount gap |
| Juro | Mid | Browser-native contract + workflow | ● | ● | ● | ● | ◐ | Quote-only |
| SpotDraft | Mid, enterprise | Contract + workflow + repository | ● | ● | ● | ● | ◐ | Quote-only |
| LinkSquares | Mid, enterprise | Corpus intelligence + workflow | ● | ◐ | ● | ● | ◐ | Quote-only |
| Ironclad | Mid, enterprise | Configurable workflow + contract record | ● | ● | ● | ● | ◐ | Quote-only |
| Docusign CLM | Mid, enterprise | Agreement workflow + repository | ● | ● | ● | ● | ◐ | Quote-only |
| Agiloft CLM / Astra | Mid, enterprise | Data-first configurable record | ● | ◐ | ● | ● | ◐ | CLM quote-only; Astra $0/$120 |
| Icertis | Enterprise | Agreement family + structured terms/performance | ● | ◐ | ● | ● | ● | Quote-only |
| Sirion | Enterprise | Contract record + obligations/performance | ● | ◐ | ● | ● | ● | Quote-only |
| Workday Contract Intelligence / CLM (Evisort AI) | Mid, enterprise | Corpus intelligence + contract workflow | ● | ◐ | ● | ● | ◐ | Quote-only |
| Salesforce Contracts / Revenue Cloud | Mid, enterprise sell-side | Quote/order/customer contract | ● | ◐ | ● | ● | ● | Public exact for Revenue Cloud |
| SAP Ariba Contracts + Icertis extension | Enterprise buy-side | Supplier contract + spend line/item | ● | ◐ | ● | ● | ● | Quote-only |
| Coupa CLM | Enterprise buy-side | Supplier/financial contract + spend | ● | ◐ | ● | ● | ● | Quote-only |

**Count:** 18 named offers across 17 vendor families. Segment placements (overlap allowed): small 6; mid-market 12; enterprise 11. **INFERENCE:** small placement is supported most directly by public packaging; mid/enterprise placement for quote-only products is based on cross-functional scope, implementation model and enterprise-system integration, not an unpublished employee threshold.

## Pricing matrix

All entries accessed 2026-08-19. “Known exclusions/limits” records only what the official source exposes.

| Offer / edition | Exact public amount | Currency, unit, period | Known exclusions / limits | Geography | Source |
|---|---:|---|---|---|---|
| Docusign eSignature Personal | $11 | USD/account/month; annual commitment billed monthly ($132) | 5 envelopes/month; additional tax may apply | US | [Official](https://ecom.docusign.com/plans-and-pricing/esignature) |
| Docusign eSignature Standard | $30 | USD/user/month; annual commitment ($360) | 100 envelopes/user/year; tax additional | US | [Official](https://ecom.docusign.com/plans-and-pricing/esignature) |
| Docusign eSignature Business Pro | $45 | USD/user/month; annual commitment ($540) | Same disclosed 100-envelope annual allowance; tax additional | US | [Official](https://ecom.docusign.com/plans-and-pricing/esignature) |
| PandaDoc Starter | $19 | USD/seat/month, billed annually | Page says applicable taxes excluded; overage terms disclosed in FAQ | US | [Official](https://www.pandadoc.com/pricing/) |
| PandaDoc Business | $49 | USD/seat/month, billed annually | Some web form, bulk send and automation features optional; taxes excluded | US | [Official](https://www.pandadoc.com/pricing/) |
| PandaDoc Enterprise | Quote | Per seat or per document | AI/implementation/storage terms not public | US/UK availability; quote geography unknown | [Official](https://www.pandadoc.com/pricing/) |
| Contractbook Centralize | $399 | USD/month, billed annually | Unlimited users/contracts on current comparison; 2-hour kickoff; add-ons marked separately | US page | [Official](https://contractbook.com/pricing) |
| Contractbook Growth | $599 | USD/month, billed annually | Up to 10 onboarding hours shown; API/Zapier/Make may be add-ons | US page | [Official](https://contractbook.com/pricing) |
| Concord Essentials | $499 | USD/month, billed annually; 5 users | Additional users $49/month | US | [Official](https://www.concord.app/pricing/) |
| Concord Business | $899 | USD/month, billed annually; 5 users | Additional users $69/month | US | [Official](https://www.concord.app/pricing/) |
| Concord Enterprise | $1,299 | USD/month, billed annually; 5 users | Additional users $89/month; volume discounts; setup fee answer not exposed in captured page | US | [Official](https://www.concord.app/pricing/) |
| Salesforce Revenue Cloud Growth | $150 | USD/user/month, billed annually | Annual contract; contracts not listed in Growth feature summary | US | [Official](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-optimization-pricing/) |
| Salesforce Revenue Cloud Advanced | $200 | USD/user/month, billed annually | Contracts/orders and AI included; Billing sold separately; Premier Success = 30% of net license fees | US | [Official](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-optimization-pricing/) |
| Agiloft Astra Free | $0 | USD/month | 1,000 credits/month; 3 custom playbooks; this is Astra analytics/review, not full CLM | US | [Official](https://www.agiloft.com/platform/astra) |
| Agiloft Astra Pro | $120 | USD/month; annual selector shown | Credit/overage detail beyond captured page is unknown | US | [Official](https://www.agiloft.com/platform/astra) |
| Oneflow Business / Enterprise | Quote/demo | Current page shows no captured amount | Business starts at 5 users; Enterprise at 10; paid eID/premium items marked “$” | US/UK site | [Official](https://oneflow.com/pricing/) |
| Zoho Contracts Free | $0 | 3 users | 10 contracts, 5 counterparties, 1 workflow, 2 templates | US/UK availability; page localizes currency | [Official](https://www.zoho.com/contracts/pricing.html) |
| Zoho paid plans | Public-plan page; amount not captured | User and optional lite-user licenses; monthly/yearly toggles | Standard 25 contracts/user/month; Professional/Premium unlimited; AI availability varies by data center | Global | [Official](https://www.zoho.com/contracts/pricing.html) |
| Juro | Quote | Based on volume and integration complexity | AI feature packaging, implementation support, SSO/API configured in quote | US/UK | [Official](https://juro.com/pricing-new) |
| SpotDraft | Quote | User- or contract-volume basis | Implementation stated included; legal offering says document-storage slab and separately licensed VerifAI | US/UK | [Official pricing](https://www.spotdraft.com/pricing), [offering terms](https://legal.spotdraft.com/legal/clm-product-services-offerings-e6e5c133?v=1.0) |
| Ironclad | Quote | Product(s), deployment partner and add-ons | Implementation, integrations, instances and success plan can vary | US/UK | [Official](https://ironcladapp.com/pricing) |
| LinkSquares | Quote | Tailored quote | Implementation packages and technical services exist; amounts unknown | US/UK | [Official](https://linksquares.com/services/) |
| Docusign CLM | Quote | Not public | CLM, CLM+ and implementation/service boundaries not publicly priced | US/UK | [Official](https://www.docusign.com/en-gb/products/clm) |
| Icertis | Quote | Not public | AI, migration, services and usage terms unknown | US/UK | [Official](https://www.icertis.com/products/platform/) |
| Sirion | Quote | Not public | Vendor describes enterprise pricing drivers but publishes no Sirion amount | US/UK | [Official pricing discussion](https://www.sirion.ai/library/contract-insights/contract-management-pricing-models-comparison/) |
| Workday Contract Intelligence / CLM | Quote | Not public | Product packaging and service cost unknown | US/UK | [Official](https://www.workday.com/en-ca/products/contract-management/contract-intelligence.html) |
| SAP Ariba Contracts | Quote | Per user/month; amount on request | Contract duration 3–36 months; auto-renewal; Icertis extension must be bought with Ariba Contracts | US/UK | [Official](https://www.sap.com/products/spend-management/contract-management-software.html), [extension](https://www.sap.com/products/spend-management/ariba-contract-intelligence-by-icertis.html) |
| Coupa CLM | Quote | Not public | Coupa platform subscription dependency and module boundaries apply | US/UK | [Official platform docs](https://compass.coupa.com/en-us/products/product-documentation/total-spend-management-platform/platform-plus) |

**Pricing transparency count:** 6 vendor families expose at least one exact amount (Docusign eSignature, PandaDoc, Contractbook, Concord, Salesforce, Agiloft Astra); 11 dedicated/suite families are quote-only or have no captured exact paid amount. Oneflow's older first-party articles contain historical exact figures, but the current official pricing page is treated as authoritative and quote/demo-led. Zoho's free limits are exact; its dynamically localized paid amounts were not captured, so this report does not invent them.

## Solution dossiers

### 1. Docusign eSignature

- **Offer, buyer and model — FACT/INFERENCE:** Personal targets individuals/sole proprietors; Standard targets small-to-medium teams; Business Pro adds web forms, payments and bulk send. Daily users are agreement senders and signers. The primary object is the signing envelope/document, not an agreement family. [Pricing](https://ecom.docusign.com/plans-and-pricing/esignature)
- **Lifecycle — FACT:** templates, sending, signing, reminders, real-time audit trail and storage are covered; governed intake, clause negotiation and obligations are not evidenced as eSignature-plan capabilities. [Product](https://www.docusign.com/products/electronic-signature)
- **AI/evidence verdict — OPEN GAP:** AI-assisted summary is listed, but source-span citations, confidence and reviewer disposition were not found publicly for these plans. Signature evidence is strong at the transaction/audit-trail level; semantic extraction evidence is not disclosed.
- **Implementation/admin verdict — INFERENCE: low for web plans, medium when integrated.** Self-serve purchase and templates lower entry burden; envelope allowances, user licensing, integrations and organizational controls still need ownership.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud service; Docusign's trust portal lists ISO 27001/27017/27018, SOC 1/2 Type II, PCI and C5, but product/report scope must be verified during diligence. Advantage: mature execution layer and broad integrations. Limitation: execution-centric object and US envelope caps. [Trust portal](https://trust-portal.docusign.com/)

### 2. PandaDoc

- **Offer, buyer and model — FACT:** Free/Starter target small businesses and signing; Business targets sales proposals and integrated agreement workflows; Enterprise adds CPQ, automation, SSO, workspaces and API. The primary object is a generated sales/proposal document associated with a deal. [Pricing](https://www.pandadoc.com/pricing/)
- **Lifecycle — FACT/INFERENCE:** strong authoring, quote builder, approvals, rooms, signature, notifications and audit trail; repository uses folders/tags/search. Renewal notifications are optional, but detailed obligation fulfillment and agreement hierarchy were not evidenced.
- **AI/evidence verdict — OPEN GAP:** “smart content” and automation are disclosed, but a contract-specific extraction/Q&A evidence model with source citations, confidence and human review was not found.
- **Implementation/admin verdict — low to medium.** Self-serve for Starter; CRM, CPQ, workspaces, SSO/API and enterprise automations add sales-ops/admin work.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** vendor says data protection and enterprise compliance; exact certifications should be validated from its trust materials before purchase. Advantage: transparent small-team pricing and sales-document velocity. Limitation: not a portfolio-wide buy/sell-side obligation system.

### 3. Contractbook

- **Offer, buyer and model — FACT:** Centralize and Growth publish flat monthly pricing; prior/current page sections also describe Essential/Accelerate packaging. The model is a contract record with creation, collaboration, e-signature, extracted fields, reminders and automations. [Pricing](https://contractbook.com/pricing), [AI contract management](https://contractbook.com/ai-contract-management)
- **Lifecycle — FACT:** templates, negotiation/versioning, approvals/automations, native signature, OCR repository, custom extraction, reminders and post-signature tasks; Slack, CRM, API, Zapier and Make integrations depending on plan/add-on.
- **AI/evidence verdict — partial.** Vendor documents OCR/data extraction and AI-generated reminders, but exact source quote/page, confidence and reviewer-decision retention were not found in public evidence.
- **Implementation/admin verdict — low to medium.** Two-hour kickoff for Centralize and up to ten hours for Growth are concrete; dynamic templates, Salesforce/API and automation expand burden.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; pricing page lists SOC 2 Type II, GDPR, eIDAS and 2FA. Advantage: unusually transparent price and broad lifecycle for a smaller team. Limitation: operational commitments appear as tasks/reminders rather than transaction reconciliation; several controls/integrations are add-ons.

### 4. Concord

- **Offer, buyer and model — FACT:** Essentials explicitly targets small companies/single teams, Business multi-team deployment, Enterprise larger/complex deployments. Primary object is a contract record with document, structured data, deadlines and tasks. [Pricing](https://www.concord.app/pricing/)
- **Lifecycle — FACT:** upload/draft, live editing/redlining, approvals (Business), e-signature, OCR repository/search, amendments, deadlines, tasks, reports, API and CRM/storage integrations.
- **AI/evidence verdict — partial:** AI Copilot/extraction and MCP are listed for all plans; public page does not establish field-level citations, calibrated confidence or a reviewer disposition trail.
- **Implementation/admin verdict — low for Essentials; medium for Business/Enterprise.** Vendor says day-one use; tailored implementation/onboarding and enterprise identity controls are listed at higher scope.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; page lists SOC 2 Type II, GDPR, eIDAS, SSO and data residency. Advantage: transparent, comprehensive packaging. Limitation: $499/month entry cost may exceed a file-and-reminder stack; operational reconciliation is not evidenced.

### 5. Oneflow

- **Offer, buyer and model — FACT/INFERENCE:** current Business begins at five users; Enterprise at ten. It treats a contract as a structured, browser-native digital object rather than only a PDF, with data fields and lifecycle rules. [Pricing](https://oneflow.com/pricing/)
- **Lifecycle — FACT:** template creation, approvals, inline comments, signature/eID, lifecycle notifications, retention, webhooks; Enterprise adds shared templates, section rules, SSO/SCIM and account audit log.
- **AI/evidence verdict — partial:** write, extract and summary are in Business; review and portfolio insights are Enterprise. Public evidence for source-span citations, confidence and reviewer disposition was not found.
- **Implementation/admin verdict — low to medium.** Trial-led start; workspace design, lifecycle rules, templates, paid integrations and Enterprise identity/governance add burden. Oneflow's annual report states onboarding, configuration/templates and integration/custom-template services can be separately priced. [Annual report](https://oneflow.com/app/uploads/2026/04/Annual-report-2025_Oneflow-AB.pdf)
- **Security/deployment; advantage/limitation — OPEN GAP/INFERENCE:** cloud is evidenced; SSO/SCIM/audit controls are public, but certification and US/UK data-residency scope were not established in reviewed pages. Advantage: interactive contract object and strong counterparty experience. Limitation: current amounts and several add-on costs are opaque.

### 6. Zoho Contracts

- **Offer, buyer and model — FACT:** Free through Premium plans; vendor explicitly addresses small business and businesses of all sizes. It models a contract record/process with contract types, authoring, negotiation, signature, obligation management, amendments and renewals. [Small-business page](https://www.zoho.com/contracts/contract-management-software-for-small-businesses.html), [overview](https://help.zoho.com/portal/en/kb/contracts/introduction/articles/zoho-contracts-overview)
- **Lifecycle — FACT:** repository, 14 templates, approvals, collaboration/redlining, Zoho Sign, reports, smart letters for renewal/extension/amendment/termination, obligations (paid-plan boundary), CRM integration and intake.
- **AI/evidence verdict — partial/open:** pricing page lists ChatGPT integration only outside Europe data centers; public evidence did not establish citations/confidence/reviewer disposition. This geographic restriction matters for UK/EU buyers.
- **Implementation/admin verdict — low to medium.** Free trial and small-business self-navigation evidence lower entry burden; templates, clause library, permissions, CRM and obligations still need configuration.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; vendor cites GDPR, HIPAA, SOC 2, ISO alignment, audit logs and granular permissions but buyers should verify product/certificate scope. Advantage: broad lifecycle and free plan in a larger business suite. Limitation: paid amount capture/localization and AI evidence are incomplete.

### 7. Juro

- **Offer, buyer and model — FACT/INFERENCE:** one custom package priced by contract volume and integration complexity; implementation support is tailored. Best fit inferred as scaling/mid-market legal and business teams. Primary object is a browser-native contract and workflow. [Pricing](https://juro.com/pricing-new)
- **Lifecycle — FACT:** vendor pricing questionnaire discloses AI extraction/drafting/review, integrations with Salesforce, HubSpot, Word, Workday, SharePoint, Drive, Slack, Docusign, API/webhooks and support/configuration choices; end-to-end agreement and management is the stated offer.
- **AI/evidence verdict — OPEN GAP:** public packaging names extraction, drafting and playbook redlining, but retained source citation, confidence and reviewer decision evidence were not found.
- **Implementation/admin verdict — medium.** Vendor explicitly scopes workflows, support, integrations, SSO and API with an implementation team; contract volume and complexity drive the package.
- **Security/deployment; advantage/limitation — OPEN GAP/INFERENCE:** cloud is evident; certification/data-residency claims were not verified in the reviewed source set. Advantage: cohesive browser workflow and broad integrations. Limitation: total cost, post-signature depth and evidence model cannot be determined publicly.

### 8. SpotDraft

- **Offer, buyer and model — FACT:** bespoke user- or contract-volume pricing, with included in-house implementation. It models the contract plus workflow/repository; its commercial terms also define each created/uploaded contract as a stored “document” for volume charging. [Pricing](https://www.spotdraft.com/pricing), [offering terms](https://legal.spotdraft.com/legal/clm-product-services-offerings-e6e5c133?v=1.0)
- **Lifecycle — FACT:** conditional templates, Word Online editor/redlining, workflows/approvals, native signature, repository/search, 1,000+ metadata types, reports, 30+ integrations, API/webhooks; executed-contract obligations can be AI-extracted into tasks.
- **AI/evidence verdict — partial:** obligation workflow preserves a link from extracted commitment to a trackable human task, and VerifAI uses customer guides. Public documentation reviewed did not prove calibrated confidence or universal exact source/page citation.
- **Implementation/admin verdict — medium but vendor-assisted.** Vendor says templates, workflows, integrations and legacy migration are included and implemented in-house; a separate page claims 4–6 weeks. This reduces customer labor but does not eliminate design/data-cleansing work.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; vendor lists ISO 27001, SOC 2, GDPR, HIPAA, encryption, RBAC and audit logs; DPA says customer personal data is not used for AI training. Advantage: strong service wrapper and end-to-end scope. Limitation: quote/volume/storage/add-on economics require an order form; obligations were beta in January 2026. [DPA](https://legal.spotdraft.com/legal/data-processing-agreement-accelerate-package-347b742b)

### 9. LinkSquares

- **Offer, buyer and model — FACT/INFERENCE:** tailored quote with onboarding, technical services and custom integrations; targets small legal teams through large enterprise. It began repository/intelligence-first and in 2026 describes an agentic system of execution spanning front door, drafting, review and obligations. [Contract intelligence](https://linksquares.com/contract-intelligence/), [2026 platform launch](https://blog.linksquares.com/launches-first-agentic-clm-platform)
- **Lifecycle — VENDOR CLAIM:** intake, drafting, clause/playbook redlining, workflow, repository, obligations and renewals; signature coverage is stated as end-to-end but native versus integrated boundaries were not clear in reviewed pages.
- **AI/evidence verdict — relatively strong vendor claim:** the 2026 launch explicitly says citation-backed insights, governance and transparency; a separate page says every result has a paper trail. Confidence calibration and reviewer-disposition schema remain open.
- **Implementation/admin verdict — medium.** Vendor says most companies are up in under 90 days and offers implementation packages, customer success and technical services; timeframe varies with goals/team size. [Services](https://linksquares.com/services/)
- **Security/deployment; advantage/limitation — OPEN GAP/INFERENCE:** cloud is clear; detailed certifications/data residency were not verified here. Advantage: explicit citation-backed AI and integrated legal front door. Limitation: pricing, signature boundary and operational-system reconciliation remain opaque.

### 10. Ironclad

- **Offer, buyer and model — FACT/INFERENCE:** modular CLM, AI assistant/Jurist and eSignature, quote-only; customers may lead deployment, use Ironclad legal engineers or a partner. Core object is a configurable workflow with a contract record, captured process data and repository. [Pricing](https://ironcladapp.com/pricing)
- **Lifecycle — FACT/VENDOR CLAIM:** intake/self-service, generation, redlining/playbooks, approvals/routing, signature, repository/search, reminders and integrations such as Salesforce, SAP/Coupa ecosystem connectors.
- **AI/evidence verdict — partial/strong review control:** AI Playbooks detect language, flag non-standard terms and route a human reviewer/functional approver. New AI positioning says suggestions are grounded in historical positions, zero-retention/no-training and human-governed agents; exact source/page and confidence are not publicly established. [AI Playbooks](https://support.ironcladapp.com/hc/en-us/articles/12275685560215-Ironclad-AI-Playbooks-Overview), [AI suite](https://ironcladapp.com/product/ironclad-ai)
- **Implementation/admin verdict — medium to high.** Self-led is possible, but customized workflows, legacy import, integrations, instances and success-plan choice create real legal-ops/admin scope.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; vendor cites encryption, optional per-tenant keys/BYOK, ISO 27001 and SOC 2 Type II. Advantage: powerful workflow/process-data model and controlled review. Limitation: opaque total cost and configuration burden; post-signature operational reconciliation is more integration-dependent than explicit.

### 11. Docusign CLM

- **Offer, buyer and model — FACT:** quote-only CLM/CLM+ with document generation, collaboration, workflow, repository and AI. It treats agreements as workflow-managed records and can expose hierarchies/parties/obligations. [US product](https://www.docusign.com/products/clm), [CLM datasheet](https://www.docusign.com/sites/default/files/resource_event_files/apac_docusign_clm_datasheet.pdf)
- **Lifecycle — FACT:** dynamic templates, clause library, redlining/versioning, 100+ workflow steps, eSignature, repository, metadata/reporting, renewals and obligation reports; Salesforce, SAP Ariba and Coupa integrations.
- **AI/evidence verdict — partial:** CLM+ documents 100+ pre-trained extraction models and risk-driven workflow; public material does not establish source-span/page citations, confidence calibration and reviewer disposition across outputs.
- **Implementation/admin verdict — high for broad deployments.** Vendor references thousands of implementations and robust services; a cited customer reports a three-month rollout to hundreds of sellers, illustrating meaningful configuration/change work rather than self-serve setup.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; trust portal lists broad certifications, with product scope to verify. Advantage: eSignature integration, enterprise workflow and agreement metadata/hierarchy. Limitation: quote-only and potentially services-heavy; operational obligations are reports/workflows unless integrated downstream.

### 12. Agiloft CLM and Astra

- **Offer, buyer and model — FACT:** full “data-first” configurable CLM remains quote-led; Astra is a separately packaged contract AI/review layer with Free and $120/month Pro public pricing. Core model is structured contract data and configurable records/processes. [Astra](https://www.agiloft.com/platform/astra), [Astra launch](https://www.agiloft.com/news/agiloft-launches-astra)
- **Lifecycle — VENDOR CLAIM/INFERENCE:** Astra covers Word review, playbooks and portfolio Q&A; the broader CLM is positioned end-to-end. Signature and operational-reconciliation boundaries were not established in the reviewed Astra pages.
- **AI/evidence verdict — partial:** vendor promises human control and no training on customer contracts. It does not publicly establish exact source citations, confidence or retained reviewer decisions in the reviewed evidence.
- **Implementation/admin verdict — low for Astra; high for configurable CLM.** Astra says no complex setup—upload or use Word add-in. Full data-first CLM implies data model/workflow configuration; vendor's implementation-success percentages are claims, not independent evidence.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/OPEN GAP:** Astra says enterprise-grade security/no training. Detailed deployment, certification and residency scope were not verified. Advantage: a low-friction AI entry alongside deeply configurable CLM. Limitation: buyers must not mistake Astra price for full-CLM price or scope.

### 13. Icertis

- **Offer, buyer and model — FACT/VENDOR CLAIM:** enterprise, quote-only platform spanning Engage, Operate and Analyze; public and private cloud options and integrations with SAP, Microsoft, Salesforce and Workday. The core is structured contract data, agreement relationships, obligations and performance—not merely a file. [Platform](https://www.icertis.com/products/platform/)
- **Lifecycle — VENDOR CLAIM:** agent-assisted drafting/negotiation, workflow, enterprise ingestion/migration, repository/intelligence, obligations, fulfillment tracking, analytics and operational actions.
- **AI/evidence verdict — partial:** Vera is positioned as human-governed and context-aware; platform lists knowledge graph, embeddings and data lake. Public evidence reviewed does not prove a universal source/page citation, calibrated confidence and reviewer disposition record.
- **Implementation/admin verdict — high.** Legacy migration, enterprise data model, cross-system integrations, global workflows and public/private-cloud choice imply program implementation and ongoing platform administration.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** public/private cloud and “enterprise-grade data privacy” are explicit; certification/residency specifics require diligence. Advantage: strongest explicit relationship/transaction-performance model in the sample, including reconciling transactional documents to terms. Limitation: opaque price and high transformation/integration burden.

### 14. Sirion

- **Offer, buyer and model — FACT/INFERENCE:** enterprise, quote-only AI-native CLM. Public material describes contracts as structured actionable obligations across the full lifecycle and emphasizes performance/compliance, not storage alone. [Obligation model](https://www.sirion.ai/library/contract-insights/contract-obligations-risk-management/)
- **Lifecycle — VENDOR CLAIM:** authoring through performance, AI extraction, configurable workflows, compliance monitoring and continuous obligation tracking; legal, procurement, finance, compliance and operations are the cross-functional users.
- **AI/evidence verdict — governance-forward but product evidence incomplete:** Sirion's AI policy establishes governance intent, while its guidance calls for human review/auditability. Reviewed sources did not prove the exact product UI retains source/page, confidence and reviewer disposition for each output. [AI policy](https://www.sirion.ai/wp-content/uploads/2025/02/Sirion-AI-Policy-External-V2.pdf)
- **Implementation/admin verdict — high.** Sirion itself says data migration and integration are the biggest implementation risks and contrasts self-implementation with professional services. [Implementation analysis](https://www.sirion.ai/library/contract-insights/self-vs-professional-clm-implementation/)
- **Security/deployment; advantage/limitation — OPEN GAP/INFERENCE:** enterprise SaaS is implied; detailed public product certifications, residency and deployment choices were not verified. Advantage: lifecycle-spanning obligation/performance orientation. Limitation: product detail, price and evidence mechanics are hard to verify independently from public pages.

### 15. Workday Contract Intelligence and Contract Lifecycle Management, powered by Evisort AI

- **Offer, buyer and model — FACT:** Workday now sells Evisort-powered Contract Intelligence (repository/analysis) and CLM; quote-only. The intelligence product makes the corpus and extracted terms primary; CLM adds process around it. [Contract Intelligence](https://www.workday.com/en-ca/products/contract-management/contract-intelligence.html), [CLM datasheet](https://forms.workday.com/content/dam/web/ca/documents/datasheets/workday-contract-lifecycle-management-powered-by-evisort-ai-datasheet-en-CA.pdf)
- **Lifecycle — VENDOR CLAIM:** OCR/import, “Ask AI,” custom AI models, search, dashboards, integrations and administration; CLM datasheet covers lifecycle workflow. Post-signature material cites renewal alerts, pricing/rebate terms and supplier obligations.
- **AI/evidence verdict — partial:** exact terms can be surfaced for audit use, and ISO-certified responsible AI is claimed; public pages reviewed do not disclose calibrated confidence and reviewer disposition at field level.
- **Implementation/admin verdict — medium to high.** Vendor claims fast startup, but corpus migration, custom AI models, advanced administration and Workday/third-party integration add data and governance work.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/OPEN GAP:** cloud and ISO responsible-AI claim are public; product security certifications/data residency need Workday trust diligence. Advantage: strong legacy-portfolio intelligence within a major enterprise suite. Limitation: price and intelligence-versus-workflow product boundary remain opaque.

### 16. Salesforce Contracts / Revenue Cloud (Agentforce Revenue Management)

- **Offer, buyer and model — FACT:** Growth $150/user/month and Advanced $200/user/month annually; Advanced includes contracts/orders and AI/analytics. A separate Salesforce Contracts SKU has been published at $50/user/month but requires prerequisites, so the current Revenue Cloud pricing is used for primary comparison. Core object is the customer/product quote, order, asset and contract in quote-to-cash. [Current pricing](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-optimization-pricing/), [Contracts datasheet](https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/datasheets/fy25-sales-cloud-contracts-datasheet.pdf)
- **Lifecycle — FACT/VENDOR CLAIM:** AI clause generation, collaborative redlining, templates, amendments, obligations, orders, fulfillment, billing and renewals; native CRM data and REST APIs.
- **AI/evidence verdict — partial/open:** Agentforce can generate quotes/clauses and manage renewals, but source citations, confidence and legal reviewer disposition were not found publicly for contract outputs.
- **Implementation/admin verdict — high.** Salesforce training explicitly targets administrators/implementers; product, pricing, contract state, revenue events, orchestration and downstream accounting require revenue-ops architecture. Premier Success adds 30% of net license fees.
- **Security/deployment; advantage/limitation — OPEN GAP/INFERENCE:** Salesforce cloud security is outside the product sources reviewed; exact residency/compliance must be scoped by service. Advantage: operationalizes sell-side contract commitments through order/billing/asset lifecycle. Limitation: sales-centric, prerequisite/add-on complexity, and less natural for buy-side/non-revenue agreements.

### 17. SAP Ariba Contracts and SAP Ariba Contract Intelligence by Icertis

- **Offer, buyer and model — FACT:** enterprise buy-side suite; Ariba Contracts is per user/month with price on request, 3–36 month terms and auto-renewal. The Icertis extension must be purchased with Ariba Contracts. Core object is a supplier contract workspace with items, pricing terms and source-to-pay connections. [Ariba Contracts](https://www.sap.com/products/spend-management/contract-management-software.html), [Icertis extension](https://www.sap.com/products/spend-management/ariba-contract-intelligence-by-icertis.html)
- **Lifecycle — FACT/VENDOR CLAIM:** authoring/clause assembly/redlining, collaboration, workflow, repository/search/reporting, expiration notifications, spend/consumption monitoring and AI Contracts Agent; advanced extension adds Icertis CLM.
- **AI/evidence verdict — OPEN GAP:** AI agent and Icertis insights are advertised, but source citation, confidence and human-review retention were not established from public SAP sources reviewed.
- **Implementation/admin verdict — high.** Source-to-pay master data, suppliers, items/pricing, SAP integration, roles and the two-product dependency make this an enterprise program.
- **Security/deployment; advantage/limitation — VENDOR CLAIM/INFERENCE:** cloud; SAP links to built-in security and trust materials, but exact product/data-residency scope requires diligence. Advantage: negotiated supplier terms can control spend and consumption. Limitation: buy-side orientation, quote-only cost and suite dependency.

### 18. Coupa CLM

- **Offer, buyer and model — FACT:** enterprise business-spend suite module, quote-only. Coupa's API models supplier, dates/status, financial terms, hierarchy and a legal-agreement file; amendments have parent-contract logic. [Contracts API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/contracts-api-contracts)
- **Lifecycle — FACT/VENDOR CLAIM:** guided authoring, Word revisions, clause library/risk scores, approvals, e-signature integrations, permissions repository and hierarchy; source/supplier/spend data flows into purchasing and invoice validation. [CLM datasheet](https://get.coupa.com/rs/950-OLU-185/images/Coupa-CLM_Datasheet.pdf)
- **AI/evidence verdict — OPEN GAP:** “community-powered insights” and platform AI exist; no reviewed public product evidence established exact citations, confidence or reviewer disposition for contract AI.
- **Implementation/admin verdict — high.** Platform subscription/module boundaries, supplier/master data, SFTP/API imports, legacy migration and spend-system workflow require procurement/IT administration. The presence of a specialist migration app is evidence of nontrivial migration demand, not proof every deployment needs it. [Migration app](https://marketplace.coupa.com/en-US/apps/351534/mainspring-contract-migration-for-coupa-clm)
- **Security/deployment; advantage/limitation — OPEN GAP/INFERENCE:** cloud platform and SSO/security foundation are documented; certifications/residency were not verified here. Advantage: strongest direct on-contract-spend/invoice-control posture alongside SAP. Limitation: procurement-centric and dependent on Coupa platform economics and configuration.

## Cross-segment conclusions

### What changes with company size

| Dimension | Small organization | Mid-market | Enterprise |
|---|---|---|---|
| Trigger to change | Cannot find final documents; missed renewal; signature friction | Legal queue, inconsistent self-service, CRM/procurement handoffs, reporting | Multiple entities/regions, legacy corpus, regulatory controls, ERP/S2P/CRM integration, performance leakage |
| Typical buyer | Founder, COO, finance/ops, first legal hire | GC/legal ops, sales ops/rev ops, procurement | Legal ops, procurement transformation, CIO/enterprise apps, revenue operations |
| Daily users | Sender/owner plus signers | Business requesters, legal reviewers, approvers, contract admins | Distributed requesters plus specialist admins, integration/data teams and operational owners |
| Viable object model | File + searchable record + reliable dates | Governed workflow + repository + structured metadata | Agreement family + policy + operational obligation/performance links |
| Main implementation risk | Paying for complexity no one owns | Recreating a bad process in software; weak adoption | Data cleansing, integration, taxonomy, global governance and unclear accountability |
| Practical “enough” test | Can one accountable person answer status, final version and next deadline? | Can business teams self-serve standard work while legal sees exceptions and evidence? | Can terms drive downstream actions and can the enterprise prove the prevailing obligation and its fulfillment? |

### Documented gaps across the landscape

1. **AI provenance is usually under-specified — FACT.** Only LinkSquares in this reviewed set explicitly advertises citation-backed insights. Most vendors describe accurate/explainable/trusted AI without publicly defining a durable object containing exact source span/page, model confidence, reviewer, disposition and version.
2. **Reminder is often presented as obligation management — INFERENCE.** A date alert helps avoid silence; it does not prove who owes what, dependency/condition, evidence of completion, acceptance, exception, cure or commercial impact.
3. **Agreement-family semantics are uneven — FACT/INFERENCE.** Docusign CLM and Coupa publicly mention hierarchies; Icertis emphasizes relationships. Many lighter tools show individual contract records without clearly documenting precedence across MSA/SOW/order/DPA/amendment/side letter.
4. **Deployment detail is much less transparent than security badges — FACT.** Public/private cloud is explicit for Icertis; most others reviewed are SaaS. Detailed US/UK residency, backup location, tenant-key model, subprocessor region and model-provider routing frequently require a trust portal or sales diligence.
5. **Total implementation cost is rarely public — FACT.** Vendors disclose license amounts or implementation approach, seldom both. Workflow design, template conversion, legacy metadata validation, integrations, training, sandboxes and change management must be priced separately during evaluation.
6. **Suite-native depth trades breadth for operational connection — INFERENCE.** Salesforce can turn sales contracts into orders/billing; SAP/Coupa can control supplier spend. That is more operational than a generic repository, but neither model naturally covers every agreement family across the enterprise.
7. **“End-to-end” is not a comparable fact — INFERENCE.** It can mean draft-to-sign, request-to-repository, or terms-to-transaction monitoring. Buyers should require a live walkthrough from request through amendment, obligation evidence and exit—not a feature checklist.

## Evaluation questions that expose the real model

1. If an amendment changes one clause in an MSA, which object becomes prevailing, and can every SOW inherit the result without overwriting history?
2. Can an extracted obligation retain exact source text/page, confidence, extractor/model version, reviewer, disposition and downstream owner?
3. Does “obligation management” mean a reminder, a task, evidence of performance, or reconciliation against an invoice/order/SLA?
4. What remains billable after license: implementation, sandbox, migration, templates, integrations, API, AI credits, storage, envelopes, identity verification, premium support and overage?
5. Which roles need paid seats: requesters, approvers, viewers, counterparties, signers, obligation owners and admins?
6. Can third-party paper enter the same governed workflow and data model as internally generated paper?
7. What is the rollback/export path for originals, versions, metadata, audit trail, comments, AI provenance, workflows and relationships?
8. Which certifications and residency promises cover this exact product, region, AI subprocessor and support path—not merely the parent company?
9. Who owns taxonomy, templates, playbooks, integrations, failed automations and extraction-quality review after go-live?
10. Show the operational handoff: how does an agreed price, notice period, SLA, deliverable or renewal decision reach the system and person that must act?

## Research limitations and evidence policy

- This is public-web desk research, not hands-on testing, procurement diligence or a substitute for a security package/order form. Dynamic pricing and trust portals can vary by IP, currency, cookie, edition and authentication state.
- Vendor capability statements are recorded as vendor claims even when technically plausible. Customer outcome percentages were not used as comparative facts.
- No anonymous marketplace rating or score was used to rank products. Marketplace reviews are selection-biased, plan/version-specific and usually cannot prove product boundaries. Documented limitations here are either explicit packaging/usage boundaries or clearly labeled inferences from missing lifecycle evidence.
- WorldCC supplies cross-vendor context, but its 2025 report was produced with industry participants and does not independently test named software. The report is used for process/accountability findings, not vendor ranking.
- A blank or **OPEN GAP** means “not established in the sources reviewed,” not “the capability does not exist.” Sales demos must prove it with product documentation, UI evidence and contractual terms.
- “Private cloud” is not treated as self-hosting. No reviewed offer supplied evidence of customer-operated/on-premises deployment. Icertis publicly lists public and private cloud; all other evidenced deployments are vendor-operated cloud/SaaS or were not specified.

## Source and claim ledger

All sources were accessed 2026-08-19. “Primary” means the vendor's product, pricing, legal, help, trust, developer or investor material. “Industry research” means a published research body/report; it is not treated as a product test. Geography records the page context, not a contractual availability warranty.

| ID | Class | Geography | Source | Claims supported / cautions |
|---|---|---|---|---|
| P01 | Primary—vendor pricing | US | [Docusign eSignature pricing](https://ecom.docusign.com/plans-and-pricing/esignature) | Editions, exact USD price, billing commitment, envelopes, tax note; dynamic offers may vary |
| P02 | Primary—vendor product | US/global | [Docusign eSignature](https://www.docusign.com/products/electronic-signature) | Signing-centered offer and plan positioning |
| P03 | Primary—vendor trust | Global | [Docusign Trust Portal](https://trust-portal.docusign.com/) | Certification/report inventory; product/report scope requires access/diligence |
| P04 | Primary—vendor product | UK | [Docusign CLM UK](https://www.docusign.com/en-gb/products/clm) | CLM lifecycle, AI, integrations, UK availability, quote route |
| P05 | Primary—vendor datasheet | APAC/global product | [Docusign CLM datasheet](https://www.docusign.com/sites/default/files/resource_event_files/apac_docusign_clm_datasheet.pdf) | Repository, metadata, hierarchy, renewals, implementation customer statement |
| P06 | Primary—vendor datasheet | APAC/global product | [Docusign CLM+ datasheet](https://www.docusign.com/sites/default/files/resource_event_files/apac_docusign_clm_datasheet_0.pdf) | 100+ AI models and risk/workflow use |
| P07 | Primary—vendor pricing | US | [PandaDoc pricing](https://www.pandadoc.com/pricing/) | Exact USD editions, limits, taxes, optional features, object/lifecycle boundaries |
| P08 | Primary—vendor help | Global | [PandaDoc plan comparison](https://support.pandadoc.com/en/articles/9715033-compare-subscription-plan-features) | Monthly/annual price and feature cross-check |
| P09 | Primary—vendor pricing | US page | [Contractbook pricing](https://contractbook.com/pricing) | Exact price, users/contracts, onboarding, add-ons, security labels |
| P10 | Primary—vendor product | Global | [Contractbook AI contract management](https://contractbook.com/ai-contract-management) | OCR/extraction, templates, lifecycle, tasks/reminders and integrations |
| P11 | Primary—vendor pricing | US | [Concord pricing](https://www.concord.app/pricing/) | Exact USD plans, seats, AI, lifecycle, security/residency labels, implementation claim |
| P12 | Primary—vendor product | Global | [Concord features](https://www.concord.app/features/) | End-to-end feature scope |
| P13 | Primary—vendor pricing | US/UK site | [Oneflow pricing](https://oneflow.com/pricing/) | Current demo-led Business/Enterprise packaging, minimum users, paid feature markers |
| P14 | Primary—vendor annual report | Global | [Oneflow annual report 2025](https://oneflow.com/app/uploads/2026/04/Annual-report-2025_Oneflow-AB.pdf) | Per-user SaaS, separately priced onboarding/configuration/integration/custom templates |
| P15 | Primary—vendor pricing | Global/localized | [Zoho Contracts pricing](https://www.zoho.com/contracts/pricing.html) | Free limits, plan features, license unit, geography-specific AI caveat; paid amount dynamically unavailable in capture |
| P16 | Primary—vendor help | Global | [Zoho Contracts overview](https://help.zoho.com/portal/en/kb/contracts/introduction/articles/zoho-contracts-overview) | Contract record and lifecycle model |
| P17 | Primary—vendor product | Global | [Zoho enterprise](https://www.zoho.com/contracts/enterprise.html) | Permissions, audit, obligations, integration and vendor security/compliance claims |
| P18 | Primary—vendor pricing | US/UK | [Juro pricing](https://juro.com/pricing-new) | Quote basis, AI and integration options, implementation/support model |
| P19 | Primary—vendor pricing | US/UK | [SpotDraft pricing](https://www.spotdraft.com/pricing) | User/volume pricing basis, included implementation, lifecycle and security labels |
| P20 | Primary—vendor legal/product | Global | [SpotDraft CLM offering](https://legal.spotdraft.com/legal/clm-product-services-offerings-e6e5c133?v=1.0) | Document-storage charging object, add-ons, VerifAI licensing, feature boundaries |
| P21 | Primary—vendor help | Global | [SpotDraft obligations](https://help.spotdraft.com/articles/9044692601-managing-contract-obligations-beta) | Executed-contract extraction to trackable task; beta status/date |
| P22 | Primary—vendor legal | Global | [SpotDraft DPA](https://legal.spotdraft.com/legal/data-processing-agreement-accelerate-package-347b742b) | AI processing purpose and no customer-personal-data training statement |
| P23 | Primary—vendor product | US/UK | [LinkSquares contract intelligence](https://linksquares.com/contract-intelligence/) | Segment breadth, repository/intelligence and obligations |
| P24 | Primary—vendor release | Global | [LinkSquares 2026 platform launch](https://blog.linksquares.com/launches-first-agentic-clm-platform) | Agentic workflow, citation-backed insights, obligations/renewals; vendor launch claims |
| P25 | Primary—vendor services | Global | [LinkSquares services](https://linksquares.com/services/) | Implementation packages, variable timeline, technical services/support |
| P26 | Primary—vendor explanation | Global | [LinkSquares trust in AI](https://linksquares.com/library/why-contract-teams-need-to-trust-ai-and-where-to-start/) | Paper-trail/human-control claims and under-90-day statement |
| P27 | Primary—vendor pricing | US/UK | [Ironclad pricing](https://ironcladapp.com/pricing) | Modular quote, deployment choices, integrations/add-ons |
| P28 | Primary—vendor product | Global | [Ironclad AI](https://ironcladapp.com/product/ironclad-ai) | AI suite, human governance/no-training/security claims |
| P29 | Primary—vendor help | Global | [Ironclad AI Playbooks](https://support.ironcladapp.com/hc/en-us/articles/12275685560215-Ironclad-AI-Playbooks-Overview) | Detection, flags and human/functional review routing |
| P30 | Primary—vendor product | Global | [Icertis platform](https://www.icertis.com/products/platform/) | Engage/Operate/Analyze, public/private cloud, enterprise integrations, structured records |
| P31 | Primary—vendor product | Global | [Icertis contract performance](https://www.icertis.com/products/platform/contract-performance/) | Obligations and transactional reconciliation/action model |
| P32 | Primary—vendor product | Global | [Icertis Analyze](https://www.icertis.com/products/analyze/) | Corpus extraction, relationships, search/Q&A and stakeholder uses |
| P33 | Primary—vendor product/pricing | US | [Agiloft Astra](https://www.agiloft.com/platform/astra) | $0/$120, credits/playbooks, Word review, no-training and setup claim; not full CLM price |
| P34 | Primary—vendor release | Global | [Agiloft Astra launch](https://www.agiloft.com/news/agiloft-launches-astra) | 2026 release status and target functions; vendor outcome claims excluded |
| P35 | Primary—vendor policy | Global | [Sirion AI policy](https://www.sirion.ai/wp-content/uploads/2025/02/Sirion-AI-Policy-External-V2.pdf) | AI governance commitments; not proof of field-level product evidence |
| P36 | Primary—vendor analysis | Global | [Sirion obligations](https://www.sirion.ai/library/contract-insights/contract-obligations-risk-management/) | Full-lifecycle obligation model and vendor positioning |
| P37 | Primary—vendor implementation | Global | [Sirion implementation analysis](https://www.sirion.ai/library/contract-insights/self-vs-professional-clm-implementation/) | Migration/integration risk and service-model factors |
| P38 | Primary—vendor pricing analysis | Global | [Sirion pricing models](https://www.sirion.ai/library/contract-insights/contract-management-pricing-models-comparison/) | Enterprise price drivers; no Sirion amount, so quote-only/unknown |
| P39 | Primary—vendor product | Canada/global | [Workday Contract Intelligence](https://www.workday.com/en-ca/products/contract-management/contract-intelligence.html) | Evisort-powered repository, OCR, Q&A, models, admin and responsible-AI claim |
| P40 | Primary—vendor datasheet | Canada/global | [Workday CLM datasheet](https://forms.workday.com/content/dam/web/ca/documents/datasheets/workday-contract-lifecycle-management-powered-by-evisort-ai-datasheet-en-CA.pdf) | CLM product existence and lifecycle scope |
| P41 | Primary—vendor material | US/global | [Workday manufacturing contracts](https://forms.workday.com/content/dam/web/en-us/documents/ebooks/hidden-costs-of-not-knowing-your-manufacturing-contracts-ebook-enus.pdf) | Renewal, price/rebate, obligation and audit use cases; vendor-authored |
| P42 | Primary—vendor pricing | US | [Salesforce Revenue Cloud pricing](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-optimization-pricing/) | Exact USD plans, annual term, add-ons and support percentage |
| P43 | Primary—vendor product | US | [Salesforce Revenue Cloud](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-cloud/) | Quote-to-cash object, contract features, API/integrations and AI claims |
| P44 | Primary—vendor datasheet | US | [Salesforce Contracts datasheet](https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/datasheets/fy25-sales-cloud-contracts-datasheet.pdf) | $50 add-on historical/current datasheet price with prerequisite caveat and feature boundary |
| P45 | Primary—vendor pricing/product | US/global | [SAP Ariba Contracts](https://www.sap.com/products/spend-management/contract-management-software.html) | Per-user quote, term range/renewal, lifecycle, spend/consumption and cloud/security links |
| P46 | Primary—vendor product | US/global | [SAP Ariba Contract Intelligence by Icertis](https://www.sap.com/products/spend-management/ariba-contract-intelligence-by-icertis.html) | Two-product dependency, editions, source-to-pay intelligence |
| P47 | Primary—vendor documentation | Global | [SAP Ariba Contracts 2026 guide](https://help.sap.com/doc/0b232816de9e4396bf8f09e5d14ed702/Cloud/en-US/3dcf7e56e8a54fadb8018d3403ff0baa.pdf) | Contract line/item pricing object and terms |
| P48 | Primary—vendor developer docs | Global | [Coupa Contracts API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/contracts-api-contracts) | Contract fields/states, hierarchy, approvals and legal file |
| P49 | Primary—vendor docs | Global | [Coupa Platform](https://compass.coupa.com/en-us/products/product-documentation/total-spend-management-platform/platform-plus) | Platform subscription/function/security/admin/integration foundation |
| P50 | Primary—vendor datasheet | Global | [Coupa CLM datasheet](https://get.coupa.com/rs/950-OLU-185/images/Coupa-CLM_Datasheet.pdf) | Authoring, hierarchy and operationalized spend/invoice claims |
| P51 | Primary—vendor marketplace | Global | [Coupa migration app](https://marketplace.coupa.com/en-US/apps/351534/mainspring-contract-migration-for-coupa-clm) | Specialist migration offering; does not prove universal requirement |
| P52 | Primary—vendor documentation | Global | [Oracle Procurement 26C](https://docs.oracle.com/en/cloud/saas/procurement/26c/use.html) | Suite status-quo coverage: create/search/edit/approve/fulfillment/terms library |
| P53 | Primary—official software docs | Global | [Microsoft Track Changes](https://support.microsoft.com/en-us/word/training/track-changes-in-word) | Word review capabilities and boundaries |
| P54 | Primary—official software docs | Global | [Microsoft Word versioning](https://support.microsoft.com/en-US/Word/use-versioning-with-word) | OneDrive/SharePoint versioning/coauthoring dependency |
| P55 | Primary—official software docs | Global | [SharePoint versioning](https://support.microsoft.com/en-us/sharepoint/lists/documents-and-library/how-versioning-works-in-lists-and-libraries) | Version creation semantics |
| P56 | Primary—official software docs | Global | [Google Drive sharing](https://support.google.com/drive/answer/2494822?hl=en) | Roles, inheritance and file-sharing controls |
| P57 | Primary—official software docs | Global | [Google Drive approvals](https://support.google.com/drive/answer/9387535?hl=en_fm) | File approval and approval-history boundaries |
| P58 | Primary—official software docs | Global | [Google version history](https://support.google.com/docs/answer/190843?hl=en_) | Document version/change visibility and limits |
| I01 | Industry research | Global | [WorldCC Benchmark 2025](https://www.worldcc.com/Portals/IACCM/Reports/Benchmark-Report-2025.pdf) | Aggregate process/accountability findings; industry-supported, not a vendor test |
| I02 | Industry research | Global | [WorldCC Benchmark 2023](https://www.worldcc.com/Portals/IACCM/Reports/Benchmark-report-2023.pdf) | Process complexity, barriers and 8.6% value erosion context; not a product comparison |
| I03 | Industry commentary/research summary | Global | [WorldCC integration and outcomes](https://www.worldcc.com/resource/from-value-leakage-to-better-outcomes-why-contracting-needs-integration.html) | Cross-functional handoff/operational behavior framing; dated 2026 |

**Ledger count:** 61 unique sources: 58 primary vendor/official software sources and 3 industry research/commentary sources. All 28 pricing rows trace directly to a vendor pricing, product, legal or investor source; no review-site price is used. All affirmative security/deployment claims trace to vendor product, pricing, trust, legal or policy sources and remain labeled vendor claims unless directly observable.

## Rule-based acceptance audit

| Rule | Result | Evidence |
|---|---|---|
| Product-agnostic; no project positioning | PASS | No product recommendation or project comparison; report discusses buyer contexts only |
| Status quo treated as first-class competition | PASS | Six status-quo sections plus object-model table cover document/email, drives, spreadsheets/calendars, e-signature, suites/ERP/tasks and outside counsel |
| At least 15 named dedicated/suite solutions | PASS | 18 named offers across 17 vendor families |
| At least 4 plausible small-team offers | PASS | 6: Docusign eSignature, PandaDoc, Contractbook, Concord, Oneflow, Zoho Contracts |
| At least 6 mid-market offers | PASS | 12 placements in segment matrix |
| At least 5 enterprise offers | PASS | 11 placements in segment matrix |
| Segment basis sourced or explicit inference | PASS | Segmentation method plus per-dossier FACT/INFERENCE labels |
| Offer/edition and exact public price or quote-only status | PASS | 27-row pricing matrix with currency/unit/period/edition/limits/geography/source |
| No invented normalized price | PASS | No quote/start price converted; dynamic/unknown amounts marked gaps |
| Buyer, daily user and core object | PASS | Stack/segment tables and every dossier |
| Pre-signature, signature and post-signature coverage | PASS | Lifecycle matrix and every dossier |
| Repository/search/metadata | PASS | Lifecycle matrix and dossiers |
| Negotiation/approvals | PASS | Lifecycle/object tables and dossiers |
| Obligations, renewals, change and exit | PASS | Lifecycle matrix/dossiers; evaluation questions include amendment, export and exit; unknowns explicit |
| Integrations | PASS | Dossiers distinguish suite connections and APIs |
| AI functions and evidence model | PASS | Every dossier has concise AI/evidence verdict; cross-market provenance gap explicit |
| Implementation, migration, admin and services burden | PASS | Every dossier has burden verdict; cross-segment comparison and evaluation questions |
| Cloud/self-host/deployment/data residency/security | PASS | Every dossier states evidence or open gap; limitations distinguish private cloud from self-hosting |
| Documented advantage and limitation | PASS | Every dossier ends with advantage and limitation, labeled claim/inference/gap |
| US/UK geography and date | PASS | Header, source ledger and pricing geography; deviations labeled |
| At least 35 unique sources / 25 primary | PASS | 61 unique total; 58 primary/official |
| Independent limitations only with transparent method | PASS | No review ratings used; limitations derive from official boundaries or labeled inference; WorldCC use/limits disclosed |
| No production/config/schema/unrelated edits | PASS | Research artifact and researcher-memory notes only; exact files reported at handoff |
