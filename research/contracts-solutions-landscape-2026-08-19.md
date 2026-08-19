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

