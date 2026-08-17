# Phase 0 evidence-intake checklist

Status: operational preparation only. Completing this checklist does not create
customer evidence and does not move any Phase 0 gate from OPEN to PASS.

Use this checklist before accepting an interview record, customer corpus, paid
pilot, or repeat cycle into the Phase 0 ledger. The diagnostic protocol remains
the source of truth for the job and pilot definition.

## 1. Before the conversation

- [ ] Assign a pseudonymous account ID (`acct-###`); do not use the company
      name in the ledger.
- [ ] Record country, size band, participant title, and the claimed workflow
      role from the participant, not from a public profile.
- [ ] Confirm the participant agreed to a research conversation and explain
      that participation does not imply a product, security, or legal claim.
- [ ] Confirm whether the participant may discuss a redacted agreement sample;
      do not request files, credentials, production access, or secrets during
      the first conversation.
- [ ] Use the fixed interview questions in the diagnostic protocol. Store a
      quote and the interviewer interpretation separately.

## 2. Corpus receipt and handling

Accept a corpus only after the customer confirms in writing that it is safe to
process for the stated pilot. The confirmation must identify the agreement
family, approximate count, redaction status, permitted processors, and the
person who can request deletion.

- [ ] Receive only PDF/DOCX files needed for the fixed scope; never request a
      full drive export or unrelated personal data.
- [ ] Verify the customer has removed names, addresses, signatures, payment
      details, credentials, and special-category data unless each item is
      necessary and explicitly approved.
- [ ] Store the corpus outside Git and outside the research ledger, using the
      normal encrypted application storage boundary and a restricted account.
- [ ] Record only a file count, agreement family, byte-size range, receipt
      date, and a hash or opaque receipt ID in the ledger. Never paste contract
      text or source pages into research notes.
- [ ] Record the processing location (customer-controlled self-hosted runner
      or approved managed environment), whether AI egress is disabled, and any
      approved subprocessors/model providers.
- [ ] Set a deletion date before processing. Unless a written customer
      agreement requires otherwise, delete the input corpus and generated
      customer output within 30 days of the success review and record the
      deletion receipt.
- [ ] If the customer withdraws consent or requests deletion, stop processing,
      delete the material, and mark the pilot `STOPPED`, never `FAIL` or `PASS`.

## 3. Pilot acceptance record

Before delivery, freeze the terms in one record. A changed volume, price,
workflow, or success threshold is a new pilot and cannot be merged with the
original evidence.

- [ ] Agreement family and exact volume are recorded (the default is 25
      redacted executed agreements).
- [ ] Scope is limited to cited actions, owners, deadlines, confidence,
      review state, and unresolved ambiguity. No legal advice, autonomous
      decisions, or external-system writes are promised.
- [ ] Pilot price, currency, payer identity/role, invoice or payment receipt,
      payment date, refund terms, delivery date, and success-review date are
      recorded before processing.
- [ ] Payment is non-refundable for the fixed scope, except where a written
      service failure clause applies. A refundable deposit, free trial, or
      verbal budget signal does not count as funded-pilot evidence.
- [ ] The customer names the next comparable batch or recurring trigger before
      the first delivery; this is a hypothesis until the customer independently
      requests it.

## 4. Delivery and review

- [ ] Record start/end timestamps and founder support minutes, excluding
      unrelated product work.
- [ ] Every proposed action has source text/page, confidence, owner, trigger or
      date, and one of `confirmed`, `corrected`, or `unable to determine`.
- [ ] The customer reviews the fixed usefulness question: “Would you assign,
      correct, or export this action?” Record useful, corrected, rejected, and
      unknown counts separately.
- [ ] Record corrections as customer feedback, not as hidden model accuracy.
      Never claim legal or compliance correctness from usefulness feedback.
- [ ] Record stop conditions, unresolved ambiguities, and any incumbent or
      manual workflow that already produced the same result.

## 5. Repeat-use evidence

A repeat is behavioral evidence only when the customer initiates it without a
founder-created cleanup request.

- [ ] Record the customer's dated request or purchase for the second cycle.
- [ ] Confirm the second cycle has the same agreement family, scope, and price
      basis, or explicitly record why the changed scope is still comparable.
- [ ] Record delivery, usefulness, corrections, support minutes, and deletion
      for the second cycle using the same fields.
- [ ] Link the second-cycle receipt to the same pseudonymous account ID and
      keep both cycles independently auditable.

## 6. Review and ledger decision

The founder reviews each row after the evidence is complete. A missing field is
`UNKNOWN`, not an inferred pass. Exceptions may explain context but cannot waive
payment, repeat-use, privacy, incumbent, or support-burden gates.

- [ ] Attach links only to restricted internal notes or redacted output receipts.
- [ ] Mark evidence quality for every claim: firsthand, secondhand, vendor,
      or unknown.
- [ ] Record reviewer, review date, decision, and exact failed gate.
- [ ] Reconcile the row against the Phase 0 ledger thresholds before updating
      any aggregate count.
- [ ] Confirm that no customer name, contract text, credential, raw token, or
      unredacted personal data entered the repository or public issue tracker.

## Minimum stop rule

Stop the intake and do not add a ledger row if consent, data handling,
economic-owner identity, fixed pilot terms, or deletion authority is unclear.
The correct outcome is `HOLD` with a reason, not a best-effort interpretation.
