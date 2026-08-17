# Aakd product constitution

**Status:** Founder direction and cross-team source of truth
**Owner:** Founder/CEO
**Version:** 1.0
**Last updated:** 2026-08-17
**Applies to:** product, engineering, GTM, UI/UX, research, security, documentation, community and partnerships

**Review trigger:** after a roadmap gate, material customer evidence, a founder-approved strategic change or a verified contradiction.
**Supersedes for product direction:** `research/aakd-product-vision-and-roadmap-2026-08-16.md`. That file and the other research artifacts remain supporting evidence, not competing strategy.

Read this document with `AGENTS.md` and `CLAUDE.md`. This file owns product direction; the other guides own implementation practice. If another plan conflicts with this document, surface the conflict instead of silently changing direction.

**Fast routing:** CEO/product uses Sections 1, 8, 14 and 15; engineering uses 2, 3, 7, 8 and 12; GTM/research uses 1, 4, 5, 10 and 13; UI/UX uses 6, 7 and 11; security uses 7 and 12; every discipline uses Sections 16–19.

### Change log

| Version | Decision |
|---|---|
| 1.0 | Consolidated the full OSS CLM vision, US/UK posture, validation ICP, gate-based roadmap, governed Agent Gateway, privacy/redaction, OSS/Cloud constitution and cross-discipline rules. |

## Executive snapshot

### What Aakd is

Aakd is a professional, open-source, self-hostable Contract Lifecycle Management platform evolving into an **open Agreement Operations platform**.

> Aakd turns agreements from static documents into trusted, cited and executable operational systems while letting organizations control their data, deployment, AI providers and tools.

Aakd supports the full contract lifecycle. Its first experience remains narrow and easy:

> Upload executed agreements and see the next actions, owners, deadlines, conditions and evidence, with every consequential result linked to the exact source and reviewed before it becomes trusted state.

### Who it is provisionally for

US and UK B2B service, software and technical companies with meaningful recurring agreement portfolios, cross-functional contract work and no mature legal-operations function.

### Current position

The repository is **Phase 0 in progress with later-phase feature islands**. Engineering Gate A is release-ready at commit `40e7cdb`; the activation, customer, quality, repeat-use and managed-Cloud gates are not implied by that result and remain open until their evidence exists.

### What is differentiated

The defensible compound is:

- a useful professional AGPL/self-hosted core;
- progressive usability instead of consulting-first implementation;
- governing agreement relationships and reviewed facts;
- cited, owned actions and completion evidence;
- correction propagation that stops stale execution;
- contract-native recipes with safe failure;
- vendor-neutral, permissioned agent access;
- privacy-shaped context, redaction and egress governance;
- managed convenience without data or product lock-in.

No single item is assumed unique. The opportunity is the quality of the compound.

### What we are building now

- truthful capability status;
- safe and simple activation;
- a representative US/UK evaluation corpus;
- one unified reviewed-action journey;
- hardened MCP/API access;
- reusable agreement, fact, action and privacy foundations;
- paid evidence from the selected validation ICP.

### What we are not building now

- an autonomous legal-agent platform;
- a blank workflow canvas before proven recipes;
- arbitrary SQL, HTTP, filesystem or unrestricted-export agent tools;
- more connectors without repeated demand;
- enterprise claims or certifications without evidence;
- a separate crippled “simple” product;
- additional-country localized GTM beyond the shared US/UK English motion without customer pull or legal necessity.

## 1. Decisions, hypotheses and unknowns

### DECIDED

- Aakd remains a full professional CLM, not merely an obligation tracker.
- Agreement Operations is the long-term architecture; cited actions are the provisional entry experience.
- There is one product with progressive complexity, not separate simple and enterprise products.
- The AGPL community core remains permanently useful and self-hostable.
- Managed Cloud and enterprise assurance can be paid, but community data remains portable.
- The US and UK are day-one markets through one English product and core offer.
- The US is the commercial priority; the UK is a parallel evidence and prospect cohort.
- Additional-country localized GTM beyond the shared US/UK English motion, including Germany-specific selling, is deferred until demand appears. Privacy and security obligations are not deferred.
- Aakd becomes agent-native through governed interfaces, not by rebuilding Claude or Codex.
- Humans retain authority over canonical facts, legal decisions and consequential external actions.
- Recipes precede a generic workflow canvas.
- Aakd coexists with Word, Drive, SharePoint, CRM, task and e-signature tools before requiring replacement.
- GitHub stars are reach; activation, retention, contributions and qualified pipeline are outcomes.
- Weak competitors constrain novelty language, not product ambition.

