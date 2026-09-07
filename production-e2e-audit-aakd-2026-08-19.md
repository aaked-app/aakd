# Aakd production E2E audit

Date: 2026-08-19  
Target: https://aakd.app  
Mode: observation and disposable-account testing only. No application code or production configuration was changed.

## Executive result

The public shell, authentication, contract intake, repository, file preview dialog, review queue, status changes, analytics, settings, API-key authorization, and empty states are reachable. The following confirmed P1/P2 issues prevent this from being a clean release candidate:

1. Uploaded-file previews generate an internal `http://minio:9000` URL. A normal external user cannot resolve that hostname, so preview/download is not production-safe.
2. Contract dates entered during intake are not persisted. The authenticated API returned `startDate`, `endDate`, and `renewalDate` as `null`; Renewal Watch therefore showed the contract as having no calculable date.
3. The obligation editor displayed a due date but rejected the form with `Due date is required`. The visible value and the form state diverged.
4. Protected API routes redirect unauthenticated callers to `/login` with HTTP 307 instead of returning a JSON 401 response.
5. `robots.txt` and `sitemap.xml` also redirect to login, preventing public crawlers from consuming them.
6. Several unfinished routes silently redirect to the dashboard rather than explaining that the feature is unavailable.
7. Spreadsheet import fails on a valid one-row CSV and exposes a raw Prisma `$queryRaw()` deserialization error in the UI.
8. Contract intake accepts a `.txt` file despite advertising PDF/DOCX-only support and proceeds to the review/create step.
9. Contract creation accepts an empty required title and creates a record without a name.
10. Contract edit also allows clearing the title and reports success.
11. Organization settings allow clearing the required organization name and report success.
12. Profile name can be submitted blank; the UI reports success but silently restores the old value.
13. Forgot-password blank submission provides no visible inline validation feedback.
14. Configured webhooks recorded no deliveries for synthetic contract events.
15. Ollama connection testing crashed onboarding for an incomplete configuration.
16. Invalid signer email crashed the signing workflow instead of validating inline.
17. Extraction could be submitted repeatedly while already in progress.

## Test account and data

- A disposable mailbox and workspace were created solely for this test.
- The mailbox address and password are intentionally omitted from this report.
- One synthetic PDF agreement was uploaded. It contained a provider, customer, start/end dates, automatic-renewal language, and a 30-day notice clause.
- The test workspace was named with a QA suffix. No real customer document was used.

## Findings

### P1: File preview exposes an internal MinIO hostname

Steps:

1. Upload a valid PDF.
2. Create the contract.
3. Open Files and select Preview file.

Observed:

- A preview dialog opens and an iframe is rendered.
- The iframe source and “Open in new tab” link use `http://minio:9000/...` with a signed URL.
- The URL is not a public Aakd host and is not HTTPS.

Impact: External users, browsers, reverse proxies, and many customer deployments cannot load the original document. This is a direct failure of the core repository and review workflow, and it may also leak deployment topology.

The Download file control reproduced the same defect: instead of producing a browser download, it navigated the current tab to the same internal MinIO URL.

Suggested verification after a fix: run the same flow from a browser that cannot resolve the internal Docker hostname and confirm preview, download, and signed URL expiry behavior.

### P1: Intake dates are silently lost

Steps:

1. Upload the synthetic PDF.
2. In the review step, enter Start date `2026-01-01` and End date `2026-12-31`, enable auto-renewal, and create the contract.
3. Open Renewal Watch.
4. Read the contract through the authenticated API.

Observed:

- The intake controls showed the entered dates before creation.
- The contract summary did not display dates.
- Renewal Watch displayed `End date —`, `Notice period —`, and `Notice deadline —`, classified under “Later or date unavailable.”
- The API response returned `startDate: null`, `endDate: null`, and `renewalDate: null`, while `autoRenewal: true` and `renewalReminderEnabled: true` were present.

Impact: A user can believe the renewal information was saved while Aakd cannot calculate reminders or renewal risk. This undermines one of the product’s primary post-signature workflows.

### P1: Obligation due-date control validates stale state

Steps:

