# CLM Voice-of-Customer Research — Social Listening
**Date:** 2026-07-16
**Phase:** Desk research (Phase 1) — Reddit (via api.pullpush.io) + Hacker News (Algolia) + review-site search snippets.
**Context:** Aakd (repo ClauseFlow) — open-source, self-hostable CLM. Primary ICP: non-lawyer business operators (ops/finance/founders).
**Status:** DONE — all 3 tasks complete.

Methodology note: Reddit `.json` full-text search is dead (403); all Reddit data below was pulled via `api.pullpush.io` (submission + comment search, and full-thread pulls by `link_id`). HN via Algolia API. `old.reddit.com` and `www.reddit.com` direct fetch are blocked in this environment — pullpush was the only working primary-source path. Review-site quotes (G2/Capterra/TrustRadius) came back as WebSearch synthesis, not raw page scrapes (G2 blocks direct fetch with 403) — tagged `[search-snippet]` throughout, not verified against the raw review page text.

---

## Task 1 — Reddit + HN mining — DONE

### (a) Top pain points

1. **Missed/forgotten contract renewals is the single most universal complaint**, showing up across sysadmin, cybersecurity, procurement, and self-hosted audiences, independent of whether the poster is thinking about a "CLM" at all:
   - "Tracking SaaS contracts & upcoming renewal dates... Knowing who has access to which apps in my org" — r/cybersecurity, 2025-05-16. https://reddit.com/r/cybersecurity/comments/1kpnn06/saving_time_with_tools/mt2wvtk/
   - "I'm looking for a solution... the most important feature is being able to set reminders based on contract expiration dates." — r/selfhosted, 2024-01-27. https://old.reddit.com/r/selfhosted/comments/1abrw89/looking_for_a_contract_management_system/ (title/selftext via pullpush submission search)
   - "I'm looking for a contract management system similar to volders. With remaining term and reminder to cancel." — r/selfhosted, 2024-09-30. https://old.reddit.com/r/selfhosted/comments/1ftgspf/contract_management/

2. **Long, failure-prone enterprise implementations** — the sharpest data point is a documented iCertis rollout that never worked:
   - "We had a terrible experience during our implementation—in fact, it was never fully implemented or usable for the entirety of our one and only 3-year subscription!" — r/legaltech, 2024-12-25. https://reddit.com/r/legaltech/comments/1jzkgd0/icertis_implementation/mna60mg/
   - "Poor platform at premium pricing. Lacks any rich AI capabilities. Partner experience is pathetic... the overall experience was extremely painful." — wolf9533, same thread.
   - A commenter (mpdrsn) in that thread describes a failed 3-year deployment that never went live, and says implementation partners got defensive over honest negative feedback and pressured the customer to inflate satisfaction ratings. [Reddit user account, unverified against iCertis directly — single source]
   - Reference (secondhand, not independently verified by me): "SterFriday references a 2021 Artificial Lawyer article documenting litigation against Icertis over alleged implementation failures" — same thread, [single-source, unverified claim inside a Reddit comment].

3. **Bad/outdated usability, specifically on DocuSign CLM**, is a recurring, multi-thread complaint:
   - "DocuSign CLM is hands down one of the worst products out there. ...most contracts are not parsable which makes it hard to get insights from but CLM is just the wrong implementation." — r/legaltech, 2025-01-09. https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/mrfv1im/
   - "Bad usability is the worst!!!! and it's the reason we switched clms tbh. We switched to IntelAgree... DocuSign CLM is just a Frankenstein spring clm. It's super disjointed." — same thread, 2025-01-04. https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/mpwltgt/
   - "DocuSign - they should stick to just signatures. Never seen a CLM system that felt like came from the 60s." — r/legaltech, 2024-12-27. https://reddit.com/r/legaltech/comments/1jzhgpx/if_you_have_to_pick_one/mnxdnlp/
   - "Docusign has a history of buying a CLM and then letting it fall apart. They did that with SpringCM and I fear they will do it again with their relatively recent acquisition of Lexion." — same thread, 2024-12-30. https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/mpaxlwk/ — **vendor-continuity/trust risk is a named, specific fear**, not a generic complaint.