### HYPOTHESIS

- Lower-midmarket post-signature execution is the best initial paid problem.
- The validation ICP is 50–500 employee B2B service, software and technical organizations with roughly 100–2,000 active agreements or equivalent recurring complexity.
- Cited obligation-to-action is the strongest first journey; governing truth and no-migration recipes are challengers.
- Agreement precedence and correction propagation matter often enough to justify deep product primitives.
- Customers can adapt contract-native recipes without consulting-heavy implementation.
- OSS adoption can generate contributors, technical champions and commercial introductions.
- Some self-host-aware buyers will pay for managed operation and enterprise assurance.
- Agent-safe contract infrastructure and redaction can become buying reasons after the first outcome is proven.

### UNKNOWN

- The repeatable economic buyer.
- Willingness to pay, price, sales cycle and retention.
- The exact volume or company-size threshold at which pain becomes budget.
- Shared Cloud versus isolated deployment versus self-host preference.
- Whether the selected workflow repeats after the first diagnostic.
- Whether US demand converts differently from current UK evidence.
- Sustainable Cloud support cost and gross margin.
- Whether agent access or redaction independently triggers purchases.

These unknowns must not appear in public copy as facts.

## 2. First-principles product model

A contract is not primarily a PDF or a signature event. It is a changing agreement that creates rights, commitments, conditions, constraints, deadlines and decision authority.

The root jobs are:

1. **Reach agreement:** request, draft, negotiate, approve and sign.
2. **Know what governs:** resolve the current terms across MSA, SOW, order form, DPA, amendment and renewal.
3. **Act correctly:** convert terms and events into owned actions, notices and escalations.
4. **Prove performance:** retain source, review, approval, delivery and completion evidence.
5. **Change safely:** incorporate amendments and corrections without silently leaving dependent work active.
6. **Share safely:** let humans, systems and authorized agents use only the necessary agreement intelligence.

The product primitives are:

- **Source:** immutable documents, pages, excerpts, attachments and versions.
- **Agreement graph:** relationships, precedence, effective periods and supersession.
- **Fact ledger:** entered or extracted facts with source, confidence, review, sensitivity and history.
- **Action ledger:** rights, obligations, triggers, owners, deadlines, approvals, evidence and status.
- **Recipe engine:** contract-native triggers, conditions, actions, approvals and safe failure.
- **Policy/privacy layer:** identity, authorization, classification, redaction, egress and audit.
- **Interfaces:** progressive human UI plus REST, events, webhooks, CLI, SDK and MCP.

AI is an assistant and compiler over these primitives. It is not canonical authority.

## 3. Current product truth

As verified in the repository on 2026-08-16, Aakd already includes:

- repository, folders, tags, versions and snapshots;
- PDF/DOCX ingestion, validation, OCR, full-text and semantic search;
- AI metadata, risk and obligation extraction;
- cited contract Q&A plus organization-level AI configuration supporting documented BYOK providers and Ollama; each AI feature/provider combination must be verified rather than assumed equivalent;
- templates, variables, authoring, DOCX/PDF export and redlining;
- approvals, comments, DocuSeal signing and notifications;
- obligations, renewals, assignments, subtasks and reminders;
- Slack/Teams, webhooks and email;
- CRM links and several import/migration paths;
- REST API, organization-scoped API keys and MCP;
- English, French, German, Spanish and Arabic RTL;
- PostgreSQL/pgvector, Redis workers, S3-compatible storage and self-hosting;
- organization isolation, roles, activity records and security tests.

It lacks or has not proven:

- one coherent under-ten-minute first-value journey;
- one unified reviewed and owned action experience;
- a representative quality benchmark and adversarial corpus;
- real paid pilots and repeat organizational usage;
- agreement-family precedence and governing-truth resolution;
- a versioned reviewed fact ledger;
- dependency-aware corrections and stale-action invalidation;
- a reusable contract-native recipe system;
- operated Cloud billing, restore, support and incident evidence;
- granular agent identity, delegated permissions, privacy views and approval controls;
- enterprise identity, retention, legal hold and independent control evidence;
- a repeat contributor and extension ecosystem.

