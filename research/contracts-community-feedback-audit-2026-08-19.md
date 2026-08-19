# Contract-management community feedback: provenance audit and evidence extension

**Research cutoff:** 2026-08-19  
**Status:** complete; rules-based audit below
**Scope:** Public community evidence about contract work and contract-management solutions. This is a product-agnostic evidence audit, not a market-size estimate, product evaluation, or recommendation.

## Executive position

The legacy material is useful as a lead index, not as prevalence evidence. Its best surviving layer is 1,200 PullPush submission rows recoverable only from Git history; attempted comment files are rate-limit errors, and later narratives combine operator reports, requests, consultant views and promotion without a consistent observation-level ledger. The current audit therefore re-coded source-level episodes, searched deliberately for counterexamples, and kept community evidence separate from official/vendor market facts.

The strongest conclusion is about **variation**, not frequency. Firsthand accounts show all of the following can be true: a spreadsheet, shared drive and reminders can be enough for a small or low-complexity portfolio; renewal and repository failures can still occur under that status quo; expensive CLM deployments can fail through process, migration, integration or adoption; and configured CLM or suite-native systems can work well. AI reports are similarly conditional: unconstrained review produces nondeterministic or structurally wrong output in some episodes, while narrow extraction, scoring, first-pass review and human-validated workflows are useful in others. These accounts support the existence of the failure modes in the two baseline reports, but they cannot establish incidence, causal effect, product performance, willingness to pay, or a universal buying segment.

The final coding set contains **55 raw candidate statements**, of which one repeated crosspost and two deleted/unverifiable candidates were excluded. The [source ledger](contracts-community-feedback-audit-2026-08-19/source-ledger.csv) contains **52 deduplicated usable observations** from **17 parent URLs**: 50 Reddit observations and two long-form community sources. Forty dated queries across eight platforms are recorded in the [search log](contracts-community-feedback-audit-2026-08-19/search-log.csv). Non-Reddit yield was poor; that access and sampling weakness is a finding about this research process, not evidence that operators do not discuss the subject elsewhere.

## 1. Evidence policy and codebook

### Evidence labels

| Label | Operational definition |
|---|---|
| `FIRSTHAND_OPERATOR` | The author describes work they personally perform, a contract episode at their organization, or a tool they personally use. |
| `FIRSTHAND_IMPLEMENTER` | The author says they implemented, configured, migrated, administered, or supported the system discussed. |
| `REQUEST` | The author seeks a tool, recommendation, workflow answer, or help; it establishes the request, not that a solution works. |
| `SECONDHAND_OPINION` | A view or recommendation without a stated firsthand episode. |
| `CONSULTANT` | Commentary from a consultant or implementation partner; expertise is relevant but incentives and client-selection effects apply. |
| `VENDOR_AFFILIATED` | Vendor employee, founder, seller, named implementation partner, affiliate, or clearly promotional account/content. |
| `UNVERIFIABLE` | Deleted, unavailable, missing a stable identifier, or otherwise impossible to audit at observation level. |
| `AFFILIATION_UNKNOWN` | Added to any non-affiliated label when affiliation could not be established from the post/thread itself. Absence of disclosure is not proof of independence. |

### Theme codes

`STATUS_QUO`, `INTAKE`, `NEGOTIATION`, `REPOSITORY_SEARCH`, `RENEWALS`, `OBLIGATIONS_HANDOFF`, `AGREEMENT_FAMILY_AMENDMENTS`, `IMPLEMENTATION_MIGRATION_ADMIN`, `INTEGRATIONS`, `AI_ACCURACY_PROVENANCE_REVIEW`, `SECURITY_DEPLOYMENT`, `PRICING_WTP`, `BUYER_OWNER`, `ADOPTION`, `COUNTEREXAMPLE_SUCCESS`.

### Dedupe and inference rules

1. Canonicalize platform URL/ID; one submission or video is one parent object, while independently authored comments may be separate observations.
2. Collapse exact crossposts, quoted reposts, repeated vendor copy and repeated author claims that describe the same episode. Preserve the earliest or most complete source and list the aliases.
3. Report raw records, usable observations, unique URLs/IDs and unique public authors separately. Never convert their distribution into population prevalence.
4. Company size is `UNKNOWN` unless the observation states an employee, customer, revenue, contract-volume, or similarly direct clue. A recognizable company name is not a size clue.
5. Geography is stated-only. Subreddit, spelling, currency, profile location and vendor headquarters are not enough to infer the operator's geography.
6. Short quotations are evidence anchors, not substitutes for context. No deleted-content recovery, private data, profile enrichment, or bulk republication.

