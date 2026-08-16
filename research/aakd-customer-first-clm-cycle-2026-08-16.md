# Aakd customer-first CLM validation cycle

Status: in progress
Decision: not yet build / not yet reject
Goal: identify one repeatedly paid, unowned contract outcome before changing Aakd.

## 1. Current Aakd: what is actually present

The repository and product documentation show a broad, technically substantial CLM:

- PDF/DOCX upload, file validation, OCR, full-text and semantic search, folders, tags, versions and snapshots.
- AI metadata extraction, cited Q&A, risk scoring, obligation extraction, BYOK providers and Ollama.
- Templates, variables, clause snippets, rich editing, DOCX/PDF export, redlining and snapshot comparison.
- Approvals, DocuSeal signing, signer reminders and signing webhooks.
- Obligation and renewal dashboards, assignees, subtasks, overdue jobs and email alerts.
- Slack/Teams notifications, webhooks, REST API and MCP.
- CSV, Google Drive, PandaDoc, DocuSign CLM and CRM imports; HubSpot, Salesforce and Pipedrive links.
- English, French, German, Spanish and Arabic RTL; self-hosting and local AI options.

The API surface confirms that these are not only landing-page claims: there are routes for contracts, extraction, risk, obligations, approvals, signing, snapshots, imports, CRM links, notifications and MCP. The current product is therefore not a missing-feature prototype. It is a broad CLM that still lacks documented live customer adoption, paid pilots, retention or revenue evidence.

## 2. Lifecycle map from the customer's point of view

| Phase | Primary owner | Common systems | Repeated failure pattern | Aakd coverage |
|---|---|---|---|---|
| Request/intake | business requester, sales, procurement | email, Slack/Teams, CRM, forms | incomplete context, unclear priority, requests arrive through many channels | partial workflow, not yet proven in a real organization |
| Draft/template | legal, sales ops, procurement | Word, templates, CRM, CLM | non-standard terms, template drift, legal bottleneck | strong authoring/templates |
| Negotiation/redline | legal, counterparty, business owner | Word, email, shared links | counterparties refuse a new editor; version confusion | redlining/editor exists, but Word/counterparty adoption is unproven |
| Internal approval | legal, finance, security, management | email, Teams, workflow tools | unclear approval ownership and parallel reviews | approvals exist |
| Signature | authorized signers, counterparty | DocuSign, Adobe, DocuSeal, email | signature status separated from business context | DocuSeal/signing exists |
| Repository/search | legal ops, procurement, finance, operators | Drive, SharePoint, CLM, folders | latest version and agreement family are unclear | strong repository/search, but migration and ongoing data hygiene remain unknown |
| Activation/handoff | sales ops, finance, delivery, procurement | CRM, ERP, billing, PSA, Jira | signed terms do not become executable tasks or billing rules | CRM links and obligations exist; cross-system execution is not proven |
| Performance/obligations | operational owner, finance, procurement | spreadsheets, Jira, calendars, ERP | obligations lack a live owner, evidence or escalation path | obligation extraction/tracking exists |
| Amendment/change order | business owner, legal, finance | email, Word, CRM, project tools | amendments are detached from the parent agreement and operational state | versions/snapshots exist; entity-centric agreement families need evidence |
| Renewal/termination | account owner, procurement, finance, legal | calendars, CRM, spreadsheets | notice windows missed; stale pricing and auto-renewal surprise | renewal dashboard/alerts exist |
| Audit/dispute/archive | legal, finance, compliance | repository, exports, eDiscovery | evidence is scattered and context is lost | activity, versions and exports exist |

## 3. Segment split

### Solo and very small teams

They often use Word, Drive, email, calendar and a spreadsheet. The cost of a full CLM is hard to justify unless contract volume or a missed renewal has already caused a material loss. Their need is usually a reliable register, search and reminders, not a six-phase platform.

### Small and lower mid-market teams

They have enough contracts for ownership and renewal errors to matter, but not enough legal operations staff to absorb a long implementation. They want to keep Word, email, CRM and existing storage. This is the most plausible Aakd segment, but it is also where lightweight competitors and free Microsoft tooling are strongest.

### Mid-market teams

They need cross-functional intake, approvals, agreement families, integrations and reporting. Community evidence repeatedly describes implementation cost, poor adoption and user bypass. A new broad CLM would face a long sales cycle and an incumbent replacement problem.

### Enterprise

They buy governance, security, workflow configuration, migration, integrations, support and procurement assurance. Pain is real, but the sale is services-heavy and competitors already have large implementation ecosystems. This is not an appropriate first segment for Aakd without a named access advantage.

## 4. Evidence ledger

### Repeated facts