**Resolved engineering finding (2026-08-17):** the Phase 0 hardening pass added explicit MCP member/write-scope checks for mutations, a separate `text_read` capability for API-key contract Q&A, minimized contract/obligation/import projections, and regression tests for viewer writes, tenant isolation and raw-text/storage-key leakage. Agent readiness remains limited to the tested MCP surface until replay, stale-state and external-client compatibility evidence is collected.

Phase 0 must classify every existing module as **maintain**, **security-only**, **experimental** or **retire-candidate** and publish the matrix. Until then, shipped code does not automatically receive further investment.

## 4. Selected validation ICP

There is no validated Cloud ICP yet. This is the segment to falsify with real evidence.

### Organization profile

- US or UK B2B service, software or technical company.
- Roughly 50–500 employees.
- Approximately 100–2,000 active customer/vendor agreements, or a smaller portfolio with high recurring/SOW complexity.
- Recurring MSAs, SOWs, order forms, DPAs, amendments, renewals or service commitments.
- No mature legal-operations function capable of absorbing a large CLM implementation.
- Contract information split across Drive, SharePoint, CRM, e-signature, email and spreadsheets.

The ranges are hypotheses. Workflow, consequence and authority determine qualification.

### Trigger events

- missed renewal or notice window;
- unowned obligation, SLA or customer commitment;
- audit, dispute, acquisition or leadership change;
- contract-volume jump;
- expensive or poorly adopted incumbent CLM;
- need to expose reviewed agreement facts to operations or AI without exposing full documents.

### Roles

- **Daily user:** contract manager, commercial operations, procurement operations, finance operations or service-delivery operations.
- **Champion:** Legal Ops, Commercial Ops, Procurement, Finance Ops or Service Delivery leader.
- **Economic buyer hypothesis:** COO, General Counsel, CPO, CFO or finance leader depending on ownership and incident.
- **Technical champion:** CTO, IT/platform or security lead for self-hosting, integrations and agents.

The buyer becomes validated only after an economic owner funds the same repeatable workflow.

### Disqualifiers

- tiny teams with few agreements and no material consequence;
- one-off AI-review buyers;
- immediate global replacement projects;
- MSPs whose PSA already closes the workflow;
- no recent costly episode or repeat portfolio;
- no internal reviewer/owner;
- a mature incumbent already delivers the outcome adequately.

### Separate OSS audience

Self-hosters, developers, legal-tech builders, local-AI users and privacy-sensitive teams are the community audience. They can drive adoption, feedback, contribution and technical introductions. They are not automatically Cloud prospects.

## 5. Geography

- Serve the US and UK from day one with one English product, documentation set and offer.
- Prioritize US commercial learning while retaining the UK prospect cohort already identified.
- Tag interviews, corpora, conversion and retention by country and governing law. Do not hide differences in pooled numbers.
- Include US and UK documents in the evaluation corpus.
- Preserve multilingual and Arabic RTL architecture.
- Defer additional-country localized GTM beyond the shared US/UK English motion until access, demand, regulation or legal necessity justifies it.
- Evaluate countries through measurable access, procurement, support, price, conversion and retention, not stereotypes.

## 6. Product principles

1. Simple first, powerful progressively.
2. Source before answer.
3. Reviewed truth before automation.
4. Agreement relationships before isolated files.
5. Corrections invalidate dependent outputs visibly.
6. Coexist before replacement.
7. One core data model across editions.
8. Agent-native, not agent-autonomous.
9. Privacy at every egress.
10. Secure and honest by default.
11. Open extension, controlled execution.
12. Customer evidence controls priorities; hype and sunk code do not.

## 7. Full feature vision

### Contract lifecycle

- intake and requests;
- templates, clauses and authoring;
- collaboration, comments and redlining;
- approvals and decision history;
- signing through supported providers;
- repository, search, versions and organization;
- imports, exports and migration;
- renewal, termination and archive.

### Agreement intelligence

- agreement families and parent/child relationships;
- MSA/SOW/order-form/DPA/amendment precedence;
- effective periods, supersession and governing-term resolution;
- reviewed fact ledger with citations, confidence and sensitivity;
- relationship-centric briefs;
- change impact and correction history;
- public evaluation corpus and quality benchmark.