## 2. Complete located-inventory checkpoint

The search covered current repository filenames and content, `~/brain/`, and reachable Git history. Current-worktree material is distinguished from historical Git objects because only the former can be audited without naming a commit.

| Location | Format / platform | Apparent collection window and topic | Count and preserved fields | Provenance and quality verdict |
|---|---|---|---|---|
| `research/audit-2026-07-16/reddit-raw/scrape.log` (current worktree; untracked) | Text log; Reddit via PullPush | Log timestamp 2026-07-18; 12 broad queries: contract management/lifecycle, CLM software, tracker, renewals, repository, open source and self-hosting | Reports 12 × 100 submission returns and an initial 1,005-ID aggregation; logs attempted comment pulls. No authors/body text in the log. | Auditable as collection-process evidence only. It shows substantial irrelevant-query noise and partial execution, not 1,005 relevant observations. |
| `research/audit-2026-07-16/reddit-raw/filter.log` (current worktree; untracked) | Text log; Reddit | 2026-07-18 strict re-filter of cached broad searches | Reports 146 unique filtered submission IDs with titles, subreddit, score/comment metadata; nine comment pulls returned zero. | Auditable as a filter trace. Many displayed records are visibly irrelevant, so “strict relevant” is not a validated label. |
| `research/audit-2026-07-16/reddit-raw/subscoped.log` (current worktree; untracked) | Text log; Reddit | 2026-07-18; `r/selfhosted` queries `contract` and `CLM` | Both logged as zero after `GIVEUP`; no posts or authors. | Empty/failed scrape, retained as negative access evidence; not evidence of no discussion. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/reddit-raw/submissions/term_1.json` … `term_12.json` | JSON; Reddit/PullPush | Data retrieved in 2025 and collected 2026-07-18; the exact 12 queries are recoverable from the paired script/log | 1,200 raw rows (100 each). Full snapshots retain Reddit ID, public author, `created_utc`, permalink/URL, title, self-text, subreddit and engagement metadata. Duplicate count across query files remains to be computed. | Most auditable legacy dataset, but broad homonyms produced sports, programming, employment and finance noise. It must be re-coded from source rows, not trusted through the legacy relevance filter. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/reddit-raw/relevant_submissions.json` | JSON; Reddit/PullPush derivative | 2026-07-18 re-filter of the 1,200 rows | 146 unique IDs; all 146 retain permalink and timestamp, but self-text was truncated to 800 characters and author was dropped. | Auditable at parent-post level by joining to raw term files. Not an observation ledger; its relevance gate has false positives and cannot support author dedupe alone. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/reddit-raw/comments/{14gw99f,1kfeari,1kkuu61,1kp25wm,ls9fyk,pytt6l,up2ezv,wfnvme,wydiah}.json` | JSON; Reddit/PullPush | 2026-07-18 attempted comment-tree pulls | Nine files, zero comments; each contains only `{"error":"Rate limit exceeded"}`. | Fully auditable failures. They cannot substantiate any comment claim. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/reddit-raw/subscoped/{opensource_contract,selfhosted_CLM,selfhosted_contract}.json` | JSON; Reddit/PullPush | 2026-07-18 subreddit-scoped open-source/self-hosted queries | Three files, zero posts; each is a rate-limit error. | Fully auditable failures, not zero-result searches. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/{scrape_reddit_clm.sh,filter_and_pull.sh,scrape_subreddit_scoped.sh}` plus the three logs above | Shell + text; Reddit | Collection/filter methods for the July corpus | Exact queries, endpoint templates, caps, exclusions, backoff and known prior thread IDs are preserved. | Strong process provenance. Weaknesses: top-100 caps, engagement sorting, text truncation, brittle regex relevance, incomplete comment trees and no author/affiliation/size coding. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/voice-of-customer.md` | Markdown; mainly Reddit, plus Hacker News and review-site search | 2026-07-16/18; category complaints, alternatives, self-hosting and AI | 179 lines / 3,666 words; contains links for many parent threads and some quotes/handles/dates, but not a row-level ledger. | Usable as a discovery index. Claims sometimes merge posts/comments, count thread activity as demand, or rely on snippets/vendor pages. Promotional risk is flagged selectively, not systematically. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/voice-of-customer-deep.md` | Markdown; Reddit plus HN, Lemmy and inaccessible review sites | 2026-07-18; deeper comment pass on self-hosting/open source | 166 lines / 4,213 words; states six fully pulled Reddit trees, roughly 45 comments read, roughly 150 HN comments reviewed, Lemmy searches and access failures. | Better about access gaps and vendor-like comments than the first report, but no machine-readable observation ledger, several approximate counts, large verbatim extracts, and conclusions that exceed the small/self-selected sample. Mastodon was explicitly not attempted. |
| Git objects `c2f27f7` / `a3f0c6a`: `research/reddit-threads-raw.md` | Markdown; Reddit | Saved 2026-05-09; 10 selected threads across procurement, project management, legal technology and small business | 231 lines / 2,972 words; titles, handles, relative ages, engagement and long excerpts; stable thread URLs/IDs are absent. Threads 7 and 8 are explicitly duplicates. | Not a raw archive despite its title: it is curated/transcribed and not observation-level auditable. Affiliation is sometimes disclosed in prose but not consistently labelled. Treat all unsupported excerpts as `UNVERIFIABLE` until matched to a stable ID. |
| Git object `744e087` / `a3f0c6a`: `research/reddit-community-voice.md` | Markdown; Reddit | Compiled 2026-05-10 from named subreddits; operator pain and workflow claims | 320 lines / 3,596 words; some stable parent links, many unattributed “multiple threads” or subreddit-level observations, long excerpts and engagement counts. | Mixed auditability. Strong leads where a parent ID exists; weak where the report omits the comment permalink/author/date. It makes unsupported prevalence inferences from upvotes and selected anecdotes. |
| Git object `c2f27f7` / `a3f0c6a`: `apps/web/.claude/agent-memory/ceo/reddit_clm_insights.md` | Markdown; Reddit derivative | 2026-05-09; summary of 10 selected threads | 129 lines / 1,290 words; no complete observation ledger. | Second-order synthesis, not independent evidence. It duplicates the selected-thread archive and must not be double-counted. |
| Git object `a3f0c6a`: `research/audit-2026-07-16/competitor-landscape.md` | Markdown; vendor/status-quo derivative with social citations | 2026-07-16; solution alternatives and pricing | Narrative report with social leads, vendor sources and some pricing snippets; not a raw scrape. | Inventory as a derivative only. Vendor claims and user claims need separate evidence labels; it is superseded for market facts by the current solutions landscape. |
| `~/brain/decisions/clm-voice-of-customer.md` | Markdown memory summary | 2026-07-16; summary of the July social work | Seven headline findings and caveats; points to a report that is absent from the current worktree but recoverable at `a3f0c6a`. | Tertiary memory. It is not independent evidence and contains frequency/market conclusions that must be re-tested against source-level observations. |

### Inventory exclusions after screening

Repository launch copy, community-post drafts, GTM plans, generic social-media guidance, project specs that cite prior research, and unrelated social corpora in `~/brain/projects/` were found but are not community feedback datasets or derivatives about contract operations. They are therefore excluded from observation counts. The two current baseline reports being audited are comparison targets, not prior social datasets.

### Inventory count summary

- Current worktree: **3** legacy collection logs; all are untracked, and no legacy raw JSON or narrative report is present.
- Recoverable historical collection corpus: **12** raw submission JSON files (**1,200 raw query-return rows**), **1** 146-ID filtered derivative, **9** failed comment JSON files, **3** failed subreddit-scoped JSON files, **3** collection/filter scripts, and **3** logs.
- Recoverable historical narrative/derived artifacts: **5** directly relevant reports/summaries, plus **1** market derivative.
- Brain: **1** directly relevant decision-memory summary; no raw contract-community scrape was found there.
- Platforms with actual legacy source records: Reddit. HN and Lemmy appear only through narrative result descriptions; no raw HN/Lemmy export was located. X, Bluesky, Mastodon, YouTube, Product Hunt and other forum raw/derived contract-feedback artifacts were not found.

## 3. Provenance defects requiring correction

1. **“Raw” does not always mean raw.** The May selected-thread Markdown file is a transcription without stable IDs; only the July JSON snapshots qualify as raw source exports.
2. **Comments were the stated high-value layer but are not preserved in the July JSON corpus.** All nine attempted files are rate-limit errors. The deep report says other comment trees were read, yet those source JSONs were not found in the repository or brain.
3. **Author information was lost in the 146-row filtered derivative.** It can be restored only by joining against the 12 original query files.
4. **Affiliation detection was ad hoc.** A vendor-looking username or polished pitch was sometimes flagged, while other enthusiastic recommendations were accepted without a consistent check. This audit will label affiliation conservatively.
5. **Engagement was treated as prevalence.** Upvotes and comment counts indicate visibility/interaction on a selected post; they do not establish how common a workflow or failure is among companies.
6. **Collection and event dates were blurred.** Relative ages (“six months ago”) and report compilation dates are not observation dates. This audit uses source timestamps when available.
7. **Selection bias was severe.** Broad keyword searches generated false positives, while later hand-selection emphasized pain, self-hosting and category dissatisfaction. Positive implementations and “current tools are enough” cases require deliberate searches.
8. **Cross-report duplication was not controlled.** The May summary, May thread transcription, July reports and brain memory repeat many of the same source claims; they are one evidence lineage, not multiple corroborations.

## 4. Current collection and count reconciliation

Collection ran on 2026-08-19 using the repository-independent `signal.sh` workflow plus web discovery. The query-level record includes exact query text, method, returned count where exposed, usable yield and failure reason. Search-provider batches that did not expose per-query counts are marked `combined`; they are not assigned invented numbers.

| Discovery platform | Attempts | Exposed raw returns | Deduplicated observations selected | Result |
|---|---:|---:|---:|---|
| Reddit | 19 | Provider did not expose a comparable total; ten direct `signal.sh` calls returned no parseable rows | 50 | Productive through indexed web results; direct PullPush submission/comment routes were empty or blocked. |
| Hacker News | 3 | 45 | 0 | Launches, vendor links and homonyms; no clear company operator episode selected. |
| X | 6 | One directly retrieved post; web-batch counts unavailable | 0 | Discovery was dominated by promotion/opinion. The retrievable post was consultant commentary, not an operator episode. |
| Bluesky | 3 | 0 | 0 | Public search returned HTTP 403; profile lookup working did not solve discovery. |
| YouTube / long-form community search | 3 | Combined counts unavailable | 2 | No suitable direct transcript; one operator-authored association article and one customer/vendor session were retained with different affiliation labels. |
| Lemmy | 2 | 30 | 0 | Political, employment and government-contract homonyms; no selected operations episode. |
| Mastodon | 3 | 60 | 0 | Mostly vendor marketing, news relays and jobs. |
| Product Hunt | 1 | 15 current-feed items | 0 | No relevant daily launch; not a historical search. |
| **Total** | **40** | **At least 151 countable returns, plus uncounted web batches** | **52** | Eight platforms attempted; usable evidence is heavily Reddit-skewed. |

### Raw, usable and deduplicated counts

- **55 raw candidate statements** entered the final coding pass. This is a review-set count, not the total number of search-result cards seen.
- **Two deleted/unverifiable candidates** lacked enough stable source context and were excluded rather than reconstructed.
- **One repeated crosspost** by the same public handle used nearly identical text for the same claimed 600-person-company episode. It is one observation, not two.
- **52 usable, episode-deduplicated observations** remain in the ledger: 39 firsthand (`FIRSTHAND_OPERATOR` 29; `FIRSTHAND_IMPLEMENTER` 10), five `SECONDHAND_OPINION`, four `CONSULTANT`, three `VENDOR_AFFILIATED`, and one `REQUEST`.
- The observations resolve to **17 parent URLs** and **44 distinct known public author strings**. Hidden handles remain `handle_not_exposed`; no attempt was made to identify them. Repeat authors were retained only where they described a different episode or role and were never counted as independent corroboration of their own earlier claim.
- Affiliation is explicitly known for only three observations. The other 49 are `AFFILIATION_UNKNOWN`, not “independent.”

The two recovered legacy narratives contain **55 unique URLs in total: 41 Reddit, three Hacker News, and zero X/Twitter URLs**. No prior X/Twitter raw scrape, URL ledger or derived X dataset was located in the worktree, Git objects reviewed, or `~/brain/`. A recollection that Twitter had previously been scraped is therefore **not supported by located artifacts**.

## 5. What the usable observations say

These findings establish that a pattern occurred in the coded cases. They do not estimate how often it occurs in the market.

### 5.1 Status quo and renewal operations — high confidence on existence, no prevalence claim

The status quo is both a workable control and a failure mode. A six-person team described shared Drive as adequate; another respondent recommended one structured folder plus one spreadsheet row per agreement; a procurement user described a master Excel register with Power Automate escalation; and a public-sector operator was configuring Planner reminders. Those are direct counterexamples to any claim that every organization needs full CLM. [Six-person workflow discussion](https://www.reddit.com/r/projectmanagement/comments/1sb8nx1/how_your_contract_lifecycle_management_works/), [procurement training discussion](https://www.reddit.com/r/procurement/comments/1qknvxh/any_practical_contract_management_training/), [expiry-tracking discussion](https://www.reddit.com/r/procurement/comments/1egnzz4/tracking_expiring_contracts_whats_the_best_way/)

The same tools depend on disciplined ownership and timely inputs. The small state-agency poster said Excel tracking began procurement too late and needed different 30/90/120-day lead times. Another procurement lead described expired or auto-renewed supplier contracts and outdated terms under manual follow-up. The defensible claim is that renewal control needs an owner, reviewed dates and an escalation path; the evidence does not prove a platform is the necessary control or quantify avoided spend.

### 5.2 Implementation, migration and adoption — high confidence

Implementation experience is the densest theme in the coded set (17 observations), with both failures and successes. Reported failures include a three-year subscription that never became usable, a four-year experience of breakage, IT selecting/configuring a system without legal users, failed extraction across 7,500 legacy agreements followed by termination, and a very large conglomerate where one AI integration reached only about 5% of legal users. [Icertis implementation](https://www.reddit.com/r/legaltech/comments/1jzkgd0/icertis_implementation/), [Docusign CLM discussion](https://www.reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/), [Ironclad/Evisort evaluation](https://www.reddit.com/r/legaltech/comments/1ok5bin/ironclad_vs_evisort_looking_for_insight_or/), [multi-CLM enterprise account](https://www.reddit.com/r/legaltech/comments/1t2u2ms/multiple_clms_partial_ai_deployment_and_a_siloed/)

Counterexamples matter. One administrator reported self-implementing more than 50 workflows over five years; one procurement user said Ironclad worked well with Coupa; another commissioned GEP customization across contracts, sourcing, requisitions, POs and catalogs; and an operator-authored implementation account describes mapping Sales, Legal, Order Management and Revenue before prioritizing workflows. [Positive/mixed evaluation thread](https://www.reddit.com/r/legaltech/comments/1ok5bin/ironclad_vs_evisort_looking_for_insight_or/), [procurement systems thread](https://www.reddit.com/r/procurement/comments/1fo6cvc/contract_management_systems/), [ACC implementation account](https://www.acc.com/resource-library/lessons-front-lines-clm-implementation)

The synthesis is conditional: software, data, process ownership, integration and adoption interact. Social evidence cannot isolate which factor caused an outcome or rank vendors.

### 5.3 Pre-signature versus post-signature pain — medium confidence

The sample complicates a post-signature-first story. In-house counsel and a contracts manager described negotiation workflows as unusable when legal users were omitted; another practitioner described a workable division in which Word remains the negotiation surface and CLM supports post-signature reporting. AI first-pass redlining also generated both positive and negative reports. [CLM experience discussion](https://www.reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/), [in-house AI use cases](https://www.reddit.com/r/legaltech/comments/1ux5hsz/ai_use_cases_for_inhouse_legal_counsels/)

Post-signature evidence is clearest for repository/search, renewals, owner handoff and cross-system continuity. Only four coded observations directly described broader obligation handoff, and none supplies a measured financial consequence. Thus the baseline claim that signing is not the end of the lifecycle is supported, while the narrower proposition that post-signature handoff is the primary paid pain remains untested.

### 5.4 Agreement families and non-standard documents — high confidence on the documented case

A public-tender operator reported 300–1,200-page, mostly Dutch-language, multi-file agreements whose appendices were treated as separate contracts; the tested tool also imposed a 10MB cap and failed extraction. This is a concrete counterexample to flat “one file equals one contract” assumptions and to English/short-document test sets. It does not show whether language, file structure, size, configuration or product limits caused the failure. [Contract-management tools discussion](https://www.reddit.com/r/ContractManagement/comments/1okba00/what_do_you_use_for_contract_management/)

Agreement-family/amendment evidence remains thin (four coded observations), so the detailed agreement-family model in the domain report continues to rely primarily on executed agreements, standards and operator documentation rather than this social sample.

### 5.5 AI accuracy, provenance and review — high confidence that outcomes are conditional

Negative episodes include nondeterministic classifications across repeated runs, three playbook-trained tools that never went live because of misplaced/duplicate clauses and defined-term failures, an in-house FAQ mixing unrelated lease issues, hit-or-miss scoring, and failed legacy extraction. Positive episodes include repeatable time savings from guidelines/prompt chaining, first-pass complex redlines followed by human refinement, and useful NDA triage/basic extraction. [Generic GenAI discussion](https://www.reddit.com/r/legaltech/comments/1pnzkcd/why_generic_genai_failed_for_contract_review_in_a/), [AI evaluation thread](https://www.reddit.com/r/legaltech/comments/1qop0f3/getting_pitched_ai_for_contract_review_how_do_i/), [in-house AI uses](https://www.reddit.com/r/legaltech/comments/1ux5hsz/ai_use_cases_for_inhouse_legal_counsels/)

The common condition in positive accounts is a constrained task, explicit guidance and retained human judgment. None of the observations provides a reproducible benchmark, representative corpus, calibrated accuracy or blinded comparison. Community evidence therefore supports reviewability as a design requirement, not an accuracy percentage or general product ranking.

### 5.6 Integration and suite-native success — medium confidence

Twelve observations mention integrations. Some describe integration burden when business units refuse to change CRM, repository or e-sign systems; others describe value from Ironclad/Coupa, GEP's source-to-pay scope, and a Word/Teams-centered negotiation workflow. These cases disconfirm the idea that a standalone system is necessarily superior and also show why “has an integration” is weaker than adoption inside the user's existing motion. [Procurement systems thread](https://www.reddit.com/r/procurement/comments/1fo6cvc/contract_management_systems/), [multi-system buyer account](https://www.reddit.com/r/legaltech/comments/1ok5bin/ironclad_vs_evisort_looking_for_insight_or/)

### 5.7 Security, deployment and pricing — low confidence / unresolved

Security/deployment appeared in only two coded observations and neither establishes a ranked buyer objection, a deployment preference, or a security outcome. Pricing evidence consists of six anecdotes or opinions, including a roughly $10,000 API connection, unaffordable implementation/support in one evaluation, and a former consultant's account of more than $1 million over five years. These are negotiated, incomplete and non-comparable. They cannot establish market pricing, willingness to pay, ROI or the “number one” objection.

## 6. Who appears in the evidence, and who is missing

| Coverage dimension | What is actually present | What remains missing |
|---|---|---|
| Small | One explicitly six-person, 15-customer startup scenario; a small state agency; low-volume and renewal-only cases | More owner-verified US/UK cases with contract volume, consequences and budget authority |
| Mid-sized | One 600-person company is just outside the domain report's 51–500 band; several “growing,” multi-business-unit or complex-company clues lack headcount | Robust 51–200 and 201–500 cohorts; the evidence cannot validate a mid-market wedge |
| Enterprise | A very large media conglomerate, multiple subsidiaries, a multinational enterprise, 7,500 and 10,000-contract migrations | Named, independently auditable enterprise outcomes and neutral before/after measures |
| Roles | Procurement, in-house counsel, contracts manager, implementation participant/consultant, legal-tech buyer, public-tender operator and customer/vendor general counsel | Sales/RevOps, AP/AR, service delivery, security/privacy, HR and finance action owners are underrepresented |
| Geography | One observation explicitly concerns a US NDA template; one describes mostly Dutch-language documents without stating country | Geography is unknown for almost all Reddit observations; US/UK relevance cannot be inferred from subreddit, spelling or currency |
| Status quo | Excel, shared drives, SharePoint, Planner, Teams, Airtable, internal tools and monthly review | Objective failure rates and total operating cost |
| Vendor-specific | Negative, positive and mixed accounts for Icertis, Docusign CLM, Ironclad/Evisort, SpotDraft, Summize, Coupa, GEP, Per Angusta and ContractPodAI | Version/configuration controls, representative comparison and verified affiliation for most authors |

## 7. Vendor-specific and status-quo audit

| Option | Evidence in this sample | Safe interpretation |
|---|---|---|
| Excel/shared drive/SharePoint/task tools | Both working routines and late/missed renewal episodes; one six-person case says Drive is enough | Viable under some volumes and ownership models; not inherently sufficient or inherently broken |
| Icertis | Two severe implementation/support accounts and one migration adviser claim | Existence of negative episodes; no failure rate or vendor-wide conclusion |
| Docusign CLM | Repository retained some value, while legal-led negotiation tests were described as unusable after IT-led selection | User participation is material in this episode; not a product benchmark |
| Ironclad/Evisort/SpotDraft | Mixed: cost/integration/extraction concerns, one 7,500-agreement failure, one five-year/50-workflow positive account, one evaluator selection based partly on implementation/support | Configuration, migration and service model may dominate; cross-vendor ranking is unsupported |
| Summize | Positive 600-person cross-functional account, but near-identical crosspost and promotional style | Retained once at low confidence; affiliation remains unknown |
| Coupa/GEP and suite-native CLM | Positive integration/scope accounts alongside a secondhand adoption warning | Suite integration can be a real counterexample; outcome quality remains unmeasured |
| Per Angusta/ContractPodAI | One brief renewal success; one report of update/template disruption and hit-or-miss AI | Leads for validation, not generalizable product judgments |

## 8. Claim delta against the two current reports

### 8.1 `contracts-solutions-landscape-2026-08-19.md`

| Baseline claim | Community-evidence status | Audit judgment |
|---|---|---|
| Five competing object models | **Supported/complicated** | Observations distinguish file/folder, reminder row, negotiation surface, contract record and suite transaction. The social sample is not broad enough to prove the five-part taxonomy is exhaustive. |
| Small-team products expose prices; enterprise platforms expose architectures | **Still untested** | Community anecdotes do not validate current official prices or packaging. Keep the baseline's first-party pricing evidence authoritative. |
| Post-signature depth is the main fault line | **Supported but complicated** | Renewal, repository and handoff episodes exist, but negotiation failures are also material and broader obligation-performance evidence is sparse. “Main” remains an analytical inference. |
| AI availability is ahead of evidence disclosure | **Supported** | Mixed results, lack of benchmarks and recurrent human review needs align with this claim. The social evidence still cannot measure accuracy. |
| Implementation is process design plus migration, not software setup | **Strongly supported** | Both failed and successful episodes repeatedly connect outcome to process mapping, user involvement, migration, integration and configuration. Causality is not isolated. |
| Status quo remains a real competitor | **Strongly supported** | Direct reports describe working Drive, Excel, Planner, Teams and internally built routines, alongside their limits. |
| Official feature, security and vendor-positioning claims | **Still untested** | Anonymous community accounts do not override current first-party facts; they add self-selected risk and implementation context. |

### 8.2 `contracts-domain-research/researcher-memo.md`

| Baseline claim/hypothesis | Community-evidence status | Audit judgment |
|---|---|---|
| Agreement family is the operational object | **Supported, thinly** | Multi-file public tenders and amendment/internal-system accounts are consistent with the model; the detailed domain case remains stronger evidence. |
| Signing is midpoint, not endpoint | **Supported** | Renewal, storage, ownership and cross-system episodes show continuing work after execution. |
| Size changes ownership/control density | **Complicated / still untested by cohort** | Small and very large examples point in the expected direction, but explicit 51–500 coverage and geography are inadequate. Do not validate headcount bands from this sample. |
| Post-signature action failure is the most credible 50–500 pain | **Not validated** | The social evidence contains post-signature cases, but it does not meet the memo's own minimum of five independent 50–500 US/UK firms with dated consequences. Pre-signature negotiation also appears prominently. |
| Renewals need owner, context and proof—not only alerts | **Supported** | Direct cases mention varying lead times, escalations, outdated terms, alert fatigue and owner assignment. Financial impact remains unmeasured. |
| CLM can create burden through bad process, metadata, migration, access and adoption | **Supported** | Multiple implementation and multi-system accounts provide firsthand examples. Security/access burden itself remains weakly observed. |
| Named company examples and contract taxonomy/legal rules | **Still untested** | Social evidence neither validates nor contradicts official handbooks, executed contracts, statutes or vendor case studies. |
| Buyer, willingness to pay and consequence hypotheses | **Still untested** | Roles appear, but budget authority, paid consequence and repeat behavior are rarely stated. |

## 9. Legacy assertions that must not be carried forward

| Legacy assertion | Verdict | Reason |
|---|---|---|
| “metadata is 95%” | **REJECT as quantified claim** | Located only as an anonymous opinion without definition, denominator, measurement or outcome. Metadata quality matters, but “95%” has no auditable basis here. |
| “BYOK kills #1 objection” | **UNSUPPORTED** | Only two coded security/deployment observations exist; none ranks objections or shows bring-your-own-key resolving adoption. |
| “portfolio Q&A nobody has” | **CONTRADICTED as exclusivity claim** | Current official evidence documents portfolio Q&A/search across multiple products, while a firsthand suite user describes cross-contract questions and obligations. Community evidence does not test quality, but “nobody has” is false as positioning. |
| “warm network only GTM” | **UNSUPPORTED and outside this method** | Self-selected community posts cannot establish a uniquely viable acquisition channel. No channel-comparison evidence was located. |
| “MCP positioning” | **STILL UNTESTED** | No organic operator episode in the current community set requested this protocol or described it as a buying criterion. Absence in this sample is not proof of no demand. |

## 10. Contradictions and disconfirming evidence

1. **“Spreadsheets always fail” is contradicted.** Several operators or commenters describe Excel, Drive, Planner, SharePoint or a project board as sufficient under limited scope. The countercondition is disciplined ownership and manageable complexity.
2. **“Enterprise suites cannot work” is contradicted.** Suite-integrated and heavily configured deployments have positive reports, even though other accounts describe adoption silos and implementation failure.
3. **“AI contract review does not work” is contradicted.** Narrow, guided, human-reviewed use cases report value. Broad autonomy and advertised accuracy remain unsupported.
4. **“The pain is mainly post-signature” is not established.** Negotiation/Word compatibility and pre-signature user exclusion are material in the same sample.
5. **“A full CLM is needed once contracts become scattered” is contradicted for some small teams.** Central storage plus a light register/reminder layer can be a proportionate response.
6. **Positive evidence is not clean proof.** Several enthusiastic accounts are brief, crossposted, vendor-participating or affiliation-unknown. They are counterexamples, not performance benchmarks.

## 11. Limitations

- This is a purposive, self-selected sample, not random research. Counts describe the coded corpus only and must not be read as frequency, prevalence or market share.
- Reddit supplies 50 of 52 observations. HN, X, Bluesky, Lemmy, Mastodon and Product Hunt yielded no retained operator episode; YouTube discovery yielded no suitable direct transcript. Platform APIs, indexing, deleted content, rate limits and English-language queries shape the result.
- Most authors are pseudonymous and affiliation is unknown. Public handles were preserved only as source provenance; no profile enrichment, identity resolution or private/deleted-content recovery was attempted.
- Company size and geography are usually unknown. Brand recognition, subreddit, spelling, language and currency were not used as proxies.
- One comment can be sincere yet wrong, atypical, version-specific, badly configured or commercially motivated. Vendor names identify the episode; they do not support rankings.
- Long-form sources include one customer/vendor session. It is explicitly promotional and retained only as counterexample evidence.
- The legacy 1,200-row corpus is source-auditable but noisy and was not treated as 1,200 relevant observations. Its missing comment layer prevents reconstruction of several legacy narrative claims.
- Quotes were minimized in the ledger; summaries preserve meaning without bulk copying. No more than short fragments are quoted here.
- Social evidence cannot establish causality, product accuracy, implementation success rates, negotiated pricing, willingness to pay, legal correctness or security performance.

## 12. Rule-based acceptance audit

| Rule | PASS / FAIL | Evidence |
|---|---|---|
| Inventory current repo, Git history and `~/brain/`; retain weak/empty scrapes | **PASS** | Section 2 lists every relevant located corpus/artifact, including all 12 rate-limit-error JSONs and the three current logs. |
| Provenance and quality audit | **PASS** | Sections 2–3 separate raw, derived, historical and failed evidence and record preserved/lost fields. |
| Required evidence labels, themes and affiliation uncertainty | **PASS** | Section 1 defines the full codebook; every ledger row has label, affiliation, themes and limitation. |
| At least six platforms and 20 targeted queries | **PASS** | Forty attempts across eight platforms; exact query/method/date/result/failure in the search log. |
| At least 30 deduplicated usable observations if access permits | **PASS** | 52 episode-deduplicated usable observations from 17 stable parent URLs. |
| Stable source ledger and author/crosspost dedupe | **PASS** | 52 rows, 44 known public author strings; one exact/repeated crosspost and two unverifiable candidates excluded. |
| Small, mid-sized and enterprise coverage | **FAIL** | Small and enterprise clues exist, but explicit 51–500 and US/UK coverage is inadequate; a 600-person case does not fill the band. |
| Vendor-specific and status-quo feedback; positive counterexamples | **PASS** | Sections 5, 7 and 10 retain both favorable and unfavorable episodes and proportionate-tool counterexamples. |
| Compare both current reports | **PASS** | Section 8 marks claims supported, complicated, contradicted/not validated or still untested. |
| No unsupported prevalence, performance, price or causal claim | **PASS** | Counts are corpus-only; negotiated prices and outcome claims are explicitly limited. |
| Product-agnostic framing | **PASS** | The audit evaluates the domain and market evidence without recommending or positioning a repository product. |
| Privacy and copyright limits | **PASS** | Public sources only; no identity enrichment/deleted recovery/bulk thread copy; only minimal quoted fragments. |
| Prior X/Twitter evidence accounted for | **PASS** | Zero X URLs in the 55-URL legacy narrative set; no prior X scrape located; current low-yield attempt reported. |
| Legacy overclaims explicitly adjudicated | **PASS** | Section 9 rejects or qualifies all five specified assertions. |

The single coverage **FAIL** is substantive and must remain visible: this evidence set cannot validate a 51–500 employee US/UK segment. It does not invalidate the domain research; it keeps that segment as a hypothesis requiring interviews or another auditable source cohort.
