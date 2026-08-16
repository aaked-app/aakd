# Aakd Contract Action Diagnostic — landing-page test

**Status:** test specification only. Do not publish until the data-handling copy, contact destination, analytics consent and response owner are real.

## Test objective

Measure whether a narrowly qualified operations/procurement/commercial audience will request a conversation about the **Contract Action Diagnostic**, and separately whether they prefer a future managed service or the self-hosted community edition.

This test cannot establish willingness to pay from clicks or email submissions. A qualified conversation followed by a prepaid diagnostic is the next evidence threshold.

## Guardrails

- Do not describe Aakd Cloud as available, compliant, certified, hosted, or supported unless those claims become true and documented.
- Do not promise legal advice, autonomous extraction, accuracy thresholds, third-party integrations, or a one-business-day turnaround before a real delivery process exists.
- Do not collect contract documents, sensitive data, credentials, or payment details through the page.
- Do not use stars, social engagement or generic “interested” clicks as demand evidence.
- Show both deployment paths honestly; do not dark-pattern users toward a future Cloud product.

## Audience and traffic rule

**Include:** lower-midmarket non-MSP teams where the visitor says they manage executed customer, supplier, SOW or service agreements and has a recent post-signature failure.

**Exclude:** solo/very-small teams seeking a reminder app, agencies seeking a white-label multi-client tool, and users whose existing CLM/PSA/ATS already produces owned, source-linked actions.

Use individually researched, permissioned traffic, relevant communities where promotion is allowed, or content with an explicit disclosure. Do not buy lists, scrape private profiles, or send bulk messages.

## Page copy: Version A — problem qualification

### Hero

**Signed contracts should become owned work—not PDFs that hide in a folder.**

The Aakd Contract Action Diagnostic explores whether your executed agreements can become a reviewable list of obligations, notice windows and next actions—each tied back to the exact contract text.

**Button:** “Check whether this workflow fits”

### Who it is for

For operations, procurement, finance and commercial teams that already have executed agreements but still reconcile obligations, notices or ownership across folders, spreadsheets, SharePoint, a CLM, PSA or project tools.

It is **not** a generic repository, e-signature replacement, legal-advice service, or a claim that you should replace the systems you already use.

### What a diagnostic would examine

1. A small, redacted batch of comparable executed agreements.
2. Potential obligations, notice windows and owner questions with their source text and page.
3. Which items a human reviewer confirms, corrects or marks “unable to determine.”
4. Whether the useful output belongs in your existing workflow rather than a new system.

### Qualification questions

1. “Did a signed agreement create avoidable work, cost or risk in the last 12 months?”
2. “Do you manage 25+ comparable executed agreements?”
3. “Which existing system did not prevent the issue?”
4. “Can a workflow owner and budget owner join a 20-minute research call?”

**Button:** “Request a research conversation”

### Truthful note

Aakd is currently open-source and self-hostable. The diagnostic is a research program; it is not an available managed Aakd Cloud product. No contract documents are requested on this page.

## Page copy: Version B — deployment preference after qualification

Show only after the visitor passes Version A’s questions. Randomize card order and preserve the same outcome description.

| Choice | Copy |
|---|---|
| Self-hosted community edition | “Run Aakd in infrastructure you operate. You own deployment, updates, backups, support and data-boundary decisions.” |
| Future managed option | “If Aakd later offers managed hosting, would you evaluate a paid service that handles setup, upgrades, backups and support under a documented data boundary?” |
| Neither / not enough information | “I would not choose either option yet.” |

**Required follow-up:** “Why is that your preference?”

Never treat a managed-option selection as a purchase commitment. Record it only with the stated reason and qualification answers.

## Events and success criteria

| Event | Definition | What it proves | What it does not prove |
|---|---|---|---|
| Qualified-page completion | All four qualification questions answered with a plausible incident and workflow | Relevance to a narrow research conversation | Need, buyer authority or willingness to pay |
| Research-call request | Contact request from a qualified visitor | Permission for a conversation | A sales opportunity or purchase intent |
| Budget-owner attendance | Named economic owner attends the call | Credible route to a decision | Budget approval |
| Diagnostic prepayment | Same fixed scope is paid before work starts | Willingness to pay | Repeat use or Cloud preference |
| Second-cycle request | Same organization requests another batch after output review | Potential repeat behavior | Broad-market repeatability |
| Managed preference with reason | Qualified organization chooses managed option and says why | A Cloud hypothesis signal | Willingness to buy Cloud |

**Pass condition for advancing the ICP:** two organizations prepay the identical diagnostic and request a second cycle; at least two qualified teams independently prefer managed operations for stated reasons; both conditions must be checked against incumbent alternatives.

**Failure conditions:** visitors only want reminders/repository functions; they cannot name an incumbent limitation; no budget owner attends; they consistently prefer self-hosting; or a current system can produce the cited-action result after routine configuration.

## Minimal measurement record

Keep only data needed for consented follow-up and research analysis:

| Field | Purpose |
|---|---|
| Consent timestamp and source | Permission and channel integrity |
| Role / size band / agreement type | Segmentation, supplied by respondent |
| Incident and current-tool limitation | Qualification evidence |
| Deployment preference and reason | Cloud hypothesis |
| Call outcome / pilot status | Gate tracking |

Do not place raw contract content, personal data beyond contact details, or unredacted incident materials in product analytics.