### Agreement execution

- rights, obligations, conditions and notice windows;
- owners, approvers and escalation;
- due dates, event triggers and recurring actions;
- completion evidence and immutable history;
- stale-state detection after changes;
- safe delivery to existing task, calendar, CRM and communication tools;
- operational and audit-ready reporting.

### Contract-native recipes

- opinionated starter recipes before a blank canvas;
- typed triggers, conditions, actions and approvals;
- preview and dry run;
- version checks and stale-input rejection;
- idempotency, retry and reconciliation;
- permissions and approval requirements;
- packaging, import/export and contribution format;
- stable events and one evidence-selected boundary integration before expansion.

### AI behavior

- extraction, normalization, retrieval and cited Q&A;
- risk and obligation suggestions;
- explicit uncertainty and “unable to determine”;
- mandatory review for consequential facts;
- correction history and evaluation feedback;
- organization-selected provider, BYOK or local model;
- no silent canonical overwrite;
- no autonomous legal advice, binding notice, signature or financial commitment.

### Governed Agent Gateway

MCP is the primary vendor-neutral interface for Claude, Codex and compatible agents. REST/OpenAPI, CLI, SDK, events and webhooks support other integrations. Aakd does not build a general-purpose agent runtime.

Core resources and tools should include:

- identity and capability discovery;
- policy-safe agreement search and summaries;
- reviewed facts with source and freshness;
- rights, obligations, actions and approvals;
- governing-document and change-impact queries;
- recipe simulation;
- action proposals and approval requests;
- execution of previously approved actions;
- agent activity and egress history.

Every response includes stable IDs, citations, version/freshness, sensitivity and redaction status when applicable.

### Agent action ladder

| Risk | Examples | Control |
|---|---|---|
| Low | Search, summarize, private draft | Permission and audit |
| Moderate | Internal task/calendar entry, non-critical assignment | Confirmation or policy |
| High | Canonical fact change, sensitive export, workflow activation, external message | Named approval |
| Critical | Signing, binding notice, renewal/termination, evidence deletion, permission or financial change | Dual approval or prohibited by default |

Every mutation requires preview, expected version, idempotency key, policy decision, attributable principal, required approval, postcondition verification and audit.

### Authorization

Authorization combines:

1. **Principal:** human, service account, external client or named agent.
2. **Delegation:** authorizing human, purpose and expiry.
3. **Capability:** metadata read, text read, sensitive read, action propose, obligation update, notice draft/send and similar typed permissions.
4. **Resource constraint:** organization, folder, agreement, label, counterparty, field, result limit and environment.
5. **Approval policy:** automatic, single approval, dual approval or prohibited.

Default deny applies on every tool call. Raw text and bulk export require stronger permission than metadata or reviewed facts.

### Privacy, redaction and egress

Aakd preserves the protected original and generates purpose-specific privacy views.

Detect names, emails, phones, addresses, bank/payment details, government identifiers, employee/health data, signatures, credentials, sensitive commercial terms and organization-defined secrets.

Support:

- local AI only;
- external AI denied;
- external AI with redaction;
- approved provider with selected unredacted categories;
- isolated/private deployment.

Privacy policy applies before MCP responses, model calls, embeddings, webhooks, notifications, exports and telemetry. Stable pseudonyms preserve context; encrypted organization-scoped mappings control re-identification.

Every disclosure records destination, principal, purpose, provider, categories, policy and timestamp.

Permanent redacted exports remove underlying text/OCR, metadata, annotations, attachments and revision remnants. Visual boxes alone are not safe redaction.

### Cloud and enterprise operation

- provisioning, upgrades, backup and verified restore;
- monitoring, incidents, support, billing and quotas;
- data boundary, retention, deletion, subprocessors and DPA;
- migration among community, Cloud and isolated deployment;
- SSO/SCIM, advanced roles and segregation of duties;
- legal hold, audit export and governance;
- private networking, regional isolation and key-management choices where paid demand supports them;
- evidence-backed controls and independent testing.

### Community and ecosystem