1. Open Actions for the created contract.
2. Wait for the locally detected renewal-notice suggestion.
3. Select Review.
4. Enter due date `2026-12-01` and source reference `Page 1`.
5. Select Create obligation.

Observed:

- The date input visibly displayed `2026-12-01`.
- The form remained open and produced the alert `Due date is required`.
- The source reference was retained.

Impact: Users cannot reliably accept or create extracted obligations, even after filling the required field. The visible form state and validation state disagree.

### P1: Protected API endpoints return redirects, not API errors

Unauthenticated requests to `/api/contracts`, `/api/analytics`, and `/api/organizations` returned HTTP 307 with a `/login?callbackUrl=...` location.

Impact: API clients, agents, CLIs, and integrations receive an HTML/login redirect instead of a predictable JSON 401. This complicates error handling and can cause clients to follow a browser login flow unexpectedly.

### P2: Public crawler files are protected by authentication

Unauthenticated requests to `/robots.txt` and `/sitemap.xml` returned HTTP 307 redirects to `/login`.

Impact: Search engines and repository/agent crawlers cannot read the public crawler metadata. If these files are intentionally not part of the product, they should be removed from claims and deployment expectations; otherwise they need to be public.

### P2: Unfinished routes silently land on the dashboard

Direct navigation to `/ai/agents`, `/ai/create`, `/templates`, `/actions`, and `/settings/billing` resulted in the dashboard content (or Organization settings for billing) rather than a feature page, a 404, or an explicit “not available yet” state. The URL was not useful as a user-facing explanation.

Impact: Bookmarks, links, agents, and users cannot tell whether the feature is disabled, lost, or completed. This is particularly confusing because the rest of the product exposes phase/status language.

### P1: Spreadsheet import fails and leaks an internal database error

Steps:

1. Open Settings → Import → Spreadsheet.
2. Upload a valid one-row CSV with title, counterparty, status, value, currency, start date, and end date.
3. Confirm the preview and select Import 1 row.

Observed:

- The mapping preview loaded successfully.
- The import completed with 0 succeeded and 1 failed.
- The failed-row detail displayed the raw error: `Invalid prisma.$queryRaw() invocation ... Failed to deserialize column of type 'void'`.
- Import history recorded the failed row and offered retry.

Impact: A core migration path cannot import a valid basic record, and the UI exposes implementation/database details to users. The error should be converted to a safe actionable message after the underlying import failure is fixed.

### P1: Unsupported file type passes contract intake

Steps:

1. Open New Contract.
2. Upload a synthetic plain-text `.txt` file.
3. Select Continue to review.

Observed:

- The file chooser accepted the `.txt` file.
- The upload step displayed it as selected.
- Continue to review opened the metadata form and showed the file type as `TXT`.
- The user could proceed toward Create contract instead of receiving a format error.

Impact: The UI promises PDF/DOCX-only input, but unsupported files can enter the contract workflow and potentially become stored contract records. This also conflicts with the documented file-safety boundary.

### P1: Required contract title can be blank

Steps:

1. Upload the synthetic PDF and continue to review.
2. Clear the prefilled `Contract title *` field.
3. Select Create contract.

Observed:

- The form submitted without a visible validation error.
- A contract record was created and opened with no contract title in the summary/navigation.
- Activity entries recorded upload and creation normally.

Impact: Untitled records can enter the repository, making search, navigation, audit, and downstream notifications ambiguous. The required marker is not enforced at the submission boundary.

The same defect reproduced in the Edit contract dialog: clearing the Title field and selecting Save changes returned `Contract updated` without validation.

### P1: Organization name can be cleared

Steps:

1. Open Settings → Organization.
2. Clear Organization Name.
3. Select Save Changes.

Observed: the form returned `Organization updated` and accepted an empty name. The disposable workspace had to be restored manually for the remainder of testing.

Impact: A tenant can lose its primary display identifier, creating ambiguous navigation, invitations, notifications, and audit records. Server-side validation is required even if the UI marks the field as required.

### P2: Blank profile name reports success but does not save

Steps:

1. Open My Profile.
2. Clear Name.
3. Select Save changes.

Observed: the UI showed `Profile saved`, but the field and profile heading reverted to the previous name. No validation or explanation was shown.

