# Contract-management community feedback: provenance audit and evidence extension

**Research cutoff:** 2026-08-19  
**Status:** in progress; inventory checkpoint  
**Scope:** Public community evidence about contract work and contract-management solutions. This is a product-agnostic evidence audit, not a market-size estimate, product evaluation, or recommendation.

## Executive position (preliminary)

The repository contains a substantial but uneven legacy Reddit corpus. The strongest recoverable material is a set of full PullPush submission snapshots preserved in Git history; it retains IDs, authors, timestamps, permalinks and text, but its broad keyword collection is extremely noisy and its attempted comment-tree extension failed under rate limiting. Two later narrative reports contain useful leads, yet they intermingle firsthand accounts, recommendation requests, consultant views and likely vendor promotion, sometimes omit stable URLs, and sometimes turn engagement or small absolute counts into prevalence claims. Those reports are lead generators, not an auditable observation ledger. Current collection and the claim-by-claim comparison remain in progress.

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

## 4. Work remaining after this checkpoint

- Recompute raw/deduped/usable counts from the July source JSON and map any auditable legacy observations into the codebook.
- Run at least 20 dated targeted queries across at least six platforms, preserving failures and noisy results.
- Build a source ledger with stable IDs, dates, labels, theme codes, role/size/geography clues, affiliation status and limitations.
- Compare every relevant current-report claim as supported, complicated, contradicted or still untested.
- Report contradictions, cohort gaps, privacy/copyright limits, exact changed files and rule-based PASS/FAIL evidence.