1. A medium-sized IT-services company reported high license cost, insufficient seats, clunky legal review, slow support, persistent adoption problems and an unrealistic AI quote after a CLM rollout. [Reddit discussion](https://www.reddit.com/r/legaltech/comments/1nbm01z/build_vs_buy_for_clm_we_tried_vendor_thinking/)
2. A legal team reported requests arriving through DocuSign, email, Teams, phone and text, with poor workload visibility and third-party remediation. [Reddit discussion](https://www.reddit.com/r/legaltech/comments/1n7f57/diving_into_legaltech/)
3. A practitioner described sales, obligations and finance data living in separate systems, with Excel and OneNote used for the contract calendar and summaries. [Reddit discussion](https://www.reddit.com/r/ContractManagement/comments/1n5s564/cm_software_2025/)
4. A maintenance-contract manager reported using a spreadsheet for hundreds of low-value renewals because existing systems were either asset-centric or too deep for the daily job. [Reddit discussion](https://www.reddit.com/r/ContractManagement/comments/1ok6jbr/maintenance_contract_management/)
5. A small UK company reported missed cancellation windows and paying for unused services because its contract register was incomplete. [Reddit discussion](https://www.reddit.com/r/smallbusinessuk/comments/1l07rv6/contract_management_system_for_sme/)
6. A CLM practitioner said adoption falls when legal alone drives implementation, while missing integrations create duplicate entry and data silos. [Survey/report](https://cdnc.heyzine.com/files/uploaded/v3/cd901d5c85451ab5ab37da813a6f7f6a53fdfa70-3.pdf)

### What these facts do not prove

- They do not prove that a new repository, reminder tool or AI contract chatbot is unowned.
- They do not prove standalone software willingness to pay for post-signature execution.
- They do not prove that an SMB can onboard without configuration, migration or support.
- They do not prove that one buyer owns legal, finance, procurement and operational obligations together.

## 5. Competitive reality

- **Ironclad** covers request-to-renewal workflows, repository, AI extraction and integrations, and explicitly sells implementation partners and customer success. [Official pricing/product page](https://ironcladapp.com/pricing)
- **SpotDraft** covers creation, e-signature, automated workflows, repository metadata extraction, integrations, migration and included implementation/support. [Official product/pricing](https://www.spotdraft.com/pricing)
- **PandaDoc** covers create, collaborate, approve, sign, track and CRM integrations, with 68,000+ customers publicly claimed. [Official product page](https://www.pandadoc.com/contract-management-software/)
- **Contractbook** publishes a lower-end path: free trial, Essential for solo operators, Centralize and Accelerate for growing teams, with templates, extraction, reminders, automations and integrations. Its public Centralize and Accelerate prices are $399 and $599 per month billed annually. [Official pricing](https://contractbook.com/pricing)
- **Juro** markets end-to-end contract management, integrations and AI, but uses sales-led pricing. [Pricing explanation](https://juro.com/learn/contract-management-software-pricing-cost)
- **DocuSign CLM, Icertis, LinkSquares, Evisort, Agiloft, Malbek and Sirion** cover enterprise or upper-midmarket repository, workflow, obligations, analytics, integrations and services. Public pricing is generally custom, which itself creates a buyer friction signal but not an unserved outcome.
- **ContractSafe** is a direct SMB/midmarket counterexample to the idea that affordable basics are missing: it publishes $299/month Basic, $499/month Standard and $699/month Professional annual prices, unlimited users, OCR search, reminders, permissions, amendments and optional AI. Its higher tiers add approvals, e-sign, SSO, VDR and Zapier. [Official pricing/features](https://www.contractsafe.com/software-easy-light)
- **Tenivo** is a newer focused product explicitly positioned around post-signature obligations, owners, due dates, notice windows and email alerts for small legal, ops and procurement teams. This validates the problem framing but also means a generic obligations-only wedge is already being pursued. [Product page](https://tenivo.net/)
- **Wraft, Documenso, DocuSeal and other open-source projects** reduce license cost and improve self-hosting, but do not by themselves prove a paid market for a new broad CLM.

## 6. Current hypotheses

### H1: Broad open-source AI CLM

Rejected as a build thesis for now. Aakd already implements most of the expected surface, and the category has many credible specialists. Open source is a deployment and trust advantage, not an outcome customers automatically pay for.

### H2: Lightweight repository plus renewal reminders

Rejected as insufficiently differentiated. The problem is real and already addressed by Contractbook, ContractSafe-style tools, spreadsheets plus calendars, and full CLMs.

### H3: Cross-system post-signature execution

Admit only for interviews and paid falsification. Precise hypothesis: ingest executed contracts from an existing folder/export, produce cited obligations, notice windows, owners and evidence requests, then push an approval-gated action list into the tools the team already uses. The product would not replace the CLM, CRM, ERP or Jira.

Unknowns that must be tested: who pays, whether data exports are usable, whether the same buyer repeats the job, whether existing CLMs or consultants already solve it, and whether liability makes software-only delivery unacceptable.

## 7. Decision gates before changing Aakd

Do not build a new wedge unless all are demonstrated:

1. Five independent organizations report the same recent episode, not a generic complaint.
2. Two economic owners participate and confirm the budget path.
3. Three paid workarounds or comparable purchases exist.
4. The proposed outcome is not native to the current CLM or two credible specialists.
5. A real 25-contract corpus produces a useful first result in one business day.
6. At least two organizations pay for the same narrow pilot.
7. At least two paying organizations repeat the workflow on a second cycle.
8. Delivery stays within two founder-hours per 25 contracts after correction.
9. A reachable channel can produce ten qualified prospects without paid lists or mass outreach.
10. A bottom-up model supports €1M ARR with observed price, retention and reachable-account assumptions.

## 8. Current recommendation

Continue research only around H3. Keep the broad Aakd CLM on hold as a product strategy. The next action is not more feature development. It is ten interviews with small and lower-midmarket service companies plus CLM implementation partners, followed by three real, redacted contract corpora and a fixed-price diagnostic. If there are no two prepayments and no repeat trigger, close the wedge and do not expand Aakd based on generic AI or open-source positioning.