Impact: Users receive a false success message and cannot tell whether blank names are unsupported or silently normalized.

### P2: Integration surface is broader than the tested deployment

The Integrations screen lists CRM, e-signature, cloud storage, communication, accounting, and developer categories. In the disposable workspace:

- CRM entries had Connect buttons but no credentials were available for a safe end-to-end OAuth test.
- Cloud storage and accounting Connect buttons were disabled.
- Communication entries were informational with no visible connection action.
- Developer entries showed Webhooks/REST API/Zapier/Make; Zapier and Make Connect buttons were disabled.
- DocuSeal was listed but no end-to-end signing test was run because it would transmit or sign data through an external service.

Impact: The UI does not clearly distinguish implemented, configured, and unavailable integrations. A customer may interpret a listed connector as ready when the current deployment cannot exercise it.

### P2: Invitation is recorded but delivery was not observed

Steps:

1. Send an invitation to a freshly created disposable mailbox.
2. Confirm the UI reports `Invitation sent` and shows one pending invitation.
3. Poll the mailbox for approximately 15 seconds.

Observed:

- The invitation was created successfully, appeared as pending, and had a 30-day expiry.
- No invitation message arrived in the disposable mailbox during the observation window.

Impact: The invitation API/UI path works at the database level, but delivery is unproven and may be misconfigured or delayed in production. Second-user acceptance and approval testing therefore remained blocked.

An invalid invitation address (`not-an-email`) also left the dialog open without a visible validation message after selecting Send Invite. The browser did not expose an actionable inline error; this should be rechecked with a real user-facing browser and treated as a P2 UX defect if the native constraint is not visible.

The same behavior appeared on Forgot password: selecting Send reset link with an empty email left the page unchanged without an inline explanation.

### P2: AI-dependent paths are not fully testable without a provider

The new workspace correctly labels AI configuration optional. Without a provider key:

- Onboarding exposes Anthropic, OpenAI, and Ollama plus custom model entry; Test connection and Save remain disabled until a key is entered.
- Contract review reports “AI extraction partially failed” and allows manual completion.
- Actions eventually produced a local renewal-notice suggestion and exposed a review dialog.
- Risk Analysis returned a clear `No AI provider configured` alert and remained available for a later retry.

This is a configuration limitation rather than a confirmed defect. A full provider test still requires a real disposable provider key and must be run separately.

### P2: Empty-state and basic settings checks

These passed in the disposable workspace:

- Dashboard, Contracts, Renewals, Obligations, and Analytics rendered useful empty states.
- Organization name/domain save returned `Organization updated`.
- Logo upload displayed an organization-logo image.
- API-key creation produced a one-time secret. A read-only bearer request to `/api/contracts` returned HTTP 200 and contract data. The generated key was not included in this report.
- Approval request opened a reviewer-selection dialog and remained disabled until a reviewer was selected.
- Editor explicitly stated that document editing is paused for Phase 0.
- The contract status menu exposed the expected lifecycle states and changing the test contract to Active produced a success alert and activity record.

Analytics initially counted one Active portfolio contract, but the `Recorded values by contract type` panel reported no recorded values even though the contract had a saved value of `$12,000`. Follow-up verification set the same synthetic contract type to `MSA`; the chart then displayed `MSA 12,000`, confirming that the grouping logic works for typed records. Untyped contracts are silently omitted rather than shown under an “Uncategorized” bucket. This remains a P2 reporting/UX gap because the portfolio total includes the record while the value chart does not explain its omission.

### P2: Status menu exposes invalid lifecycle transitions

On the Active synthetic contract, the Change status menu displayed Draft, Internal Review, Pending Approval, Awaiting signature, Expired, Terminated, and Archived. Selecting `Pending Approval` produced the user-facing error `Invalid transition: ACTIVE → PENDING_APPROVAL. Allowed: EXPIRED, TERMINATED, ARCHIVED`; selecting `Draft` produced the analogous invalid-transition error. The contract remained Active, so data was not corrupted, but the UI presents actions that the server will always reject for the current state.

Impact: users can reasonably choose an option shown in the menu and receive a confusing error instead of a state-aware menu or explanation. This also makes the approval workflow appear broken when reached from an Active contract. Reproduce with any Active contract and the Change status menu.

