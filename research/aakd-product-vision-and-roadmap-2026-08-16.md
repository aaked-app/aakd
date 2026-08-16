# Aakd product vision and evidence-gated roadmap

**Date:** 2026-08-16
**Status:** Founder-approved strategic direction; evidence-gated execution roadmap, revision 2
**Decision standard:** Facts, hypotheses and unknowns are kept separate. Every major choice includes alternatives, counterarguments and an invalidation condition.

## 1. Executive decision

Aakd should be built boldly as a full, professional, open-source CLM and, over time, an Agreement Operations platform. Its product ambition is broad. Its first successful user journey and market-entry message must remain sharp.

The proposed long-term category is an **open agreement operations platform**:

> Aakd turns agreements from static documents into trusted, cited and executable operational systems, while letting organizations control their data, deployment and tools.

The proposed entry promise is narrower:

> Upload executed agreements and see the next actions, owners, deadlines and evidence—with every result linked to the exact source.

This separates two decisions that the first draft mixed too closely:

- **Product scope:** a complete professional OSS CLM with agreement intelligence, safe automation and progressive enterprise depth.
- **Entry motion:** one understandable cited-action experience that reaches value quickly and can coexist with existing tools.

This resolves an apparent contradiction:

- The existing authoring, negotiation, approval, signing, repository, search, obligation and integration capabilities remain part of one professional CLM.
- The default experience exposes one understandable job first and reveals advanced lifecycle capabilities only when needed.
- The first commercial test does not require a company to replace Word, Drive, SharePoint, its CRM, its task system or an existing CLM.
- Agreement relationships, reviewed facts, owned actions and secure extensibility are long-term foundations and may be built while demand is validated.
- A contract-native recipe engine becomes a platform layer after its primitives stabilize. A generic visual canvas is not the first product because n8n and Power Automate already excel at generic orchestration.
- Customer evidence selects the first buyer, message, recipes and commercial priorities. It does not give small or unproven competitors veto power over Aakd's architecture.

**CEO confidence:** moderate in the direction; low in the initial paid ICP. The product thesis is coherent, but buyer, willingness to pay, repeat use and Cloud preference remain unvalidated.

## 2. Premise challenge

### Premise A: “Building the full idea now is fast, OSS and therefore low-risk.”

**Pushback:** Engineering speed reduces the cost of writing code, not the costs of product complexity, security exposure, documentation, migration, support, cognitive load or maintaining two commercial editions. Aakd already has 102 API routes, 36 application pages, 37 Prisma models and broad lifecycle coverage. Its constraint is focus and adoption, not lack of surface area.

**Alternative explanations:**

1. The market needs a better full CLM.
2. The market has enough CLMs, but implementations fail because processes, ownership and integrations are weak.
3. The contract itself is modeled incorrectly—as a file or workflow record instead of a changing set of rights, commitments and evidence.

**Choice:** Design from explanation 3, build the shared agreement/fact/action foundations, enter through a narrow workflow, and treat explanation 2 as a major UX and implementation constraint. Freeze random feature accumulation—not the platform ambition. Do not assume that more product can repair an organization with no process owner.

**Invalidation:** If paid users consistently want a clean incumbent replacement and reject an overlay/import-first path, the entry strategy should change.

### Premise B: “Easy to use is our USP.”

**Pushback:** Every competitor can claim easy. Ease is a property of a specific user completing a specific job under specific constraints.

**Operational definition:**

- a clean installation reaches a healthy demo without outside help;
- a new workspace reaches one useful, cited action in under ten minutes;
- the first workflow requires no consultant and no blank-canvas configuration;
- a non-legal operator can explain the result, source and next step;
- advanced capabilities can be adopted without migrating to a different edition or data model;
- errors, uncertainty and missing configuration produce recoverable states.

**Choice:** Make progressive disclosure, recipes, contextual advanced tools and measurable activation the ease-of-use strategy.

**Invalidation:** If observed users still need guided implementation for the first job, “easy” is false and onboarding must be redesigned before adding features.

### Premise C: “Open source and GitHub stars will create community, credibility and Cloud revenue.”

**Pushback:** These are three different outcomes. A star expresses interest, not a deployment, retained user, buyer or contributor. Aakd currently has 8 public stars and 2 forks. Papermark, Documenso and Twenty demonstrate that an OSS application can create distribution, but each offers a highly legible job, self-service activation and a managed product. Their outcomes do not prove the same funnel for legal/operations buyers.

**Choice:** Treat OSS as a product and trust channel. Measure clone-to-value, active installations, upgrades, external contributions and qualified commercial leads separately from stars.