- simple seeded demo;
- honest support matrix;
- public extraction/citation benchmark and multilingual corpus;
- contribution-friendly parsers, recipes, connectors and translations;
- SDK, CLI and stable extension contracts;
- signed manifests, sandboxing and egress declarations;
- reviewed registry and revocation;
- maintained architecture, security, upgrade and release documentation.

## 8. Roadmap without timelines

Phases are dependency and evidence gates. Reusable foundation work may overlap, but claims, beta access and deeper investment cannot bypass their gate.

Before work governed by a qualitative gate begins, its owner records immutable numeric thresholds, denominator, evidence source, review authority, PASS action and FAIL action in the canonical scorecard location defined by `research/gates/README.md`. Results cannot be evaluated until that scorecard exists. Thresholds may be changed only before evidence collection starts, with the reason recorded.

### Phase 0: truth, safety, activation and evidence

**Outcome:** a truthful, safe, understandable and measurable product.

**Features:** capability matrix, contract-first onboarding, real-file activation fixtures, activation instrumentation, security checklist, adversarial corpus, paid diagnostic, MCP role enforcement, minimized agent reads, agent attribution, safe errors and real Claude/Codex compatibility tests.

**Differentiation:** fast self-hosted activation, transparency and inspectable trust. This is execution quality, not novel feature coverage.

**Gate:** clean install reaches a cited action without outside help; no release-blocking security flaw; five organizations report the same recent failure; three supply representative corpora; two economic owners fund the same pilot.

### Phase 1: simple professional core and first useful action

**Outcome:** one agreement becomes one reviewed, owned and useful action with minimal setup.

**Features:** unified action queue, exact citation, confidence/review, owner, deadline, condition, completion evidence, one work-tool output, progressive access to the wider CLM, read-first Agent Gateway, fine-grained scopes, privacy-safe summaries, action proposals and approval requests.

**Differentiation:** fast value plus no forced migration, sources, human review, progressive UX, OSS/self-hosting and safe agent retrieval. A cited action list alone is not unique.

**Gate:** the signed Phase 1 scorecard's corpus-quality, activation-time and marginal-support limits pass with no silent critical error; two organizations repeat; two fund managed operation.

### Phase 2: agreement intelligence

**Outcome:** Aakd knows what governs and how changes affect dependent work.

**Features:** agreement families and precedence, versioned reviewed facts, rights and conditions, completion evidence, correction propagation, stale-state invalidation, relationship brief, sensitivity labels, privacy views, version-bound approvals and full egress policy.

**Differentiation:** governing truth and safe correction propagation, not merely clause extraction.

**Gate:** real corpora require precedence; tests prove no silent overwrite; retained organizations use another agreement family; support burden falls.

### Phase 3: contract-native recipes and safe actions

**Outcome:** organizations adapt repeated contract work without consulting-heavy implementation.

**Features:** proven recipes, typed triggers/conditions/actions/approvals, dry-run, idempotency, retries, permissions, audit, stable events/API/MCP, recipe packaging, one evidence-selected integration, pause/resume approvals and approved agent execution.

**Differentiation:** “n8n for contracts” with governing context, citations, permissions, approvals and recoverable failure.

**Gate:** recipes repeat across organizations; customers modify them without founder intervention; failures recover safely; no consequential action bypasses policy.

### Phase 4: managed Cloud

**Outcome:** customers buy reliable operation, not hosting alone.

**Features:** provisioning, upgrades, backups/restores, monitoring, support, incidents, billing, quotas, DPA/data boundaries, portability, remote MCP OAuth/consent, short-lived tokens, client registry, managed privacy and visible egress history.

**Differentiation:** zero-operations convenience without product or data lock-in.

**Gate:** paying organizations retain and use the product; precommitted margin, support, restore, uptime and incident thresholds pass; no critical control gap remains.

### Phase 5: enterprise assurance

**Outcome:** validated larger buyers can approve and govern Aakd.

**Features:** SSO/SCIM, identity lifecycle, ABAC, segregation of duties, audit/export, retention/legal hold, custom DLP, SIEM, tamper-evident records, private networking, isolation, key management, formal controls, independent testing and partner implementation.

**Differentiation:** enterprise controls are table stakes; Aakd adds clearer operation, deployment choice, portability and the same open core.

**Gate:** the minimum qualified-deal count frozen in the Phase 5 scorecard requests the same control with budget and timing; the control is required to serve them safely.