### P2: Per-contract renewal reminder controls are not exposed

The renewal system displays auto-renewal and reminder-derived fields, and the activity log lists `autoRenewal` and `renewalReminderEnabled` among contract attributes. However, the production Edit contract form exposes title, type, counterparty, value, currency, start/end/renewal dates, governing law, and notes, with no auto-renewal switch or per-contract renewal-reminder on/off control. The New Contract intake screen likewise has no visible reminder control before record creation.

Impact: a user cannot verify or change the reminder setting per agreement from the UI, despite the product model carrying those fields. This prevents the requested default-on/off workflow from being user-controllable and makes renewal behavior difficult to audit.

### Blocked version-history coverage

The Files tab correctly showed one current PDF version and Preview/Download controls. A second synthetic revision could not be uploaded through this browser harness because the exposed browser interaction API does not provide a file-input setter; this is a test-harness capability limitation, not a product finding. Version replacement, latest-version selection, old-version retrieval, and whether extraction/risk state is invalidated after a new file remain unverified.

## Coverage not completed

The following require external credentials, a second account, or a separate controlled test and are therefore marked BLOCKED rather than assumed to work:

- Anthropic/OpenAI/Ollama connection, extraction, Q&A, risk scoring, and AI-generated obligations.
- Invitation delivery and acceptance by a second user.
- Approval email/notification delivery and approval by a second user.
- DocuSeal signing and callback.
- Google Drive, Dropbox, OneDrive, HubSpot, Salesforce, Pipedrive, Slack, Teams, QuickBooks, Xero, Zapier, and Make.
- Webhook delivery, retries, signatures, and replay protection.
- Import execution for CSV, batch files, Drive, PandaDoc, and CLM exports.
- Multi-file contract intake. The new-contract file chooser currently reports `multiple: false`, so the flow accepts one file per contract record.
- File deletion recovery. The Delete file action opens a JavaScript confirmation, but this browser harness timed out while accepting the dialog; the synthetic file remained present, so post-delete review/action/risk behavior is unverified.
- Import retry execution. Retry failed items opens a JavaScript confirmation, but the browser harness timed out while dispatching the confirmation action; retry success/failure behavior is unverified.
- Browser/mobile accessibility and localization across all five languages.
- Production backup/restore, rate limits, file-size boundaries, malware handling, and multi-tenant isolation under two real organizations.

After the file-dialog blocker, a fresh browser tab confirmed the synthetic file ledger remained intact without a fatal page, and a second pass over Dashboard, Contracts, Renewals, Obligations, Analytics, and Members produced no new product defects.

After the import-retry dialog blocker, a fresh tab confirmed Import history still rendered without a fatal state, and a second clean pass over Dashboard, Contracts, Renewals, Obligations, Analytics, and Notifications produced no new product defects.

The multilingual settings pass also completed cleanly: French, German, Spanish, Arabic, and English updated the document language; Arabic set `dir=rtl`; and each selection rendered a localized Organization heading. No new localization defect was observed in this pass.

Personal email-notification preferences also persisted correctly in a disposable toggle test: Contract signed was changed off, saved, confirmed off after reload, then restored on and confirmed persisted. No new notification-preference defect was observed.

Two route-surface stability passes followed: the first covered personal notifications, billing redirect, search, and version comparison; the second covered Dashboard, Contracts, Renewals, Obligations, Analytics, and Organization settings. Neither produced a new fatal state or product defect.

Search edge-case coverage passed: empty queries, SQL-like text, and HTML-like text produced safe empty states; a real contract-name query returned both matching records; and selecting the MSA filter narrowed the result set to the single typed contract. No injection or navigation defect was observed.

The remaining contract-detail routes were also exercised: Version Comparison showed a clear no-snapshot state, Approval Workflow showed a clear no-workflow state, Signing Workflow required a signer before send, and all obligation status filters preserved the empty state without errors.

## Recommended fix order