**Invalidation:** If technical adoption produces no retained organizations, useful contributions or commercial introductions after a sustained release program, GitHub should remain a trust surface rather than the primary GTM engine.

### Premise D: “No one owns contract workflows yet.”

**Pushback:** Ironclad, Icertis, Sirion, Agiloft, SpotDraft and others sell configurable contract workflows. n8n and Power Automate can orchestrate generic work. ContractSafe and focused products manage obligations. Gartner describes the broad enterprise CLM category as saturated with similar solutions. This does **not** establish that the professional, easy, production-grade OSS/self-hosted CLM and Agreement Operations position is commercially owned.

**Choice:** Compete for that open position. The thesis is **a complete OSS CLM with contract-native, source-grounded execution and safe progressive configurability**: agreement precedence, reviewed facts, conditional rights and commitments, owners, approvals, completion evidence and traceability. Cited actions are the front door, not the product ceiling.

**Invalidation:** Reconsider the entry wedge only if a commercially credible Tier 4–5 competitor repeatedly delivers the same compound to Aakd's target segment with comparable activation, openness and deployment control—or target users regard the outcome as commodity. Tier 1–2 projects constrain novelty language but do not constrain product ambition.

## 3. First-principles model of a contract

A contract is not primarily a PDF, a signature event or an approval flow. It is a versioned agreement that creates conditional rights, commitments, constraints, deadlines and decision authority between parties.

The root jobs are therefore:

1. **Reach an acceptable agreement:** collect context, draft, negotiate, approve and sign.
2. **Know the governing truth:** identify the active terms across MSA, SOW, order form, DPA, amendment and renewal.
3. **Act correctly over time:** turn terms and events into owned actions, decisions, notices and escalations.
4. **Prove what happened:** retain source, review, approval, delivery and completion evidence.
5. **Change safely:** incorporate amendments and real-world events without losing history or silently changing canonical truth.

This yields six product primitives:

- **Source:** immutable agreement documents and exact excerpts.
- **Agreement graph:** relationships, precedence, effective periods and supersession.
- **Fact ledger:** extracted or entered facts with source, confidence, reviewer and history.
- **Action ledger:** commitments, rights, triggers, owners, deadlines, approvals and evidence.
- **Recipe engine:** contract-native triggers, conditions and safe actions.
- **Interfaces:** a simple human workspace plus API, webhooks, CLI and MCP for controlled machine use.

AI is a compiler and assistant over these primitives, not the system of record and not autonomous legal authority.

## 4. Evidence ledger

### What is supported