### Phase 6: trusted Agreement Operations ecosystem

**Outcome:** external builders extend Aakd without weakening trust.

**Features:** SDK/CLI, stable extension contracts, signed extensions, permission/egress manifests, reviewed registry, revocation, extractors, connectors, recipes, agent tools, domain packs, interoperability/security suites and partner licensing.

**Differentiation:** an open ecosystem for portable agreement truth and execution. It is a moat only when independent maintainers participate repeatedly.

**Gate:** the minimum contribution, maintained-extension, active-installation and partner-opportunity thresholds frozen in the Phase 6 scorecard pass.

## 9. OSS, Cloud and monetization constitution

### Permanent AGPL core

- repository and search;
- authoring/review basics;
- agreement, fact and action model;
- source citations and human review;
- core recipes;
- API, export and self-hosting;
- security fixes;
- useful agent retrieval with safe defaults.

### Paid managed Cloud

Customers pay for zero-operations deployment, upgrades, backup/restore, monitoring, support, billing administration, managed providers and managed privacy/authorization operations.

### Paid enterprise controls

Paid capabilities may include SSO/SCIM, advanced governance, retention/legal-hold administration, isolated infrastructure, private networking, premium support and certified compliance evidence.

No paid feature may hold community data hostage, block export or force migration to another core model.

## 10. GTM and community

### Primary message

> Know what your agreements require next, who owns it and where the evidence is, without a six-month CLM implementation.

OSS, self-hosting, agent access and privacy strengthen the proof. They do not replace the business outcome until buyers demonstrate that they are the trigger.

### Validation motion

- Research US and UK cohorts separately.
- Require a specific recent episode, workaround, consequence and owner.
- Run a fixed-scope paid diagnostic on representative redacted agreements.
- Record volume, systems, support effort, deployment preference, buyer and budget path.
- Require repeat use on another agreement family or event.
- Disqualify incumbent adequacy rather than forcing a sale.

### OSS distribution

- README begins with one job, screenshot and fast demo.
- Seeded demo works without an external AI key.
- Public benchmark shows citations, errors and limitations.
- Architecture, security and support status are inspectable.
- Contribution paths solve bounded jobs.
- Discussions collect workflows and failures, not star requests.
- Launch content communicates outcomes and constraints honestly.

### Competitor policy

- Landing pages affect novelty wording, not roadmap scope.
- Prototypes inform design but do not prove market ownership.
- Meaningful active-user or developer adoption triggers evaluation.
- Customers, retention, revenue and partner execution demand serious comparison.
- Microsoft, Salesforce, DocuSign, generic workflow tools and cloud providers are substitution/distribution threats even when not direct CLM competitors.

Do not claim nobody else has graphs, obligations, citations, workflows, agents or redaction.

## 11. UX contract

- Default to contract-first and action-first.
- Do not require infrastructure configuration before value.
- Show meaning, exact source, confidence/review, owner and next step for consequential results.
- Reveal advanced features in context instead of making them competing products.
- Design empty, loading, error, uncertainty and missing-configuration states.
- A non-legal operator should understand the result without CLM jargon.
- Accessibility, responsive behavior, text expansion and Arabic RTL are completion requirements.
- Keep system complexity out of the first-time user experience.

## 12. Security, privacy and AI contract

### Release blockers

- cross-tenant disclosure;
- unauthorized mutation;
- agent action without attributable principal;
- consequential action without required approval;
- protected raw data or secrets disclosed outside policy;
- silent critical AI error;
- stale action executed after governing change;
- unlogged binding or external side effect.

### Required controls

- authenticate and organization-scope every protected operation;
- enforce permissions on the server, never in prompts or UI alone;
- treat uploaded contract content as untrusted prompt-injection input;
- minimize returned fields and raw text;
- separate model suggestions from deterministic policy;
- validate typed tool output;
- use least privilege, expiry and emergency revocation;
- retain attributable activity and egress history;
- validate files, isolate secrets and use workers for heavy processing;
- retain source, page, confidence, reviewer and history for AI-derived state;
- test denial, isolation, replay, duplicates, stale versions, bulk extraction and redaction failure.

Redaction reduces disclosure; it does not automatically anonymize a contract. If redaction destroys the accuracy required for a workflow, restrict it to local/private AI instead of calling it safe.