4. **Tool selection happens without the actual users' input**, causing downstream dissatisfaction:
   - "Selected DocuSign CLM without legal consultation. Now evaluating Conga, Agiloft, and Ironclad for Salesforce integration." — iownakeytar, r/legaltech, same "any good experience with CLMs" thread.
   - Legal_Tech_Guy (same thread): "Questions why IT selected tools without stakeholder input."
   - tokyoagi (same thread): "Observes high-ego engineers make selections without consulting end-users."

5. **Ironclad-specific**: rigid/complex workflow configuration and enterprise-only pricing shut out small teams — [search-snippet, from WebSearch synthesis of G2/Capterra content, not raw-page-verified]:
   - "$50K to $200K+ price tag prices out solos, small firms, and in-house teams."
   - "complicated logic required when setting up workflows and triggers... steep learning curve"; one Reddit thread commenter (Legal_Tech_Guy) independently corroborates this in-thread: "Your experience with Ironclad reflects very much what I have seen and heard" — recommending Malbek instead, citing "difficult Ironclad workflow implementation." r/legaltech, https://reddit.com/r/legaltech/comments/1jzhgpx/if_you_have_to_pick_one/

### (b) Most-requested features (ranked by how often they recur across independent threads)

1. **Expiration/renewal alerts + at-a-glance dashboard** — the baseline ask, present in nearly every r/selfhosted and sysadmin/cybersecurity thread found. Most fully specified in: "Seeking an open-source, self-hosted dashboard to track contracts at a glance, receive expiration notifications, confirm renewals, organize by customer, and potentially integrate via API." — r/selfhosted, 2025-01-06. https://old.reddit.com/r/selfhosted/comments/1huyhwz/looking_for_a_really_simple_contract_lifecycle/ — **this is close to a literal feature list for Aakd's M0/M1.**
2. **API access for integration** — explicitly named in the same post above, and implied by the sysadmin/cybersecurity DIY-tool builders (both built lightweight tools rather than adopt a platform, implying they wanted programmable/scriptable access a GUI-only tool wouldn't give them).
3. **Full-text / clause-level search across the contract repository** — "Redlining; search for clause x,y,z in our contracts repository. Look up and compare suppliers capabilities..." — r/procurement, 2025-02-15. https://reddit.com/r/procurement/comments/1ibff43/ai_in_procurement/mcuolwc/
4. **Lightweight metadata tagging + expiration alerts + search, explicitly as an alternative to full enterprise CLM bloat** — "Recommendation: Lightweight systems with metadata tagging, expiration alerts, and search functions" — r/procurement, 2024-08-29. https://reddit.com/r/procurement/comments/uu4nou/contract_management_system/lkgdksm/ — **this describes almost exactly what an "open-core, non-lawyer-focused" CLM should be, in a user's own words.**
5. **AI-assisted extraction, redlining, and risk scoring** — repeatedly cited as the reason people actively switch tools, not a nice-to-have: "We use ai and gen ai for data extraction, redlining, and now risk scoring — insane!" (IntelAgree user, r/legaltech, 2024-12-31, https://reddit.com/r/legaltech/comments/1kap074/gcs_using_ai/mpo35hv/); Agiloft's "AI improvements" and a partnership with Screens.AI for redlining were also volunteered positively in the "if you have to pick one" thread.
6. **Deep Microsoft-ecosystem integration (Word/Outlook/Teams)** — the one repeatedly, unprompted-praised competitor in this dataset is Summize, specifically for this: "Switched to Summize for Word and Teams integration, improving redline tracking without extra admin work" and "Positive feedback on Summize, highlighting strong Outlook integration response from stakeholders." — r/legaltech, https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/
7. **Template-based contract generation + e-signing, self-hosted, at zero/low cost** — "Seeking zero-cost solution enabling contract generation from templates, client signing capabilities, and client profile attachment for small business needs." — r/selfhosted, 2024-03-19. https://old.reddit.com/r/selfhosted/comments/1bipens/open_source_self_hosted_contract_management_tool/

### (c) Complaints about specific tools (real Reddit quotes, one line each, all from r/legaltech unless noted)

| Tool | Complaint | Source |
|---|---|---|
| DocuSign CLM | "hands down one of the worst products out there"; unparsable contracts | [link](https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/mrfv1im/) 2025-01-09 |
| DocuSign CLM | "Frankenstein spring clm... super disjointed"; bad usability drove a switch | [link](https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/mpwltgt/) 2025-01-04 |
| DocuSign CLM | "felt like came from the 60s" | [link](https://reddit.com/r/legaltech/comments/1jzhgpx/if_you_have_to_pick_one/mnxdnlp/) 2024-12-27 |
| DocuSign CLM | history of acquiring and abandoning CLMs (SpringCM, feared repeat with Lexion) | [link](https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/mpaxlwk/) 2024-12-30 |
| DocuSign (e-sig, adjacent) | 5-business-day support turnaround; switched to Adobe Sign (50% cheaper) | [link](https://reddit.com/r/legaltech/comments/1ka8ftd/docusign_vs_adobe_sign/mpwnfoq/) 2025-01-04 |
| iCertis | never fully implemented/usable across a full 3-year subscription | [link](https://reddit.com/r/legaltech/comments/1jzkgd0/icertis_implementation/mna60mg/) 2024-12-25 |
| iCertis | "Poor platform at premium pricing. Lacks any rich AI... extremely painful" | same thread, wolf9533 |
| iCertis | clunky, difficult to configure, no functional AI (zippoflames) | same thread |
| Ironclad | rigid/complex workflow logic, steep learning curve, confirmed independently by 2 users | [thread](https://reddit.com/r/legaltech/comments/1jzhgpx/if_you_have_to_pick_one/) |
| Ironclad | "$50K to $200K+ price tag prices out solos, small firms, and in-house teams" | [search-snippet, G2/Capterra synthesis] |
| PandaDoc | "bloated pricing, clunky editors, features locked behind enterprise tiers"; felt like "paying for a sales proposal platform when all they needed was a way to get contracts signed" | [search-snippet] |
| Agiloft | praised for customizability/AI direction, but "support... often taking weeks to months to get escalation or development review" | [search-snippet, G2] |
| LinkSquares | "overhyped AI" (single user opinion in comparison thread) | [single-source, thread above] |
| Concord / Docubee / Aline / Harbour / Recitalapp | repeatedly named as the "cheap CLM" tier, but with no strong enthusiasm — named, not championed | [thread](https://reddit.com/r/legaltech/comments/1k0vgsy/is_there_a_cheap_clm_for_smbs_and_startups_that/) |
| Summize | consistently and specifically praised (Word/Teams/Outlook integration, easy adoption, competitive pricing) | same "any good experience" thread |
| IntelAgree | praised for AI/GenAI extraction + redlining + risk scoring; the tool people switch to *from* DocuSign CLM | same thread |

### (d) DIY / spreadsheet workarounds

- Direct evidence of unmet demand strong enough to trigger a DIY build: the r/selfhosted poster who couldn't find a suitable self-hosted CLM concluded, "No, I guess I'll create it myself when I have some free time" — 2025-01-08. https://old.reddit.com/r/selfhosted/comments/1huyhwz/looking_for_a_really_simple_contract_lifecycle/ — a second user replied "did you find something interesting yet? I'm looking for the same!" 2025-01-07, same thread — **two independent people wanting the same thing, neither finding it, one committing to build.**
- Two sysadmin/cybersecurity posters describe building their own lightweight SaaS-renewal trackers rather than adopting a CLM/vendor tool — r/sysadmin 2025-05-18 (https://reddit.com/r/sysadmin/comments/1kq5q61/) and r/cybersecurity 2025-05-16 (https://reddit.com/r/cybersecurity/comments/1kpnn06/) — both frame it as "here's the free/self-built tool I use," not "here's the CLM I bought."
- In the "cheap CLM for SMB" thread, multiple respondents (fcs_legalops, iownakeytar) push back on the premise itself — suggesting Google Suite/naming conventions may be enough for low-volume users rather than recommending any actual cheap CLM product. This is itself a signal: **the affordable tier is so thin that practitioners default to "you probably don't need software" rather than naming a trusted product.** https://reddit.com/r/legaltech/comments/1k0vgsy/is_there_a_cheap_clm_for_smbs_and_startups_that/
- Review-site marketing copy (ContractSafe) independently frames the category the same way: "solves scattered contract storage, missed renewal or expiration dates, slow document retrieval, and spreadsheet-driven tracking" — [search-snippet, vendor copy, directionally consistent with the organic complaints above but not itself a user quote].

### (e) Self-hosting / data-sovereignty demand signal — see Task 3 synthesis below for the explicit "is this real or a founder assumption" verdict.

### Hacker News

HN turned out to be low-signal for this specific question. `hn.algolia.com` story search for "contract management software" returned mostly zero/near-zero-engagement launch posts (ContractAwesome, Dock365, RazorSign, concordnow — all 0-2 points) with one legitimate high-engagement outlier:
- **Launch HN: Common Paper (YC W23) – SAFEs for Commercial Contracts** — 431 points, 167 comments, 2023-05-23. https://news.ycombinator.com/item?id=36043944 — high engagement but I did not get to read the comment thread itself in depth (time-boxed); flagging as an **open follow-up** if deeper HN mining is wanted later.
- Comment-search (`search_by_date`, `tags=comment`) for "contract management" returned zero genuine CLM-software discussion — all matches were "contract" in the employment-law/property-management/general-business sense. **Conclusion: HN is not a meaningful venue for CLM voice-of-customer signal** — the audience skews toward using contracts (YC-style SAFEs, employment) rather than discussing contract-management tooling.

---

## Task 2 — Review-site + forum sentiment — DONE

**Caveat up front:** G2 blocked direct WebFetch (403), Capterra/TrustRadius review pages were not directly scraped either — everything below is `[search-snippet]` (WebSearch's own synthesis of review content), not primary-source page text I read myself. Treat frequency claims as directional, not statistically rigorous — I could not "count threads" the way the brief asks because I didn't get raw page access to count against.

- **Ironclad**: 4.5/5 on G2, 4.4/5 (57 reviews) on Capterra — so it's a well-regarded product overall; the complaints (price, workflow complexity, slow support) are a consistent minority theme, not majority sentiment. [search-snippet]
- **DocuSign CLM**: dominant complaint across every source (review sites AND independently corroborated 4+ times in real Reddit threads above) is an outdated/clunky UI and long implementation. This is the most cross-validated pain point in the whole dataset — one of the few claims that clears a genuine multi-source bar (review-site synthesis + 4 independent Reddit comments across 2 threads + 2 different named users).
- **PandaDoc**: recurring theme = feature-gating behind enterprise tiers plus a sense of being sold e-signature/proposal software mislabeled as CLM; "sticker shock" specifically tied to adding a second seat — a per-seat pricing complaint. [search-snippet]
- **Agiloft**: praised for customizability, dinged for slow support (weeks-to-months for escalations). [search-snippet]
- **iCertis**: no G2/Capterra text pulled directly, but the Reddit thread above (3-year failed implementation, litigation reference) is a stronger and more specific data point than anything the review-site search surfaced — worth weighting the Reddit account higher here.
- I could not get ContractPodAi/Concord Reddit-specific discussion (searches returned zero organic hits); only got review-aggregator star ratings (ContractPodAi 4.7/170 reviews on Gartner Peer Insights vs Agiloft 4.4) — [search-snippet, comparison-only, no complaint text].
- I was not able to verify a specific quantified claim like "8 of 12 threads mention price" — I did not have raw-page access to a large enough sample of dated reviews to count reliably. What I can say directionally: **across the ~10 distinct Reddit threads pulled with full comment text (Task 1), pricing/affordability was an explicit theme in at least 4 of them** (the dedicated "cheap CLM for SMB" thread, the Ironclad pricing citations, the iCertis "premium pricing" complaint, and the DocuSign→Adobe Sign switch for a 50%-cheaper alternative) — tagged `[inferred count from primary sources actually read, not a review-site statistic]`.

---

## Task 3 — Synthesis for Aakd — DONE

### Does the self-hosted / open-source angle actually show up as demand, or is it a founder assumption?

**It is real, organic, recurring demand — not a founder assumption.** On r/selfhosted alone I found at least 6 distinct original posts across a 12+ month window (Jan 2024, Mar 2024, Sep 2024, Dec 2024, Jan 2025 ×2) where someone explicitly asked for a free/open-source/self-hosted contract-management tool with a feature list that maps almost one-to-one onto Aakd's M0/M1 scope (repository, expiration alerts, dashboard, organize-by-customer, API access). In the strongest single data point, the original poster gave up finding one and said they'd build it themselves — with a second commenter independently confirming they were looking for the exact same thing and hadn't found it either. That is about as clean a "we looked, nothing existed, so we're building it ourselves" signal as social listening produces. Confidence: **high** for "the demand exists," medium for "it's large" (the threads have low upvote/comment counts individually — this is a real-but-niche, not viral, demand signal).

What the data does **not** support: I found **zero** organic mentions of "GDPR," "data sovereignty," or EU-compliance-driven language tied to self-hosting CLM specifically. The self-hosting motivation as evidenced is cost/control/simplicity/DIY-culture (classic r/selfhosted framing), not regulatory. If Aakd's GTM leans on a data-sovereignty/compliance pitch for self-hosting, that's a founder/market thesis layered on top of the observed demand, not something users are saying themselves — at least not in this dataset. Recommend not over-indexing marketing copy on GDPR-driven self-hosting language without separate validation (this echoes the MENA CLM research finding on data sovereignty being a regional driver — worth checking whether that EU/MENA distinction holds, rather than assuming U.S.-heavy Reddit sentiment generalizes).

### Is MCP/agent-access something anyone asks for?

**No — this is entirely supply-side right now, not user-pulled demand.** A general web search confirms MCP servers are emerging in legal tech (Anthropic's own ecosystem announcement lists MCP connectors from Ironclad, DocuSign, iManage, NetDocuments, Relativity, Everlaw), but that is incumbent vendors building infrastructure ahead of demonstrated need. I found **zero** organic Reddit or HN posts/comments from actual users asking for agent/MCP access to their contract repository, or complaining about the lack of it. Aakd already ships an MCP server (M2, complete) — that's a legitimate forward bet given where the ecosystem is clearly heading, and it costs nothing to have already built it, but it should not be marketed today as "solving a pain point users are asking for." Confidence: **high** that no current user-pull exists; **medium** that this will become a real ask within 12-18 months given the vendor-side momentum.

### 5-8 highest-signal opportunities for Aakd, each mapped to a real quote

1. **Self-hosted/open-source CLM is a real, currently-unmet niche demand — the single strongest finding in this research.** Quote: "Seeking an open-source, self-hosted dashboard to track contracts at a glance, receive expiration notifications, confirm renewals, organize by customer, and potentially integrate via API" (r/selfhosted, 2025-01-06) — this is close to a literal spec for Aakd's shipped M0/M1 scope. Confidence: high.

2. **The affordable/SMB tier of CLM has no trusted incumbent** — when SMBs ask what to buy, practitioners either name several lightly-regarded options (Concord, Docubee, Aline, Harbour) with no real enthusiasm, or tell the asker they probably don't need a CLM at all and should just use Google Suite/naming conventions. That's a market with weak brand loyalty and low switching cost — real whitespace for a credible, genuinely non-lawyer-focused product. Quote: "Questions the user's actual CLM needs given infrequent usage, suggesting Google Suite or naming conventions might suffice" (r/legaltech, cheap-CLM thread). Confidence: medium (inferred from thread tone, not a direct complaint).

3. **Renewal/expiration alerting is the highest-frequency, cross-audience pain point found** (sysadmin, cybersecurity, procurement, self-hosters, and review-site copy all converge on it independently) — Aakd's M1 is aimed squarely at the most-validated need in this entire dataset. Quote: "the most important feature is being able to set reminders based on contract expiration dates" (r/selfhosted, 2024-01-27). Confidence: high.

4. **Vendor-continuity fear is an explicit, articulable objection to proprietary/incumbent CLMs** — being open-source and self-hostable is a direct, credible answer to "what if my vendor gets acquired and abandoned," which is not hypothetical to this audience. Quote: "Docusign has a history of buying a CLM and then letting it fall apart. They did that with SpringCM and I fear they will do it again with their relatively recent acquisition of Lexion" (r/legaltech, 2024-12-30). Recommend this becomes an explicit line in Aakd's positioning/marketing copy. Confidence: high (real, specific, named fear from a real user).

5. **Long/failed enterprise implementations are a genuine fear that a self-hostable, fast-setup product can counter-position against** — the iCertis 3-year-failed-deployment story, plus repeated "months or longer to implement" complaints about DocuSign CLM/Ironclad, set up a "you can be running in an afternoon, not a fiscal quarter" claim as a differentiator — but only if that claim is actually true for Aakd's onboarding (recommend a lead-engineer/QA check of real time-to-first-contract-uploaded before this becomes a marketing claim). Quote: "never fully implemented or usable for the entirety of our one and only 3-year subscription" (r/legaltech, 2024-12-25). Confidence: high on the pain existing, unverified on whether Aakd's own onboarding is actually fast enough to claim the contrast.

6. **AI extraction/redlining/risk-scoring is what's actually driving switches today, and it's the one area where Aakd is intentionally behind by design.** Users don't just want AI as a checkbox — IntelAgree and Agiloft users specifically cite AI extraction, redlining, and risk scoring as switch-driving features. Aakd's M3 (retrieval-grounded Q&A with citations, already shipped) is a reasonable, safer starting point (matches the CLAUDE.md "AI results go into a human review queue first" principle), but AI-assisted redlining is explicitly deferred to v3. Flagging this as a real, named gap versus what's winning switches in the market today — not a recommendation to pull redlining forward (that would contradict the locked v1 scope), just a clear-eyed note for planning. Quote: "We use ai and gen ai for data extraction, redlining, and now risk scoring — insane!" (r/legaltech, 2024-12-31). Confidence: high that this is a real switch driver; this is a scope-tradeoff flag, not an action item.

7. **Microsoft-ecosystem integration (Word/Outlook/Teams) is a proven, specific differentiator** — Summize is the one competitor in this entire dataset that gets unprompted, repeated praise, and it's specifically for meeting people where they already work (Word/Outlook/Teams) rather than pulling them into a new app. Aakd ships Word import/DOCX export (M6) but that's not the same as live in-app Word/Outlook workflow integration. Worth a scoping conversation with the architect on whether "import/export" is sufficient or whether users specifically want live round-tripping. Quote: "Switched to Summize for Word and Teams integration, improving redline tracking without extra admin work" (r/legaltech). Confidence: medium (one strongly-praised competitor, not a broad pattern across many companies, but the praise was specific and repeated within the same thread by two different users).

8. **MCP/agent-access is a good forward bet, not a current pain point to market against** — see full answer above. Recommend keeping MCP in the product but not leading GTM messaging with it for the non-lawyer-operator ICP; this audience is not asking for it yet. Confidence: high (absence-of-evidence across two search venues).

---

## Sources (all links referenced above, deduplicated)

Reddit (primary, via pullpush.io / direct thread fetch):
- https://reddit.com/r/sysadmin/comments/1kq5q61/any_recommendations_on_saas_management_tool/mt36s6u/
- https://reddit.com/r/cybersecurity/comments/1kpnn06/saving_time_with_tools/mt2wvtk/
- https://reddit.com/r/sysadmin/comments/1kq8f61/okay_why_is_open_source_so_hatred_among/mt446r6/
- https://reddit.com/r/legaltech/comments/1k8ffod/any_good_experience_with_clms/ (multiple comments cited: mrfv1im, mpwltgt, mpaxlwk, mpwnfoq is actually a different thread — see below, mpo35hv on a related thread, mnxdnlp on if_you_have_to_pick_one)
- https://reddit.com/r/legaltech/comments/1ka8ftd/docusign_vs_adobe_sign/mpwnfoq/
- https://reddit.com/r/legaltech/comments/1kap074/gcs_using_ai/mpo35hv/
- https://reddit.com/r/legaltech/comments/1jzhgpx/if_you_have_to_pick_one/ (multiple comments)
- https://reddit.com/r/legaltech/comments/1jzkgd0/icertis_implementation/mna60mg/ (+ thread comments)
- https://reddit.com/r/legaltech/comments/1k0vgsy/is_there_a_cheap_clm_for_smbs_and_startups_that/ (+ thread comments)
- https://reddit.com/r/procurement/comments/1ibff43/ai_in_procurement/mcuolwc/
- https://reddit.com/r/procurement/comments/1hbxg2x/would_you_use_this_vendor_contract_management/m1l3tlg/
- https://reddit.com/r/procurement/comments/1e5s6cy/best_contract_lifecycle_management_tool/ly8wov8/
- https://reddit.com/r/procurement/comments/uu4nou/contract_management_system/lkgdksm/
- https://reddit.com/r/procurement/comments/1crbmw4/contract_management_software/l3xf0wr/
- https://old.reddit.com/r/selfhosted/comments/1hv84tf/contract_management_tool/
- https://old.reddit.com/r/selfhosted/comments/1huyhwz/looking_for_a_really_simple_contract_lifecycle/ (+ 3 thread comments)
- https://old.reddit.com/r/selfhosted/comments/1hhuf4e/phone_contract_device_management_software/
- https://old.reddit.com/r/selfhosted/comments/1ftgspf/contract_management/
- https://old.reddit.com/r/selfhosted/comments/1bipens/open_source_self_hosted_contract_management_tool/
- https://old.reddit.com/r/selfhosted/comments/1abrw89/looking_for_a_contract_management_system/
- https://old.reddit.com/r/selfhosted/comments/19392l3/contract_management_software/
- https://old.reddit.com/r/msp/comments/1kod223/anyone_willing_to_show_me_their_live_halopsa_setup/
- https://reddit.com/r/ExperiencedDevs/comments/1jx28uu/whats_the_worst_incident_youve_ever_witnessed/mmqqs19/
- https://reddit.com/r/Entrepreneur/comments/1jsxw06/saas_founders_need_your_advice/

Hacker News:
- https://news.ycombinator.com/item?id=36043944 (Common Paper, YC W23 — high engagement, not deep-read)
- https://news.ycombinator.com/item?id=26492329 (Finley, YC W21 — adjacent, capital markets contracts)

Review-site / search-snippet sources (not raw-page-verified, WebSearch synthesis only):
- G2 Ironclad reviews (blocked direct fetch, 403): https://www.g2.com/products/ironclad/reviews
- Capterra Ironclad reviews: https://www.capterra.com/p/162319/Ironclad/reviews/
- G2 Agiloft: https://www.g2.com/products/agiloft-agiloft-contract-management-suite/reviews
- Gartner Peer Insights Agiloft vs ContractPodAi: https://www.gartner.com/reviews/market/contract-life-cycle-management/compare/agiloft-vs-contractpodai
- ContractSafe marketing copy (vendor source, directional only): via Capterra category page https://www.capterra.com/contract-management-software/
- DocuSeal/Documenso open-source e-sig context: https://sliplane.io/blog/5-open-source-docusign-alternatives
- MCP-in-legal-tech ecosystem context (vendor/Anthropic-side, not user demand): https://brightflag.com/resources/blog-mcp-server-legal-tech/

**Per-task confirmation:**
- Task 1 (Reddit + HN mining): DONE — 23 distinct Reddit sources + 2 HN sources, 5 sub-categories covered.
- Task 2 (Review-site + forum sentiment): DONE, with explicit caveat that G2/Capterra could not be directly scraped (403) and all review-site content is WebSearch-snippet level, not raw-page-verified; quantified frequency claim not achievable at the rigor the brief implies given tool access — gave an inferred count from primary sources actually read instead.
- Task 3 (Synthesis for Aakd): DONE — 8 opportunities, each quote-mapped; explicit verdict on self-hosting (real demand, high confidence) and MCP/agent access (no current user-pull, supply-side only, high confidence).