- Public practitioners report fragmented contract data across internal systems, Excel, calendars and notes; missed renewals; manual follow-up; poor CLM adoption; implementation friction; and tools that are too deep for the daily job. The detailed source ledger is in [the Cloud ICP report](aakd-cloud-icp-evidence-2026-08-16.md).
- Very small startups can have scattered agreements while still rejecting a broad CLM as too heavy. This is counterevidence against “all startups” as the ICP.
- CLM demand is established at larger companies: the 2025 ACC CLO survey included 772 CLOs; 44% planned new legal technology and contract management was the most frequently cited initiative among them at 62%. This supports category demand, not Aakd’s beachhead. [ACC](https://www.acc.com/about/newsroom/news/risk-compliance-data-privacy-and-regulatory-changes-named-top-concerns-global)
- CLM implementation is a cross-functional change problem; inherited systems often face stalled rollouts, workarounds and adoption problems. ACC recommends starting with specific users or use cases and assessing application switching. [ACC implementation guidance](https://www.acc.com/resource-library/unmuck-your-contract-lifecycle-management-clm-implementation)
- Gartner’s 2025 summary calls the CLM market saturated with similar solutions and evaluates vendors across pre-signature, post-signature and full-lifecycle use cases. [Gartner critical capabilities](https://www.gartner.com/en/documents/7180730)
- Incumbent implementation friction is material even by vendor-authored evidence: Ironclad reports 178 days in 2025 to launch the first ten workflows and says organizations commonly need about six months to meaningful value. Its market guide estimates $15,000–$150,000 annual mid-market cost, with implementation potentially adding $5,000–$100,000+. These are Ironclad's estimates, not neutral market measurements. [Ironclad build-versus-buy](https://ironcladapp.com/resources/articles/build-vs-buy-clm), [Ironclad cost guide](https://ironcladapp.com/journal/contract-management/how-much-does-contract-management-software-cost)
- WorldCC reports average value loss of almost 9% through poor contract management, versus about 3% for top performers. This is broad industry evidence, not a forecast of Aakd ROI. [WorldCC](https://www.worldcc.com/Portals/IACCM/Reports/Contract%20Management%20Whitepaper.pdf?ver=NvhPCtNb8a12OB24GSCC0A%3D%3D)
- Aakd already implements a broad CLM surface: ingestion/OCR, cited Q&A, extraction, repository/search, authoring/redlining, approvals, signing, obligations, renewals, notifications, imports, CRM, API and MCP.
- Conceptual overlap is real but market ownership is not. [Agreement Graph](https://agreementgraph.com/) explicitly calls itself a research project and says its repository is forthcoming. [draftLegal](https://github.com/AniketTati/draft-legal) is a genuine early repository and demo, but had 13 stars, 7 forks and no verified customers on 2026-08-16. [OpenCLM](https://openclm.ai/) makes broad AGPL/full-CLM claims, but its advertised GitHub repository returned 404 on 2026-08-16 and no users or customers were verified. These projects invalidate “nobody has conceived this,” not “the category is available to win.”
- The commercially credible competitors are different: Ironclad reports 2,277+ customers and more than $200M ARR; Icertis reports more than $250M ARR and significant Fortune Global 500 penetration; Sirion reports 200+ customers; LinkSquares reports 1,300 teams; SpotDraft reports hundreds of organizations and substantial funding. These are vendor claims but sufficient to establish real enterprise or mid-market execution capability. They do not establish ownership of the OSS/self-hosted position.
- A cited fact/action system is also occupied in parts: Icertis and Sirion manage obligations and evidence; SpotDraft turns AI-extracted obligations into reviewed tasks; ContractSafe links extracted terms to source and alerts; LinkSquares models parent-child agreement hierarchies and governing summaries. A generic obligation dashboard, agreement graph or citation badge is not differentiation.
- Open-source applications can monetize managed hosting and enterprise control. Papermark publicly offers hosted plans and enterprise self-hosting; Documenso offers AGPL core plus hosted and licensed enterprise deployments; Twenty offers managed Cloud, free self-hosting and paid organization/enterprise controls. [Papermark pricing](https://www.papermark.com/pricing), [Documenso pricing](https://documenso.com/pricing), [Twenty pricing](https://twenty.com/pricing)

### What remains inferred

- A lower-midmarket post-signature overlay is a better entry than full replacement.
- Agreement-family precedence and completion evidence create meaningful differentiation.
- Technical operators will discover Aakd on GitHub and introduce it to contract owners.
- The same organization that values self-hosting will later buy managed Cloud or enterprise licensing.

### What remains unknown

- The first repeatable economic buyer and buying event.
- Contract volume, company size and workflow complexity at which pain becomes budget.
- Whether action-ledger usage repeats after the initial diagnostic.
- Whether buyers prefer multi-tenant Cloud, isolated managed deployment or self-hosting.
- The acceptable accuracy, correction effort, implementation effort and liability allocation.
- Whether Aakd can reach the buyer through an OSS channel at an economical rate.

## 5. Product strategy alternatives

Scores are 1–5. They are decision aids, not market measurements.

| Strategy | Pain clarity | Fit with current assets | Differentiation potential | Adoption friction | OSS pull | Cloud economics | Focus | Weighted view |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Full incumbent-replacement CLM as the entry motion | 4 | 5 | 2 | 1 | 3 | 4 | 1 | 2.8 |
| Generic “n8n for contracts” | 3 | 3 | 2 | 2 | 4 | 4 | 2 | 2.8 |
| Lightweight repository and reminders | 4 | 5 | 1 | 5 | 3 | 2 | 4 | 3.6 |
| Developer-first contract intelligence API/MCP | 3 | 4 | 4 | 3 | 5 | 3 | 4 | 3.7 |
| Full OSS Agreement Operations product with action-first entry | 4 | 5 | 4 | 4 | 5 | 4 | 4 | **4.4** |

### Why the selected strategy wins

It uses what Aakd has, avoids an immediate rip-and-replace sale, provides a simple demonstrable job, creates developer-facing extension points and explicitly commits to a complete CLM and Agreement Operations platform. The entry motion is narrow; the architecture is not.

### Counterargument

“Overlay” products can become thin features that incumbents copy, and cross-system integration may be harder than replacing one workflow. The defense cannot be the dashboard. It must be a trusted agreement/fact/action data model, deployment control, open extensibility and superior activation.

### Invalidation

Reject or revise the **cited-action wedge** if qualified organizations say their current tools already generate trustworthy, cited and owned actions; if no one repeats the workflow; or if integrations require services-heavy customization that destroys the economics. This result should redirect the first journey toward governing truth, developer infrastructure or another observed job; it should not automatically invalidate the shared agreement/fact/action platform.

### Provisional white-space hypotheses—not uniqueness claims

1. **Production OSS agreement-execution substrate:** relationship-aware governing truth, reviewed exact-source facts, deterministic controls, operational actions and completion evidence in one maintained system.
2. **Progressive-complexity CLM:** a no-consultant first result with professional depth revealed only when the user's job requires it.
3. **Portable contract truth layer:** reviewed agreement state exposed to existing systems through API, events and MCP without forcing repository migration.
4. **Open, testable trust architecture:** public extraction benchmarks, provenance rules, permission tests, correction propagation and agent-action gates.

Each is already partially occupied. Aakd's opportunity, if one exists, is the quality of the compound and the speed at which users obtain value.

### Competitor evidence policy

Competitors affect strategy according to verified maturity, not the quality of their copy:

| Tier | Evidence | Strategic treatment |
|---|---|---|
| 1 | Landing page or unverified claims | Ignore commercially; never block scope |
| 2 | Inspectable prototype or very early product | Watch concepts and execution monthly |
| 3 | Independent active-user or meaningful developer-adoption evidence | Evaluate hands-on; consider interoperability |
| 4 | Paying-customer, funding or credible commercial evidence | Benchmark product and GTM actively |
| 5 | Repeatable distribution, material revenue or enterprise capability | Treat as a serious competitor or substitute |

Current classification as of 2026-08-16:

- **Ignore commercially/watch lightly:** OpenCLM (Tier 1), Agreement Graph and Tenivo (Tier 2).
- **Watch as a direct early OSS peer:** draftLegal (Tier 2).
- **Learn from or interoperate with:** OpenContracts and Accord Project (Tier 3 infrastructure/standards), Papermark and Documenso (commercial-OSS analogues), n8n and Microsoft (Tier 5 workflow substitutes).
- **Benchmark actively:** ContractSafe, SpotDraft, Juro and LinkSquares (Tier 4–5 simpler/mid-market competitors).
- **Respect as enterprise incumbents:** Ironclad, Icertis, Sirion, Agiloft, DocuSign and Workday/Evisort (Tier 5).

Review this classification quarterly and after material funding, customer, repository or product evidence. Absence of public evidence means “unknown,” not “zero customers.”

## 6. Target market architecture

There is no validated ICP yet. Use distinct hypotheses rather than one vague “startup” audience.

### Paid beachhead hypothesis

**Organization:** 50–500 employee B2B service, software or technical organization with roughly 100–2,000 active customer and vendor agreements; recurring MSAs/SOWs/order forms/amendments; no mature legal-operations function; and contracts spread across Drive/SharePoint, CRM, e-signature and spreadsheets.

**Trigger:** a missed notice, unowned commitment, customer escalation, audit request, acquisition, new contract owner or rapid increase in contract volume.

**User:** contract manager, procurement/finance operations, commercial operations or service-delivery operator.

**Champion:** legal operations, commercial operations, procurement or finance operations.

**Economic buyer:** COO, GC, CPO or finance leader depending on the incident. This must be discovered, not assigned by assumption.

**Disqualifiers:** six-person teams with ~15 agreements; organizations wanting only AI legal review; enterprises requiring immediate global CLM replacement; MSPs whose PSA already closes the workflow; and buyers without a recent costly episode or repeatable contract portfolio.

### OSS adoption hypothesis

Technical operators, self-hosters, legal-tech builders, implementation partners and privacy-sensitive teams adopt a useful local contract workflow, contribute connectors/extractors/translations and create credibility.

This audience is not automatically the Cloud buyer. Its funnel and metrics stay separate.

### Enterprise expansion hypothesis

Larger organizations buy managed isolation, controls, assurance, support, migration and governance after Aakd proves a narrow workflow. Enterprise is an expansion path, not the first product specification.

## 7. Product principles

1. **Action before administration.** The first screen answers what needs attention and why.
2. **Source before assertion.** Important facts and AI outputs preserve exact source, location, confidence and review state.
3. **Recipes before canvas.** A user starts from a proven outcome, then progressively configures it.
4. **One product, progressive complexity.** Do not create a toy SMB fork and a separate enterprise product.
5. **Coexist before replace.** Import from and route to existing tools before asking for migration.
6. **Human authority is explicit.** AI may suggest, extract and route; people approve canonical facts, legal decisions and high-impact actions.
7. **Secure defaults are OSS.** Tenant isolation, safe file handling, audit activity, permission checks and secrets hygiene are not paid add-ons.
8. **Enterprise assurance is paid.** Managed operations, SSO/SCIM, advanced policy, deployment options, audit export, data residency, SLA and evidence-backed compliance belong in commercial offerings.
9. **Truthful status beats roadmap theatre.** Stable, experimental, planned and unsupported are visibly different.
10. **Every major feature earns a repeated job.** No workflow primitive, connector or agent is built solely because it demos well.

## 8. Product architecture and experience

### Default experience

```text
Upload or import agreement
        ↓
Review cited facts and uncertainty
        ↓
Confirm agreement relationships
        ↓
See owned actions, deadlines and rights
        ↓
Route or complete with evidence
        ↓
Return when an event, amendment or deadline changes state
```

Primary navigation should initially emphasize:

- **Attention:** review, assignment, notice, obligation and evidence queues.
- **Agreements:** relationship-centric portfolio rather than disconnected files.
- **Search:** exact and semantic discovery with source grounding.
- **Recipes:** outcome templates once validated.
- **Settings:** deployment, AI, integrations, people and policies.

Authoring, templates, redlining, approvals, signing, analytics, imports, CRM and agent access remain available contextually or in an advanced workspace.

### Agreement graph

Models MSA, SOW, order form, DPA, amendment, renewal and supporting documents; captures parent/child relationships, precedence, effective dates and supersession. It answers “what governs now?”

**Alternative:** folders and tags. They are simpler but cannot safely express precedence or changing terms.
**Gate:** do not deepen the graph until at least three real corpora contain meaningful agreement-family conflicts.

### Fact ledger

Every consequential field stores value, source excerpt, source page/location, extraction method, confidence, review status, reviewer and history. Deterministic parsing can be used where reliable; AI handles ambiguous language; humans establish canonical truth.

**Alternative:** raw LLM answers. Faster to demo, but weak for audit and downstream automation.
**Gate:** accepted-fact rate and correction effort must support the target workflow.

### Action ledger

Unifies obligations, rights, renewal/termination windows, approvals and evidence requests. An item contains trigger, condition, responsible person, accountable organization, due/notice date, citation, review state, escalation and completion evidence.

**Alternative:** reminders. Easier, but a reminder does not establish ownership or prove completion.
**Gate:** two organizations must complete actions and return for a second cycle.

### Contract-native recipe engine

The proposed engine uses constrained primitives:

- triggers: agreement signed, fact confirmed, date approaching, event received, amendment effective;
- conditions: agreement type, value, clause/fact, jurisdiction, confidence, owner, state;
- actions: request review, assign, notify, create task/calendar event, update approved external field, collect evidence, escalate;
- controls: permissions, human approval, idempotency, retries, immutable activity and test/simulation mode.

Users start from recipes such as vendor renewal, customer SOW handoff or DPA review. A visual canvas comes only after the primitives and recipes are proven.

**Alternative 1:** embed n8n. Fast and broad, but weakens the contract data model and splits security/UX.
**Alternative 2:** build a blank canvas immediately. Visually compelling, but recreates enterprise configuration burden.
**Choice:** integrate with n8n/Power Automate at the boundary; own contract-native state and guarded recipes inside Aakd.
**Gate:** build general composition only after at least three recipes repeat across five organizations and users attempt meaningful variations.

### AI agents

Agents operate only through permissioned tools over reviewed facts and state. They may prepare a notice, summarize change impact, propose owners or simulate a recipe. They may not silently change canonical facts, give unreviewed legal advice, send binding notices or complete material obligations.

**Gate:** each agent needs a named job, evaluation corpus, source-grounding threshold, human approval point, audit record and safe failure state.

## 9. OSS, community and commercial model

### OSS core: useful forever

- full single-organization agreement repository;
- ingestion, OCR and manual workflows;
- BYOK/local AI extraction and cited review;
- agreement/fact/action primitives;
- core recipes and local notifications;
- API, webhooks, MCP and export;
- secure tenant model, audit activity and backup documentation;
- extension SDK, sample corpus and evaluation harness.

### Managed Cloud: zero-operations value

- operated deployment, upgrades, backups, restore testing and observability;
- managed storage, queues, email and optional managed AI;
- guided import and migration;
- support and predictable reliability;
- transparent usage and cost controls.

### Enterprise Cloud or licensed self-hosted

- SSO/OIDC/SAML and SCIM;
- advanced roles, policy and segregation of duties;
- audit export, retention, legal hold and administrative evidence;
- regional or single-tenant deployment, customer-managed keys and private connectivity where demand supports them;
- SLA, incident process, security reviews and priority support;
- commercial licensing for embedding, white-labeling or managed redistribution.

### Monetization choice

Use **AGPL core + managed Cloud + paid enterprise controls/support + commercial license for redistribution**. Do not rely primarily on support services and do not cripple the community edition.

**Counterargument:** Open-core boundaries can create community resentment.
**Mitigation:** publish a durable feature-placement policy. Features required for a safe, useful single organization remain open; features whose value comes from Aakd operating infrastructure or satisfying organization-wide governance may be paid.

### Community growth system

The shareable artifact should be a reproducible result, not a feature list:

1. one-command healthy demo with synthetic agreements and no external AI key;
2. a short upload-to-cited-action demonstration;
3. a public multilingual contract corpus with expected facts/actions;
4. an extraction/citation benchmark with honest error reporting;
5. small extension surfaces for parsers, recipes, connectors and translations;
6. maintained release notes, support matrix, architecture and upgrade guides;
7. public security policy and responsible disclosure;
8. community examples that solve a real contract job.

Stars remain a reach metric. Activation, retention, contribution and commercial qualification are outcome metrics.

## 10. Roadmap

Dates are directional; gates control progression.

### Execution model — build and validate in parallel

The roadmap runs three controlled lanes:

1. **Product foundation:** reliability, security, progressive UX and the agreement/fact/action model that the long-term platform needs.
2. **Market evidence:** test the first journey, ICP, buyer, price, repeat use and Cloud preference.
3. **Distribution and commercial operations:** make OSS independently adoptable and prepare managed Cloud without claiming it before it is operable.

Evidence may reorder journeys, recipes, integrations and GTM. It does not halt all foundational product work. Random feature accumulation remains frozen.

### Phase 0 — Truth, safety, activation and evidence (0–6 weeks)

**Outcome:** a trustworthy product surface and evidence package.

- reconcile public and local claims; mark stable/experimental/planned/unsupported;
- simplify navigation and contract-first onboarding without deleting advanced capability;
- verify previously reported security fixes and establish a release security checklist;
- measure workspace creation, healthy install, first upload, first review, first action and return;
- run the fixed-scope Contract Action Diagnostic with qualified organizations;
- create the synthetic demo corpus and expected result.
- compare three wedges on the same representative corpora: relationship-aware governing truth, cited obligation-to-action execution, and progressive no-migration recipes;
- maintain only a lightweight competitor watch; perform deep evaluation when a project reaches Tier 3 or its claims are needed in public comparisons.

**Product gate:** clean installation and synthetic first action in under ten minutes; truthful feature status; no release-blocking security issue; reliable upload/extraction/recovery path.

**Market gate:** five independent organizations report the same recent episode; three provide representative corpora; two economic owners prepay the same narrow pilot.

**Kill condition:** after 20 qualified conversations, no two prepayments or no repeated problem pattern kills that wedge/segment/message. Record the evidence and test the next observed journey; do not kill the platform solely from a failed wedge.

### Phase 1 — Simple professional core and first useful action (weeks 3–12)

**Outcome:** one real agreement becomes one reviewed, owned action in under ten minutes.

- unify the default obligations/renewals experience into an action view using existing models where possible;
- add cited review and explicit uncertainty to consequential extracted data;
- deliver one reviewable output to email/calendar/task tooling;
- test an operated private beta using the same core product;
- offer self-hosted and managed deployment honestly and record why users choose each.
- keep authoring, approvals, signing, imports and integrations available progressively instead of presenting them as separate competing products;
- publish a clear stable/experimental/planned capability matrix and upgrade path.

**Gate:** at least 70% of qualified test contracts yield one accepted action; median first-action time under ten minutes for the supported path; two organizations complete and repeat the workflow; two qualified organizations prefer and can fund managed operation.

**Kill condition:** correction/support above two founder-hours per 25 contracts, incumbent adequacy or weak repeat use kills the cited-action **entry hypothesis**. The product lane continues only on primitives reused by another validated journey.

### Phase 2 — Agreement intelligence foundation (months 2–6)

**Outcome:** Aakd knows which terms govern and how reviewed facts change.

- agreement-family graph and precedence;
- versioned fact ledger and correction history;
- rights, conditions and completion evidence in the action model;
- relationship-centric contract brief;
- safe imports from one proven system of record.

**Build rule:** implement the minimal extensible relationship/fact/action primitives while Phase 1 evidence is collected; avoid speculative industry schemas and broad graph visualization.

**Gate:** three real corpora need agreement precedence; reviewed outputs achieve the workflow-specific quality target; support effort falls rather than rises; retained organizations use a second agreement family. If precedence is rare, keep the relationship model simple rather than removing the platform direction.

### Phase 3 — Contract-native recipes and extensibility (months 4–9)

**Outcome:** repeated contract work can be adapted without consulting-heavy implementation.

- three proven contract-native recipes;
- trigger/condition/action/approval primitives;
- dry-run, idempotency, retry, permission and audit behavior;
- boundary integrations with n8n, Power Automate or task systems;
- recipe packaging and contribution format.
- stable domain events, APIs and MCP tools so advanced users can integrate without waiting for the visual builder.

**Gate:** three recipes repeat across five organizations; at least three customers modify a recipe successfully without founder intervention; workflow errors are observable and recoverable.

### Phase 4 — Managed Cloud beta in parallel; GA after retention (beta months 3–6)

**Outcome:** customers buy an operated result, not hosting alone.

- automated provisioning, upgrades, backups and restore verification;
- billing, quotas, observability, support and incident operations;
- data boundary, retention, deletion, subprocessors and DPA;
- migration path between community, Cloud and licensed deployments.

Cloud beta may begin as soon as the secure, reliable core is operable. It does not wait for every platform feature. General availability remains gated by production controls and retention.

**Gate:** ten paying organizations, target gross margin, three-month logo retention signal, bounded onboarding/support and no unresolved critical control gap. Exact thresholds are set from observed costs before GA.

### Phase 5 — Enterprise assurance and expansion (9–18 months)

**Outcome:** validated larger buyers can approve and govern Aakd.

- identity lifecycle, advanced roles and segregation of duties;
- audit/export, retention and administration;
- deployment isolation and key-management choices supported by deals;
- formal control program, independent testing and evidence-backed compliance roadmap;
- migration and implementation partner playbook.

**Gate:** three qualified enterprise opportunities request the same control, two have budget and timeline, and the control is not being built only to satisfy a hypothetical checklist.

### Phase 6 — Agreement operations ecosystem (begin months 6–12; expand thereafter)

**Outcome:** external builders expand Aakd without weakening trust.

- stable extension contracts for extractors, recipes, connectors and agents;
- registry and review/signing policy for extensions;
- SDK/CLI and developer documentation;
- partner and commercial-license model;
- domain packs only where maintained by real users or partners.

**Gate:** repeat external contributions, maintained third-party extensions, active installs and partner-originated qualified opportunities.

### Roadmap governance

Review monthly:

- activation, correction burden, repeat usage and support effort;
- validated workflow episodes, buyer evidence and payment;
- security and reliability findings;
- OSS installs, upgrades and substantive contributions;
- Cloud preference and operating cost.

Review quarterly:

- competitor maturity tiers;
- product/ICP/Cloud hypotheses;
- roadmap ordering and non-goals;
- whether a failed gate invalidates a wedge, a feature, a segment or the platform thesis. Never escalate a local failure into a company-level pivot without stating the causal link.

## 11. Metrics tree

### North-star outcome

**Monthly verified contract actions completed with source evidence by retained organizations.**

This measures operational value better than documents uploaded, AI questions or stars.

### Activation

- clean install to healthy demo;
- signup to first real upload;
- upload to first reviewed fact;
- first reviewed fact to assigned action;
- time to first useful action.

### Trust and quality

- accepted-fact/action rate;
- correction rate and correction time;
- source coverage and citation validity;
- high-impact actions requiring human review;
- security findings by severity and remediation time;
- backup restore success and incident indicators for Cloud.

### Retention and value

- second-session and second-cycle rate;
- organizations completing actions monthly;
- repeated agreement families and recipes;
- avoided loss, recovered right, cycle-time or audit-effort evidence where customers can measure it.

### OSS health

- clone/install-to-healthy-demo conversion;
- active version check-ins where privacy-safe and opt-in;
- external issue reporters, PR authors and maintained extensions;
- release adoption and upgrade success;
- stars and forks as reach, never as the primary outcome.

**Early falsification threshold:** after a reliable narrow demo and a sustained 90-day launch program, fewer than ten independently activated installations and fewer than three substantive external contributions would force a revision of the community strategy. This is a proposed management threshold, not an industry benchmark.

### Commercial health

- qualified workflow-to-paid-pilot conversion;
- self-hosted/Cloud preference with reason;
- pilot-to-subscription and three-/six-month retention;
- onboarding/support minutes and gross margin;
- OSS-sourced qualified pipeline, not merely traffic.

## 12. Explicit non-goals until gates are met

- another generic contract chatbot;
- a blank-canvas workflow builder;
- autonomous legal decisions or notices;
- replacing Word, Drive, CRM, ERP, Jira or e-signature by default;
- more connectors without a repeated workflow;
- broad predictive analytics without retained operational data;
- enterprise certifications or claims before controls and evidence exist;
- a separate crippled “simple” product;
- a template marketplace before an active contributor/user base;
- pricing based only on competitor discounts rather than observed willingness to pay and cost.

## 13. Adversarial stress-test register

| Risk | Strongest objection | Current answer | What would fail the thesis |
|---|---|---|---|
| Market | Commercial CLM is crowded | Win the under-owned OSS/self-hosted position through a complete product and sharp activation journey | Tier 4–5 rivals deliver the same compound to the same segment more effectively |
| Product | The wedge is just ContractSafe obligations | Add governing agreement context, reviewed facts, safe routing and evidence | Focused incumbents deliver the same loop simply |
| Adoption | Users refuse another system | Coexist, import and route actions to current tools | Required daily use still causes bypass |
| Customization | Recipes cannot cover unique processes | Progressive configuration plus boundary integrations | Every customer needs bespoke code/services |
| Simplicity | Full feature set overwhelms users | Contextual advanced workspace and measured first job | First-job activation remains consultant-led |
| AI | Errors create legal/financial risk | citations, uncertainty, review, permissions and audit | Correction effort or serious error rate is unacceptable |
| Security | OSS/self-hosted is mistaken for secure | secure defaults plus verified controls and operational responsibility | Critical isolation or file-handling regressions recur |
| OSS | Community users do not buy | Separate adoption and commercial funnels | No contributors, active installs or qualified introductions |
| Cloud | Self-hosters prefer free operation | Sell zero-ops reliability and enterprise assurance to a different segment | Qualified buyers consistently reject managed operation |
| Defensibility | Incumbents copy the UI | Open agreement graph, correction/evaluation assets, ecosystem and deployment control | No compounding data/extension advantage appears |
| Scope | Maintaining a full CLM consumes the team | Freeze random expansion, preserve the full architecture and make advanced modules contextual | Core maintenance prevents foundation, activation and customer learning |
| Liability | Customers expect legal advice | Make decision authority and review boundaries explicit | Buyers require Aakd to assume unacceptable legal responsibility |

## 14. Founder decisions still required

These should be decided after reviewing the evidence, not before it:

1. **Company ambition and funding posture:** capital-efficient vertical business or venture-scale platform. This changes acceptable scope, speed and enterprise investment.
2. **Initial geography:** UK/EU, MENA or broader English-speaking market. This changes regulation, language advantage, buyer access and integration priorities.
3. **Managed deployment posture:** multi-tenant Cloud first, isolated deployments first, or both. The recommended default is a managed multi-tenant pilot plus isolated options only when paid demand justifies them.
4. **Feature-placement constitution:** which governance features remain open versus commercial. Decide and publish the rule before community scale.
5. **Validation authority:** whether the founder is willing to stop or redirect a favored wedge after the stated kill conditions while preserving reusable platform foundations. Without this distinction, gates either become theatre or cause unnecessary pivots.

## 15. Requirement audit

| Requirement | Status | Evidence or remaining work |
|---|---|---|
| Full product vision | PASS | Sections 1, 3, 6–9 |
| Multiple solutions from first principles | PASS | Sections 2, 5 and architecture alternatives |
| Pushback on every major thesis | PASS | Premise and stress-test registers |
| Existing research incorporated | PASS | ICP, customer-cycle, surgery, OSS and audit artifacts |
| Fresh research incorporated | PASS | Current ACC/Gartner/WorldCC, live OSS repos/pricing and current Aakd public state |
| Facts separated from hypotheses | PASS | Section 4 and ICP status |
| OSS/community and GitHub strategy | PASS | Section 9 and metrics |
| Cloud/enterprise revenue path | PASS AS HYPOTHESIS | Model defined; demand and economics unvalidated |
| Phased roadmap with gates and non-goals | PASS | Sections 10 and 12 |
| Competitor maturity separated from conceptual overlap | PASS | Competitor evidence policy and quarterly review |
| Validated ICP and willingness to pay | **UNKNOWN** | Requires real organizations and payment evidence |
| Verified repeat usage | **UNKNOWN** | Requires product/pilot observation |
| Enterprise security claim | **FAIL TODAY** | Architecture exists; formal controls, operations and independent evidence are not complete |

## 16. Immediate next action

Approve the north-star architecture and the build-and-validate execution model. Execute Phase 0 immediately, begin only the reusable Phase 1–2 foundations that improve reliability, activation and the agreement/fact/action model, and keep random feature expansion frozen. At the first monthly review, use evidence to reorder the entry journey—not to relitigate the company vision because a small project launched a landing page.