1. Fix public storage URL generation and verify preview/download from an external browser.
2. Fix controlled date persistence in intake and edit forms, then verify renewal calculations and reminders from the API and UI.
3. Fix obligation due-date state/validation and add a regression test for visible date plus successful creation.
4. Return JSON 401/403 responses from API routes without redirecting browser middleware.
5. Make crawler files intentionally public or remove them from the public surface.
6. Replace silent unfinished-route redirects with explicit unavailable/phase messaging.
7. Fix spreadsheet import and remove raw Prisma error details from user-facing failures.
8. Reject non-PDF/DOCX files before review and again at the server boundary.
9. Label integrations as available, configured, or coming later and run credentialed E2E tests before claiming readiness.

## Final disposition

Audit status: **FAIL for final release sign-off** until all confirmed P1 workflow/data defects are fixed and re-tested. No production fixes were made during this audit.

## Automated verification

The repository Vitest suite completed successfully: **100 test files, 1,524 tests passed**. The suite includes auth, isolation, imports, webhooks, AI configuration, CRM, and worker behavior. Its error-looking log lines are deliberate fault-injection cases from the tests, not failed assertions. This does not replace production browser testing because the confirmed production defects above occur in deployed wiring and UI state handling.

A targeted Playwright run of authentication, contracts, and contract-operations E2E tests found **11 passed, 1 failed**. The failing regression test `uploaded contract exposes renewal facts and starts obligation review` timed out looking for `autoRenewal`, `true`, and the extracted notice value in the Review tab. This independently corroborates the production observation that extracted/renewal facts are not reliably present after upload and creation. The trace and error context were left in the local Playwright test-results directory.

A second targeted run of contract creation plus search found **5 passed, 1 failed**. The contract-creation regression timed out looking for the expected extracted `MASTER SERVICES AGREEMENT`, effective date, and source-page citation after upload. Search tests passed. This is a separate reproduction of the extraction/review failure path.

The complete Playwright suite ran 59 tests and ended with **18 passed, 41 failed**. Most of those failures were test-harness preconditions rather than product assertions: the visual matrix was invoked without its expected locale metadata and seeded `owner.json` storage state (`Unsupported visual locale: undefined` and missing `.auth/owner.json`). The two functional regression failures were the same contract-creation and contract-operations extraction failures described above. The harness failures still need to be fixed before the suite can serve as a trustworthy release gate.

### Follow-up pass results

The lifecycle follow-up successfully moved the synthetic contract Active → Expired, verified the Expired badge and Contracts filter, then restored it to Active. Dashboard and Renewal Watch reflected the restored Active state. The only new defect from that pass was the invalid-transition menu documented above.

The API boundary pass reconfirmed that unauthenticated `/api/contracts`, `/api/analytics`, and `/api/organizations` requests redirect with HTTP 307 to `/login` for all tested methods instead of returning machine-readable JSON 401 responses. `/api/health` returned HTTP 200 with database and Redis checks healthy. Public response headers included HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a restrictive Permissions Policy, and a strict-origin Referrer Policy; no new header defect was identified.

A focused navigation smoke pass loaded Dashboard, Contracts, Renewals, Obligations, Analytics, Organization settings, Profile, Notification settings, and API Keys without a new fatal navigation failure. Existing known reporting/configuration issues remain recorded separately.

The disposable draft archive path also passed: Archive showed a confirmation, removed the record from the repository list, retained the record at its direct URL as Archived, and exposed a Draft recovery transition. From Draft, Send for approval opened the reviewer-required dialog and correctly kept Request approval disabled until a reviewer was chosen; no request was submitted.

The integration and import-surface follow-up did not add a confirmed product defect. The UI clearly labels Google Drive, Dropbox, OneDrive, QuickBooks, Xero, Zapier, and Make as `Soon` with disabled controls; Slack and Teams are labeled `Not configured`; DocuSeal is labeled `Connected` and its Configure action explains that environment variables and the self-hosting guide are required. CRM Connect is enabled, but following HubSpot Connect in this browser ended at Chrome's `ERR_BLOCKED_BY_CLIENT` page before an OAuth response could be observed, so it remains a credential/browser blocker rather than a confirmed application defect.

Import history correctly retained failed spreadsheet rows and exposed a Retry failed items control. The expanded failure view includes the original source row JSON and validation message. This is useful for repair, though raw source-row display should be checked against privacy expectations with real sensitive data; no new defect was promoted from synthetic data.