## 13. Metrics

### North star

**Monthly verified contract actions completed with source evidence by retained organizations.**

### Product

- install to healthy demo;
- workspace to real upload;
- upload to reviewed fact;
- reviewed fact to assigned/completed action;
- time to first useful action;
- accepted fact/action rate;
- correction rate and time;
- citation validity and source coverage;
- second-cycle and retention.

### Agent/security

- unauthorized calls denied;
- actions by risk and approval path;
- stale approvals/actions blocked;
- egress by policy and destination;
- redaction false-negative and review rate;
- findings by severity and remediation;
- compatibility results by client/version.

### OSS

- install-to-demo conversion;
- privacy-safe active installations;
- supported-version adoption and upgrade success;
- external reporters and PR authors;
- maintained third-party recipes/extensions;
- qualified commercial introductions.

### Commercial

- qualified workflow to paid pilot;
- repeat pilot to subscription;
- deployment preference and reason;
- retention by cohort;
- onboarding and marginal support effort;
- gross margin and incident cost;
- qualified pipeline by channel.

Every report states unit, denominator, window, exclusions and source. Gate thresholds are set before results are observed.

### Operational definitions

- **Qualified organization:** has a recurring agreement portfolio, named operational owner, recent target-workflow episode, ability to supply representative redacted documents and a plausible budget path.
- **Representative corpus:** real redacted documents from the target workflow including amendments, exceptions and selected contract types; synthetic-only sets do not pass market evidence.
- **Reviewed fact:** a structured fact whose value, source, confidence and sensitivity have been confirmed by an authorized human or approved deterministic rule.
- **Accepted action:** a reviewer confirms the action, owner, date or condition and exact source without material correction.
- **Agreement family:** related documents whose precedence and effective periods jointly determine governing terms.
- **Recipe:** a versioned contract-native trigger, condition, action and approval definition with permission and failure behavior.
- **Repeat/second cycle:** an organization completes the workflow on a new agreement family or later scheduled event without founder execution.
- **Active installation:** an opted-in supported installation performs the core workflow during the measurement window; CI and demos are excluded.
- **Substantive contribution:** an external change or maintained extension that improves a user or developer outcome; typo-only changes are excluded.
- **Qualified commercial lead:** a qualified organization with identified owner, workflow, timing and plausible budget.
- **Agent:** an attributable software principal acting through a delegated capability and policy, never an anonymous model process.

## 14. Main risks and invalidation

| Risk | Response | Evidence that forces change |
|---|---|---|
| Crowded CLM market | Win the open/self-hosted compound with better activation | Credible rivals deliver the same compound better to the same segment |
| Cited actions already exist | Add governing truth, corrections, evidence and safe execution | Buyers consider the compound commodity or incumbent-adequate |
| Full product overwhelms | Progressive disclosure and one first job | Activation still requires consulting |
| Recipes become services | Typed reusable primitives | Every customer requires bespoke code |
| AI creates liability | Citations, uncertainty, review and policy | Serious silent errors or correction burden stay unacceptable |
| Agents increase exposure | Default deny, privacy views, approvals and audit | Any cross-tenant result, unauthorized mutation or unlogged side effect |
| Redaction harms value | Purpose-specific policy and private fallback | Accuracy fails or no real privacy-sensitive use is unlocked |
| OSS does not monetize | Separate community and commercial funnels | No retained installs, contributors or qualified introductions |
| Cloud loses to free hosting | Sell operation and assurance | Qualified buyers consistently reject managed operation |
| Enterprise scope consumes team | Require repeated paid control requests | Maintenance blocks activation, safety and learning |
| Ecosystem does not compound | Stable extension contracts and DX | No independent maintained extensions or partner pull |

## 15. Work-in-progress and decision rules

Until the first journey passes its gate, allow at most:

- one activation journey;
- one representative corpus;
- one output integration;
- one foundation primitive;
- one Cloud/security operational workstream.

Every proposed feature must state:

1. customer job;
2. roadmap phase and gate;
3. community, managed or enterprise placement;
4. supporting evidence;
5. smallest reusable version;
6. security, privacy, accessibility and multilingual failure modes;
7. observable invalidation condition.

A failed wedge, message, segment or integration does not automatically invalidate the shared architecture. A company-level pivot requires an explicit causal argument.

