# M13: Startup Contract Action Ledger

Status: proposed, customer-validation gated
Owner: Aakd
Primary ICP: B2B startups with 10–100 employees, roughly 20–200 active customer, vendor and employment contracts, no dedicated legal-operations team, and a working stack built around Google Drive or Microsoft 365, email, Slack, CRM and a task/calendar tool.

## Decision context

Aakd already contains a broad CLM surface. The problem is not missing generic CLM features. The product must earn adoption by solving one startup job quickly:

> After a contract is signed, make the next required actions visible, owned, cited and trackable without forcing the startup to replace its existing tools.

This spec deliberately does not turn Aakd into another end-to-end enterprise CLM.

## Customer problem

Startup contracts are often stored in Drive, email, CRM records, DocuSign/PandaDoc exports and local folders. The signed document exists, but the operational consequences are not assigned reliably:

- renewal and notice windows are missed;
- pricing, payment, service and reporting obligations remain inside PDFs;
- nobody knows who owns the next action;
- amendments and SOWs are detached from the original agreement;
- legal, finance, sales and delivery each maintain partial copies;
- teams use spreadsheets, calendars, Slack messages and Jira tickets as manual workarounds.

The product must prove this job is worth paying for. This is a product hypothesis, not established willingness to pay.

## User journey

### First session target

From account creation to one confirmed action in ten minutes:

1. Create a workspace.
2. Upload one executed PDF or DOCX, or choose a synthetic sample.
3. Aakd extracts only action-driving facts: parties, renewal date, notice deadline, obligation, owner candidate and evidence requirement.
4. Each fact is shown with exact source text, page and confidence.
5. User confirms or corrects the facts.
6. User assigns an owner and due date.
7. Aakd creates the first Contract Action Ledger item.
8. User marks it acknowledged or sends it to an existing tool.

### Repeat session target

Within 30 days, the same organization returns to review, complete or route another action from another contract.

## Scope

### P0: truth and activation

- Correct unsupported product claims in every supported locale.
- Hide AI Agents, Create with AI and disabled billing surfaces from the primary navigation.
- Replace AI-provider-first onboarding with contract-first onboarding.
- Add a synthetic demo workspace that needs no external API key.
- Add activation events:
  - `workspace_created`
  - `first_contract_uploaded`
  - `extraction_completed`
  - `action_reviewed`
  - `action_assigned`
  - `action_completed`
  - `second_session_started`
- Add a truthful support matrix: stable, experimental, planned and unsupported.

### P1: Action Ledger projection

Use existing `ContractObligation`, renewal alerts, extraction records, assignees and activity history before creating a new top-level model.

Add only the fields required for the workflow:

- `sourceText`
- `sourcePage`
- `confidence`
- `reviewStatus`
- `assigneeId`
- `dueDate`
- `noticeDate`
- `evidenceRequired`
- `acknowledgedAt`
- `completedAt`
- `completedById`
- `escalationState`

The UI should present obligations and renewals in one action queue, while preserving existing API compatibility.

### P1: Contract Brief

On the contract page, make the first view a brief containing:

- next action;
- due date and notice window;
- owner;
- cited terms;
- confidence and review state;
- action history;
- linked source files;
- links to advanced authoring, approvals, signing and analytics.

### P2: safe outputs

Implement one-way, reviewable delivery to:

- email digest;
- Slack or Teams notification;
- calendar event;
- Jira, Linear or Asana task;
- CSV/PDF action report.

Every output must link back to the source contract and write an Activity record. Bidirectional synchronization is out of scope.

### P2: agreement context

Only after user evidence shows it is needed, add relationships between MSA, DPA, SOW, order form, amendment and renewal. Do not build this before the Action Ledger has repeat usage.

## Explicit non-goals

- Autonomous legal advice or autonomous contract agents.
- Replacing Word, email, Drive, CRM, Jira, ERP or e-signature.
- New e-signature infrastructure.
- Enterprise SSO/SCIM before validated demand and a security project.
- More CRM connectors before one output channel proves repeated use.
- Broad risk analytics, predictive renewal scoring or generic chat.
- More templates as a substitute for customer research.
- Deleting the existing authoring, signing or integration code during validation.

## Startup-specific product constraints

- Time to first useful action: ten minutes or less.
- No required AI key for the demo path.
- No migration project for the first 25 contracts.
- A startup admin can understand the result without legal training.
- The user can keep working in existing tools.
- Self-hosting documentation must clearly state required services and operational responsibility.
- AI output never becomes canonical without human confirmation.
- Every extracted action must be traceable to source text and page.

## Acceptance criteria

### Product

- A new workspace can reach the synthetic demo action list without configuring AI, email or integrations.
- A real PDF or DOCX upload produces a reviewable extraction result with source text, page and confidence.
- A user can confirm, correct, assign and complete an action without leaving the contract page.
- The dashboard shows action states rather than only portfolio statistics.
- Renewal and obligation records appear in one queue with filters for owner, due date, notice window and review state.
- Completion writes an Activity record and preserves evidence.
- A one-way notification includes a deep link and source citation.
- Organization isolation and existing auth tests remain green.

### Trust

- No unsupported SSO, SOC 2, Helm, hosted-cloud or customer-adoption claims remain.
- No invented AI usage or accuracy metrics remain.
- All locales reflect the same feature truth.
- Product labels distinguish stable, experimental and planned features.

### Distribution

- A clean machine can clone, start the demo and see the first cited action in ten minutes or less.
- README includes one promise, one screenshot, one GIF, one command and a support matrix.
- A synthetic corpus and expected outputs are published for contributors.

## Validation gates before deeper build

Do not add new schema, integrations or large UI work unless:

1. Eight startup operators across at least five organizations observe the current contract workflow.
2. Three organizations provide a redacted 10–25 contract sample or equivalent synthetic reproduction.
3. Two organizations prepay for a fixed diagnostic or pilot.
4. At least two organizations repeat the action workflow within 90 days.
5. One economic buyer accepts recurring pricing of at least €149/month, or a higher annual price that can reach €1M ARR with no more than 1,000 accounts.
6. Manual correction and support stay below two founder-hours per 25 contracts.

If the prepayment gate fails after 20 qualified conversations, reject this wedge and stop expanding Aakd around it.

## Metrics

Primary:

- time from signup to first confirmed action;
- percentage of uploaded contracts producing at least one accepted action;
- action acknowledgement rate;
- action completion rate;
- second-session rate within 30 days;
- repeat-use rate within 90 days.

Secondary:

- extraction correction rate;
- support minutes per organization;
- demo-to-real-contract conversion;
- notification click-through;
- GitHub clone-to-first-action conversion.

GitHub stars are a distribution signal only, not product validation.

## Implementation sequence

1. Public truth reset and feature flags.
2. Startup demo workspace and contract-first onboarding.
3. Action Ledger projection over existing obligations and renewals.
4. Contract Brief and action-first dashboard.
5. Cited completion evidence and email digest.
6. One output integration selected from observed startup usage.
7. README, GIF, benchmark corpus, install doctor and contribution templates.
8. Reassess after the validation gates before adding agreement families or more integrations.

## Rollback

Keep the existing contract, obligation, renewal, authoring and integration routes intact. New UI can be disabled behind a feature flag. New fields are additive. If validation fails, revert the startup positioning and retain Aakd as a general open-source CLM without deleting data or existing workflows.