After the renewal-control finding, two consecutive focused passes produced no additional product defects. The first reloaded all core pages plus integrations, imports, and audit log without navigation or authentication regressions. The second revisited Approvals, Risk, Actions, and typed-contract Analytics; all expected panels rendered and the MSA value grouping remained visible.

The contract-list bulk-selection pass also behaved consistently: Select all selected both records and exposed Export/Archive actions; after invoking Export, the list returned to its unselected state without changing records. The export artifact itself could not be independently captured by this browser harness, so download-content validation remains unverified.

The API-key follow-up confirmed the disposable read-only key is still listed as Active and shows a recent last-used timestamp. Clicking Revoke opened a JavaScript confirmation dialog, but the browser harness timed out while dispatching the click and could not complete the dialog action; the key therefore remains active. This is a test-harness blocker for revocation verification, not evidence that revocation is broken.

### P2: Webhook destination path is silently discarded

In the disposable workspace, I created a synthetic webhook with destination `https://example.invalid/aakd-qa`. After creation, the configured webhook card displayed and retained only `https://example.invalid`, with the path removed and no warning. The webhook was then deleted successfully through the confirmation dialog.

Impact: webhook endpoints commonly route by path; silently normalizing a user-provided path to the origin could deliver events to the wrong handler or make a valid endpoint unusable. Reproduce by creating any webhook whose URL includes a non-root path and comparing the saved/displayed destination.

### P1: Configured webhooks record no deliveries for contract events

Using a synthetic enabled webhook pointed at `https://example.invalid/aakd-delivery`, I changed the disposable contract Active → Expired → Active. Both status changes succeeded and appeared in the contract activity log. The webhook’s View deliveries page remained `No deliveries · newest first` after more than five seconds and after a page reload, with no attempt, failure, HTTP status, or retry record.

Impact: a customer cannot tell whether outbound contract events were sent, failed, or queued, and the advertised operational evidence/retry surface is empty even after lifecycle events. This needs a controlled endpoint test after the worker/queue configuration is confirmed. The synthetic webhook remains enabled until cleanup is completed.

The synthetic delivery webhook was deleted successfully. A cleanup pass confirmed zero configured webhooks and no fatal state, followed by a second clean pass across Dashboard, Contracts, Renewals, Obligations, Analytics, and Audit Log.

After the webhook finding, two consecutive focused recovery passes produced no additional product defects: notification settings reloaded with the synthetic webhook removed and zero configured destinations, and the Members, Contracts, Renewals, Obligations, and Analytics pages all loaded without redirects or application-error text.

The pending disposable invitation was cancelled through its confirmation dialog and disappeared from the Members list with an `Invitation cancelled` notification. This cleanup path passed; invitation delivery and acceptance remain blocked as documented earlier.

Authentication follow-up passed without a new defect: blank sign-in remained browser-native required-field validation, invalid disposable credentials returned the generic `The email or password is incorrect.` message, weak registration passwords returned `Password must be at least 8 characters`, and password recovery used a privacy-preserving `If ... has an account` response for a nonexistent address.

The valid Draft → Pending Approval transition also passed. The contract displayed `Pending Approval`, the Approvals tab exposed Request approval, and no approval request was created until a reviewer is selected. The synthetic record was restored to Draft afterward.

### P2: Provider model selector is static, not discovered

The onboarding AI configuration selector exposed only one built-in model per provider (`claude-haiku-4-5` for Anthropic and `gpt-4o-mini` for OpenAI) plus a manual custom-model option. The copy says “Choose a discovered model,” but there is no refresh/discovery control or provider model listing, and the selector cannot reflect newly released models without a deployment change. This is a product limitation rather than a failed provider call because no real key was entered.

Impact: users must know and manually enter model IDs for newer or organization-specific models, and the default list can become stale while implying automatic discovery.

### P1: Ollama connection test crashes the onboarding page

In onboarding, selecting `Ollama Local / self-hosted` leaves the default base URL `http://localhost:11434` and an empty Model name. Clicking the enabled `Test connection` button navigated the entire app to the generic `500 Something went wrong` page instead of validating the missing model or showing a recoverable connection error. No external Ollama service was available in this test.