## 16. Discipline directives

### Engineering

- Build against source/agreement/fact/action/policy primitives.
- Reuse existing abstractions and preserve tenant isolation.
- Treat MCP/API as the same security boundary as UI.
- Test behavior, denial, replay, stale state, idempotency and isolation.
- Avoid speculative schemas and integrations.
- Report which gate the implementation advances.

### GTM

- Lead with one costly workflow and outcome.
- Separate user, champion, buyer, installer, contributor and Cloud customer.
- Treat the ICP as hypothesis until payment and repeat use.
- Keep US and UK evidence separate.
- Never invent customers, accuracy, ROI, pricing or competitor weakness.

### UI/UX

- Optimize first cited action, not navigation breadth.
- Use progressive disclosure.
- Make evidence, uncertainty, ownership, privacy and approval understandable.
- Design all states and locales, including RTL.
- Test with non-legal operators.

### Research

- Separate facts, hypotheses, unknowns and counterevidence.
- Prefer first-person workflows and primary sources.
- Rank competitors by traction, not copy.
- Research workaround, episode, consequence, authority, budget and repeat trigger.
- State what sources cannot prove.

### Security/privacy

- Threat-model humans, API clients, agents, documents, connectors and providers.
- Treat contract content as untrusted.
- Enforce least privilege, minimization, purpose limitation and egress logging.
- Block releases on Section 12 conditions.
- Require evidence before security/compliance claims.

### Documentation/community

- Keep README, support matrix, architecture, security and upgrades truthful.
- Make the demo reproducible.
- Publish benchmarks and limitations.
- Create bounded contribution surfaces with tests and ownership.
- Optimize for successful installation and contribution, not star requests.

### Product/CEO

- Protect the vision while changing unvalidated tactics quickly.
- Maintain the work-in-progress cap.
- Set thresholds before experiments.
- Reclassify competitors and hypotheses periodically.
- Record durable decisions and evidence.
- Do not let sunk code, hype or weak competitors determine priority.

## 17. Required session handoff

Every substantial Aakd session ends with:

1. **Objective:** outcome pursued.
2. **Roadmap mapping:** phase, principle and gate advanced.
3. **Facts learned:** evidence verified or added.
4. **Hypotheses changed:** stronger, weaker or invalidated.
5. **Work completed:** files, research and decisions changed.
6. **Verification:** tests, sources, review or user evidence.
7. **Risks/open questions:** unresolved items.
8. **Next action:** one prioritized owned step.

No session silently changes the ICP, geography, OSS constitution, product primitives, agent-safety model or monetization boundary. Proposed changes require evidence, a change to this document and founder approval.

## 18. Immediate company focus

1. Make the current product truthful, safe and easy to activate.
2. Harden MCP/API before promoting agent readiness.
3. Build the representative US/UK corpus and benchmark.
4. Deliver one unified reviewed-action journey.
5. Validate the ICP through episodes, corpora, paid pilots and repeat use.
6. Build only reusable agreement/fact/action/privacy foundations during validation.
7. Make the repository independently understandable, runnable and contributable.

The company vision is a full open Agreement Operations platform. The operating focus is proving one trusted contract outcome and the foundations that make it safely extensible.

## 19. Evidence and supporting artifacts

Use these documents for evidence and detail. They do not override this constitution.

- `research/aakd-product-vision-and-roadmap-2026-08-16.md`: strategic alternatives, competitor tiers, gates and stress tests.
- `research/aakd-cloud-icp-evidence-2026-08-16.md`: public pain evidence, counterevidence, target accounts and ICP limits.
- `research/aakd-customer-first-clm-cycle-2026-08-16.md`: lifecycle coverage and customer-first validation logic.
- `research/aakd-product-surgery-plan.md`: current product simplification and activation recommendations.
- `research/aakd-contract-action-diagnostic-protocol.md`: fixed-scope validation method.
- `research/audit-2026-07-16/security-audit.md`: security and multi-tenancy findings at the audit date.
- `research/audit-2026-07-16/test-run.md`: historical verification evidence at the audit date.
- `README.md`: public capability and installation claims; it must remain consistent with verified product state.

External market and competitor facts are time-sensitive. Re-verify them before public use. Repository behavior must be verified from current code and tests rather than inferred from this document.
