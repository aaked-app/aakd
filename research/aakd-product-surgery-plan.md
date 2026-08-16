# Aakd product surgery plan

Date: 2026-08-16

## Product direction

Keep Aakd as an open-source contract operations product, but change the first-run promise from "manage the entire lifecycle" to:

> Turn signed contracts into owned, cited actions without forcing a company to replace Word, Drive, CRM, Jira or its existing CLM.

This is a positioning and workflow change first. It is not permission to delete working code before customer evidence exists.

## Remove or hide from the default experience

### Remove immediately from public claims

- SSO/SAML and SCIM claims until implemented and tested.
- SOC 2 Type II, SOC 2 readiness and GDPR tooling claims unless supported by a real control inventory and evidence.
- Kubernetes/Helm deployment claims until a maintained chart exists.
- Free hosted-cloud claims until billing, hosting and support actually exist.
- "Many teams in regulated industries use Aakd in production" until customer references exist.
- Invented AI agent usage, accuracy or adoption statistics.

These claims currently appear in `apps/web/messages/*` and create trust risk with exactly the buyers Aakd wants to reach.

### Hide from navigation, do not delete yet

- AI Agents and Create with AI pages. They are currently mock or Coming Soon surfaces.
- Analytics as a primary destination. Keep it as an administrator report, not the first value proposition.
- CRM sync, advanced authoring, templates, redlining and multi-provider integrations from the first-run path.
- Billing preview and hosted-cloud links until the commercial path exists.

The code can remain available behind an experimental flag while evidence is collected.

## Adjust the current journey

### 1. Onboarding

Current problem: onboarding starts with AI-provider configuration. That asks users to make an infrastructure decision before seeing value.

New sequence:

1. Create workspace.
2. Upload one executed contract or connect one existing folder/export.
3. Show extracted dates, parties, obligations and citations.
4. Ask the user to confirm or correct the five most important fields.
5. Generate the first action list.
6. Only then offer hosted AI, BYOK or Ollama choices.

### 2. Dashboard

Replace the current portfolio/statistics-first dashboard with an action queue:

- Needs owner confirmation
- Notice window approaching
- Obligation due soon
- Missing evidence or source citation
- Waiting on counterparty or internal approval
- Completed this week

Every item must show its contract, exact source excerpt, confidence, owner, due date, next action and completion evidence.

### 3. Contracts and agreement families

Add a first-class relationship between MSA, DPA, SOW, order form, amendment and renewal. Users should see one customer/vendor relationship rather than isolated PDFs.

Keep the existing contract repository, versions and snapshots, but add:

- relationship type and parent agreement
- effective-date precedence
- superseded/active status
- source location and import timestamp
- field-level confidence and review status

### 4. Obligations and renewals

Unify the existing obligations and renewals pages into a Contract Action Ledger. A ledger item should include:

- action and trigger
- responsible person and accountable organization
- due date and notice deadline
- exact source text and page
- confidence and reviewer
- evidence required to mark complete
- escalation path
- links to the destination system

Renewal reminders alone are too weak. The value is accountable completion of the work the contract requires.

### 5. Integrations

Do not attempt to become the CRM, ERP or task system. Prioritize one-way, reviewable outputs:

- create a Jira/Linear/Asana task
- create a calendar event
- post an approval request to Slack or Teams
- update a CRM renewal field
- export an audit-ready CSV/PDF pack

Each output should include a citation back to the contract and an activity record. Bidirectional synchronization can wait.

### 6. AI behavior

AI should be an extraction and routing assistant, not an autonomous legal agent.

Required behavior:

- cite exact text and page
- show confidence
- distinguish extracted fact from inference
- require human confirmation for dates, money, obligations and risk
- preserve corrections as structured feedback
- never silently overwrite canonical contract data
- show a clear "unable to determine" state

## Add next

### P0: trust and activation

- Remove unsupported claims and fake metrics.
- Add a demo workspace with synthetic contracts and a visible data boundary.
- Add an activation funnel: workspace created, first contract uploaded, extraction completed, first correction, first action acknowledged, first action completed.
- Add an exportable diagnostic report so a new user gets value without configuring integrations.
- Add a one-command local demo with seeded data and a health check for database, Redis, storage and worker.

### P1: action-ledger workflow

- `AgreementFamily` relationships.
- `ActionItem` or an extension of `ContractObligation` with source, confidence, owner acknowledgement, evidence and escalation.
- Review queue for AI-extracted fields.
- Unified action dashboard.
- Completion evidence attachments and immutable activity history.
- Scheduled digest email and Slack/Teams summary.

### P2: distribution and ecosystem

- CLI for import, extraction and export.
- Documented REST and MCP examples that complete one useful workflow.
- Public sample corpus with expected extraction outputs, excluding real customer data.
- Import adapters as separate contribution-friendly modules.
- GitHub issue templates for connectors, extraction errors and language support.
- A small benchmark that measures citation accuracy, extraction precision and processing time on the sample corpus.

## GitHub adoption strategy

The repository will not become viral by adding more enterprise features. It becomes shareable when a developer can understand, run and demonstrate it quickly.

Priorities:

1. README opening: one concrete job, one screenshot, one command, one five-minute demo.
2. `docker compose up` followed by a seeded demo account with no external AI key required.
3. Short GIF showing upload to cited action list.
4. Architecture diagram showing web, worker, database, object storage and optional AI provider.
5. Honest support matrix: implemented, experimental, planned, not supported.
6. Reproducible extraction benchmark and test corpus.
7. Contribution guides for connectors, parsers, translations and UI.
8. Release notes that report user-visible outcomes and known limitations.
9. GitHub Discussions for real workflow examples, not promotional requests for stars.
10. One narrow starter kit, such as "vendor renewal and obligation tracking for a 20-person services firm."

## What not to build yet

- Generic contract chatbot.
- Autonomous legal agent builder.
- New e-signature engine.
- More CRM connectors.
- Enterprise SSO/SAML before the underlying identity and compliance work is real.
- Broad analytics and risk dashboards without active users.
- Full bidirectional ERP/procurement synchronization.
- More contract templates as a substitute for customer discovery.

## Recommended implementation order

1. Truth reset in copy and feature flags.
2. Seeded demo and first-value onboarding.
3. Action-ledger data model and review queue.
4. Dashboard and email/Slack action delivery.
5. Agreement-family relationships and evidence completion.
6. CLI, benchmark and contribution surface.
7. Only after observed usage, decide whether to add more integrations or commercial hosting.

Success is not more routes or features. The first meaningful metric is the number of organizations that upload real contracts, confirm extracted actions, complete them, and return for a second cycle.
