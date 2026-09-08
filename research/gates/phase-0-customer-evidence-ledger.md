# Phase 0 customer-evidence ledger

**Status:** OPEN — no customer gate is claimed as passed
**Updated:** 2026-09-08
**Owner:** Aakd product/engineering owner
**Review authority:** Founder/CEO

This is the canonical, append-only intake record for the Phase 0 and Phase 1
customer gates. It records evidence needed to test the product; it does not
turn a local test, synthetic fixture, public discussion, or founder assertion
into customer evidence.

## Current measured state

| Gate | Required threshold | Verified count | Status |
| --- | --- | ---: | --- |
| Independent organizations reporting the same recent failure | 5 organizations | 0 | `OPEN` |
| Representative corpus | 3 organizations and at least 100 redacted documents across selected contract types | 0 organizations / 0 documents | `OPEN` |
| Repeat use | 2 organizations complete a second comparable cycle | 0 | `OPEN` |
| Managed-operation funding | 2 qualified organizations fund the same offer | 0 | `OPEN` |
| Activation time | Median signup-to-first-confirmed-action below the signed scorecard threshold | No customer sessions | `OPEN` |
| Silent critical errors | 0 critical actions silently accepted with invalid source or materially wrong deadline | No customer corpus | `OPEN` |
| Marginal support | Within the Phase 1 scorecard correction and support limits | No customer cycle | `OPEN` |

## Eligibility rules

An entry may count only when it has:

1. An organization-level identifier that is pseudonymous in this repository.
2. A named role and operating context, with consent for the recorded use.
3. A dated workflow observation or product session and a preserved source or
   customer-confirmed record.
4. The failure, consequence, current workaround, and desired outcome.
5. A clear classification: customer evidence, paid evidence, community signal,
   synthetic test, or founder hypothesis.
6. Reviewer initials/date and the gate to which the entry contributes.

Do not store contract text, personal data, credentials, private email content,
or identifying customer details in this file. Store redacted corpus artifacts
and access-controlled consent records outside the repository, then reference
their immutable IDs here.

Community observations can generate interview targets but do not count as an
independent organization, representative corpus, repeat-use, or funding
entry. Synthetic fixtures verify behavior and do not count toward customer
quality or market gates.

## Append-only evidence records

No qualifying customer records have been collected yet.

Use this template for each new record. Never rewrite an accepted or rejected
record; append a correction or superseding review entry instead.

```markdown
### CE-YYYY-MM-DD-NNN — short finding

- Evidence class: customer evidence / paid evidence / community signal / synthetic test / hypothesis
- Organization ID: pseudonymous ID only
- Role and context:
- Consent/reference ID:
- Date observed:
- Roadmap gate:
- Workflow and contract family:
- Failure, consequence, and current workaround:
- Desired outcome:
- Product/session evidence reference:
- Corpus artifact IDs (if applicable):
- Repeat-cycle reference (if applicable):
- Funding or pilot reference (if applicable):
- Reviewer and review date:
- Decision: count / do not count / needs clarification
- Reason and follow-up:
```

## Review protocol

Before changing any count in the table above, the reviewer must confirm that
the referenced evidence is accessible to the authorized team, the organization
is independent of other counted entries, the denominator and time window are
explicit, and the entry meets the eligibility rules. A rejected or ambiguous
entry remains visible with its reason.

When a threshold is reached, update the relevant signed scorecard and the
current-head release acceptance record with the evidence IDs and the exact
denominator. Do not mark a gate `PASS` from this ledger alone if the scorecard
requires a separate reviewer, payment record, or customer confirmation.