Impact: an ordinary incomplete configuration can take the user out of onboarding and hide the actionable error. Reproduce with a disposable workspace by selecting Ollama, leaving the default URL/model fields unchanged, and clicking Test connection.

After the Ollama crash finding, recovery was verified: reopening `/onboarding` returned to the normal setup screen without a persisted error, and a second pass over Dashboard, both synthetic contract records, Renewals, Obligations, and Analytics produced no fatal pages or new product defects.

### P1: Invalid signer email crashes the signing workflow

On the synthetic contract’s Signing Workflow, Add Signer enabled as soon as a name and the string `not-an-email` were entered. Selecting Add Signer navigated the page to `This page couldn’t load` with only Reload and Back controls instead of showing field validation. No signature was sent and no signer was added.

Impact: a common input error takes the user out of the signing workflow and provides no actionable correction. Reproduce from any contract’s Signing Workflow by entering a valid name and malformed email before adding the signer.

Reloading the Signing Workflow recovered normally, and a second clean pass over Dashboard, Contracts, Renewals, Obligations, Analytics, and Integrations produced no new fatal state or product defect.

### P2: Extraction can be submitted repeatedly while already in progress

On the Review tab, clicking `Run extraction again` changed the panel to `Document analysis is in progress…` but left the button enabled. Clicking it again before completion was accepted. The audit log subsequently contained three separate `AI extraction re-triggered manually` entries for the same contract within the same minute, while the UI showed only one final suggestion set.

Impact: users can unintentionally enqueue duplicate extraction work, increasing latency and provider cost and creating ambiguous activity history. The button should be disabled or show an explicit in-progress/duplicate-request state until the current job finishes.

After the duplicate-extraction finding, the review queue settled back to a completed suggestion state, and a second stability pass over Actions, Risk, Approvals, Dashboard, and Analytics produced no additional product defects.

Two consecutive focused follow-up passes after the lifecycle-menu finding produced no additional product defects: (1) API boundary plus core-page navigation, and (2) archive recovery plus approval-dialog readiness. The safe, externally accessible synthetic-data surface is therefore exhausted for this run. Credentialed integrations, second-user/email delivery, provider-backed AI, version replacement, deletion/import-retry dialogs, and tenant-isolation testing remain explicitly blocked or incomplete; they are not treated as passes.

## Audit closure

This audit goal is complete for the reachable production surface: defects were recorded with reproduction evidence, recovery was checked after later findings, and repeated focused passes produced no new product defects. The application is not release-approved. The next engineering task should be to fix the confirmed P1 issues first, then rerun the blocked coverage with a second disposable user, working provider credentials, and a browser harness that can safely complete confirmation dialogs.

## Post-audit access setup (2026-08-19)

- A second disposable Aakd account and organization were created successfully.
- OpenAI configuration passed connection testing with the supplied temporary key. The provider returned a live model list, so model discovery works when a valid provider key is configured.
- A disposable invitation was created successfully for a third test address, but Gmail search found no delivered invitation message. Acceptance therefore remains blocked by production email delivery.
- A disposable DocuSeal Cloud account was created successfully. Aakd's DocuSeal card reports environment-variable configuration, but a complete signing E2E still requires a test contract and the configured deployment's API/endpoint.
- Google Drive is explicitly marked `Soon` and its Connect button is disabled, so it cannot be tested as an active integration.

### Additional provider-backed API validation

Using a disposable write-scoped API key and the synthetic PDF fixture, the API-backed path completed successfully: contract creation returned 201, PDF upload returned 201 and queued extraction, text extraction completed, OpenAI risk scoring returned `MEDIUM` with category details, obligation extraction returned three cited suggestions, and accepting the renewal-notice suggestion created a pending obligation and a linked proposed action. This confirms that the core worker/AI path is functional when exercised without the browser file chooser. Signing still requires a complete DocuSeal-backed contract submission test.

The same API key answered authenticated reads and writes, then was revoked through the API and correctly returned 401 afterward. Initiating signing with the owner-created key returned 403 (`Only admin or legal roles may initiate signing`), so owner-role signing remains unverified and should be checked against the intended role policy in the UI.
