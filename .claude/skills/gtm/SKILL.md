---
name: gtm
description: Go-to-market strategy and execution planning for ClauseFlow — an open-source,
  self-hostable, AI-native CLM platform. Use this skill whenever the user wants to plan
  a launch, define ICP, write positioning, build a community strategy, plan outbound
  sequences, structure a pricing page, design the OSS funnel, identify partnership
  opportunities, or track GTM metrics. Also invoke when the user asks "how do we get users",
  "how do we launch", "who should we target", "what should our pricing be", "how do we
  convert GitHub stars to paying customers", "when should we go public with the repo",
  or any question about growth, awareness, channels, or revenue for ClauseFlow.
---

# ClauseFlow GTM Skill

## Context (always active)

ClauseFlow is an open-source, AGPL-3.0 Contract Lifecycle Management platform.
Stack: Next.js 14, Prisma, PostgreSQL + pgvector, BullMQ, Redis, S3, Better Auth. Fully self-hostable via Docker Compose in under 10 minutes.

**Business model:** Open Core
- Community Edition — free forever, fully open source (AGPL), core CLM
- Teams Edition — license key, self-hosted, paid (~$199-299/month flat ≤10 users) — gates: AI Agents, SSO/SAML, advanced analytics, audit logs, priority support
- Cloud — hosted SaaS (future, post-launch)

**ICP:** Developer-forward SMB/mid-market legal+ops teams, 10-500 employees, Series A-C, 1-3 person legal team managing 50+ contracts/year, currently on DocuSign + spreadsheets, tired of $480+/user/year pricing.

**Unique angle:** Only self-hostable, AI-native CLM in the market. Zero serious OSS competition (OpenCLM has no active community).

**Current milestone:** M5 complete (Notifications ecosystem). M6 (Authoring) is next.

---

## How to Use This Skill

When invoked with no arguments, ask: *"Which module? (1-ICP, 2-Positioning, 3-Launch Sequence, 4-Community, 5-OSS Funnel, 6-Outbound, 7-Pricing, 8-Partnerships, 9-Metrics — or 'all')"*

When invoked with a keyword (e.g., `/gtm launch`, `/gtm pricing`, `/gtm outbound`), infer the module and run it directly.

When invoked with `all`, run all 9 modules in order and produce a complete GTM document.

Each module produces a filled-in deliverable using the template below — not a list of generic advice.

---

## Module 1 — ICP Definition

**Purpose:** Produce a 3-tier ICP document that drives all targeting decisions: outbound sequences, content topics, partnership picks, pricing anchors.

**Rules:**
- Tier 1 is the only ICP worth spending time and money on at launch
- Include technographic signals (GitHub org exists, uses Linear/Notion) — these are the highest-intent proxies
- Include behavioral signals that can be detected without talking to the prospect

**Output template:**

```
## ICP Tier 1 — Primary
- Company size:
- Industry vertical:
- Funding stage:
- Tech stack signals (what you can detect without a call):
- Team structure (who owns contracts at this company):
- Pain (what life looks like before ClauseFlow):
- Top 3 trigger signals to watch for:
- Where they hang out (channels to reach them):
- Disqualifiers (who looks like Tier 1 but isn't):

## ICP Tier 2 — Secondary (worth pursuing at lower cost)
[same structure]

## Do Not Target Now
[list with one-line rationale for each entry]
```

**Pre-loaded hypothesis to refine:**
- Tier 1: Legal ops lead or COO at 50-300 person SaaS/tech company, Series B, currently DocuSign standard + spreadsheets, 50+ contracts/year, public GitHub org, has liked or posted a "DocuSign is too expensive" complaint
- Tier 2: Head of Legal at a professional services firm (law firm, consulting), 10-100 employees, currently on Notion/Google Docs for contracts, no existing CLM
- Do Not Target: Enterprise 500+ needing on-prem compliance reviews, companies that want zero dev involvement in their tooling

---

## Module 2 — Positioning & Differentiation

**Purpose:** Produce a positioning canvas that drives the website hero, sales one-liner, and competitive comparisons. One positioning statement, a competitive matrix, and website copy blocks.

**Rules:**
- The "open-source alternative to X" framing outperforms category-creation framing for developer tools at launch — lean into it
- Lead with self-hostability + data control first, AI second (data control is the emotional trigger for legal teams)
- Never position on price alone — position on control + transparency + AI-native stack

**Output template:**

```
## Positioning Statement
For [ICP], who [pain/current state], ClauseFlow is the [category] that [unique value],
unlike [alternatives] which [key weakness].

## Competitive Matrix
| Dimension          | DocuSign CLM | Ironclad | Juro | ClauseFlow |
|--------------------|-------------|----------|------|------------|
| Self-hostable      |             |          |      |            |
| Open source        |             |          |      |            |
| AI-native (Q&A)    |             |          |      |            |
| Time to deploy     |             |          |      |            |
| Transparent pricing|             |          |      |            |
| API-first          |             |          |      |            |
| eSign built-in     |             |          |      |            |

## Hero Copy
Headline (≤8 words):
Sub-headline (≤20 words):

## Three Value Pillars
1. [Pillar name]: [one compelling sentence]
2. [Pillar name]: [one compelling sentence]
3. [Pillar name]: [one compelling sentence]

## Tagline options (3 variants)
-
-
-
```

**Competitor intel (pre-loaded):**
- DocuSign CLM: Word-dependent workflow, 3-12 month implementation, $480+/user/year Business Pro. Strength: brand recognition. Weakness: implementation cost and complexity.
- Ironclad: No native eSign (requires DocuSign addon), complex rule logic, enterprise-only ($50k+/year floor), no self-host. Strength: workflow flexibility for complex orgs. Weakness: completely out of reach for SMB.
- Juro: SMB-targeted but opaque pricing (~$400/user/year), no self-host, no AI Q&A. Strength: clean UX. Weakness: data still in their cloud.
- Evisort: Now owned by Workday — vendor lock-in risk just increased. Enterprise only.
- OpenCLM: No active GitHub community, unclear maintenance, no AI features.

---

## Module 3 — Launch Sequence

**Purpose:** A day-by-day 3-week plan for the open-source announcement. Based on what actually worked for Plane (20k stars), Onlook (3 launches in 5 months), and the definitive HN vs Product Hunt yield analysis.

**Key research findings baked in:**
- HN Show HN yields 1,000-7,000 stars from a strong post; PH yields 500-1,500 for dev tools. Do HN first, PH a week later riding momentum.
- The GitHub Trending algorithm triggers when HN + Reddit concentration happens in the same 48-hour window. This is the flywheel moment — plan for it.
- Founder presence in HN comments all launch day is the single highest-leverage action. Answer technical questions only; never pitch.
- HN title formula: *"Show HN: ClauseFlow – open-source, self-hostable alternative to DocuSign CLM (AI Q&A, pgvector, Docker Compose)"* — "open-source alternative to [known product]" framing consistently outperforms generic titles.
- Post HN on Tuesday or Wednesday, 8am PT (highest HN engagement window).

**Output template:**

```
## Pre-Launch Week -2
- [ ] Day -14: [action]
- [ ] Day -12: [action]
- [ ] Day -10: [action]

## Pre-Launch Week -1
- [ ] Day -7: [action]
- [ ] Day -5: [action]
- [ ] Day -3: [action — draft HN post, prepare Discord, prep Reddit posts]
- [ ] Day -1: [action — final checks, assets ready, team briefed]

## Launch Day (Tuesday/Wednesday, post at 8am PT)
- [ ] 8:00am: Show HN post live — exact title: [fill]
- [ ] 8:00am: Simultaneous Reddit posts: r/selfhosted, r/legaltech, r/devops, r/projectmanagement
- [ ] All day: Founder in HN comments — technical questions only
- [ ] 12:00pm: LinkedIn founder story post (personal angle, not marketing copy)
- [ ] 6:00pm: X/Twitter thread — build-in-public angle

## Week 1 Post-Launch
- [ ] Day 1-3: GitHub Issues triage — respond to every issue visibly within 3h
- [ ] Day 2: Discord welcome message, start #feedback channel
- [ ] Day 5: Momentum recap post on LinkedIn/X
- [ ] Day 7: Product Hunt launch (ride HN momentum)

## Week 2-3
- [ ] Blog post: "Why we built ClauseFlow" (founder story)
- [ ] Blog post: "ClauseFlow vs Ironclad — an honest comparison"
- [ ] Reddit follow-up posts in different subreddits (different angle, not cross-post)
- [ ] First public changelog
- [ ] Outreach to Awesome Self-Hosted list maintainer for inclusion
```

---

## Module 4 — Community-Led Growth

**Purpose:** The ongoing playbook for building the community that does the marketing. Discord structure, GitHub engagement loop, content calendar, docs-as-marketing.

**Rules:**
- Start with only 2 Discord channels. Add channels only when one is getting noisy enough that a split makes sense.
- Respond to every Discord message within 3 hours for the first 6 months. This is cited as the #1 community momentum driver across n8n, Plane, and Metabase.
- GitHub Issues are the public roadmap. Upvotes surface what to ship next and prove community voice matters.
- Docs-as-marketing means writing docs that rank for search queries like "how to manage vendor contracts open source" — not just reference docs.

**Output template:**

```
## Discord Structure (launch config)
Launch channels: #general, #feedback
Add only when noisy: [channel name — trigger condition]
Response SLA: < 3h for first 6 months
Weekly ritual: [what to post, when]

## GitHub Stars Flywheel
Star → [next step in funnel]
Issue triage ritual: [how to handle new issues publicly and visibly]
Contribution ladder: [how to convert star-ers to contributors over 90 days]
Monthly changelog format:
  - Section 1 (excitement): [new features with GIFs]
  - Section 2 (education): [how to use new features]
  - Section 3 (information): [bug fixes, deps, what's next]

## Docs-as-Marketing Priority Pages
1. Page: [topic] — target query: [search intent]
2. Page: [topic] — target query: [search intent]
3. Page: [topic] — target query: [search intent]
Comparison pages to write: ClauseFlow vs Ironclad, ClauseFlow vs DocuSign CLM, ClauseFlow vs Juro

## Content Calendar (first 90 days)
Week 1: [topic + channel]
Week 2: [topic + channel]
Week 3: [topic + channel]
Week 4: [topic + channel]
Month 2 themes: [list]
Month 3 themes: [list]
```

---

## Module 5 — OSS Funnel Design

**Purpose:** Map the complete funnel from GitHub star to paid Teams seat. Define gates, conversion levers, and in-product upgrade triggers. This is the most important module for revenue — get the gate design wrong and you kill both community and conversion.

**Rules:**
- The gate must create real pain at scale — not artificial feature removal. Gate features that hurt when you hit them, not features that make the product better to use day-to-day.
- Never gate collaboration/notification features (Slack, webhooks, API) — these drive word-of-mouth and stickiness.
- Define PQL (Product Qualified Lead) with specific measurable behavior, not vague activity.
- 67% of organizations that pay for commercial OSS cite enhanced support as #1 driver. Build the paid tier around support + compliance, not feature removal.

**Output template:**

```
## Funnel Stages

### Stage 1: Awareness → GitHub Star
Primary channels: [list ordered by yield]
Star target (90 days post-launch): [number]
What drives star conversion: [content, angle, platform]

### Stage 2: Star → Self-Hosted Deployment
Friction to eliminate: [list]
Docker Compose time-to-deploy target: < 10 minutes
First 24h experience (what they must see to activate): [list]
Activation metric: [specific event that proves deployment succeeded]

### Stage 3: Deployed → Active User (PQL)
PQL definition: instance with [X contracts] + [Y users] + [Z feature uses] in [N days]
PQL identification method: [opt-in telemetry ping / GitHub issue pattern / outbound research — pick one and justify]
In-product Teams feature education: [where and how to surface Teams gates without annoying]

### Stage 4: PQL → Teams License Request
How they request a license: [process]
Trial structure: [length, what's unlocked, what happens at end]
Sales-assist trigger: [specific signal that triggers a human reaching out]

### Stage 5: Teams License → Paid
Success criteria for retention: [what makes them renew]
Expansion path: [what drives seat/usage growth]

## What to Gate in Teams (and why each gate creates real pain)
- [Feature]: [why this hurts at scale]
- [Feature]: [why this hurts at scale]

## What NOT to Gate (keep in Community forever)
- [Feature]: [why keeping this free drives expansion]
- [Feature]: [why keeping this free drives expansion]
```

**Pre-loaded gate candidates:** AI Agents (Renewal Agent, Review Agent, Intake Agent), SSO/SAML, advanced analytics dashboard, audit logs export, priority support SLA, custom retention policies.

**Pre-loaded "never gate" items:** Slack/Teams notifications, webhook fan-out, basic API access, DocuSeal signing, contract Q&A (basic), approval workflows, search.

---

## Module 6 — Outbound Playbook

**Purpose:** Signal-based outbound sequences for the top 3 ICP trigger signals. Uses the ColdIQ framework: signal → detection → trigger condition → timing → channel → message sequence → expected outcome.

**Rules (from ColdIQ research):**
- "Diagnose before prescribing" — first message never pitches. It asks a diagnostic question.
- "Why Are You Paying" framework — surfaces the cost pain directly, most effective opening for a free alternative.
- "Ask Before Pitch" — no CTA in first message. Just a question that creates a mental foothold.
- Act on signals within 24h of detection for time-sensitive triggers (job posts go stale in 1-2 weeks).

**Output template per signal:**

```
## Signal: [name]

Detection method: [where/how to find this — LinkedIn boolean search, job board scrape, G2 review monitor]
Trigger condition: [exact criteria that qualifies an instance of this signal]
Timing: act within [N hours/days] of detection

Channel: [LinkedIn DM / cold email / both — sequence]

Day 1 — [channel]:
Subject: [if email]
{{First name}}, [opening hook based on signal — mention the signal explicitly]
[body — 2-3 sentences max, diagnostic question or observation]
[CTA — soft, no pitch]

Day 3 — [channel]:
[follow-up — add one piece of value, re-ask]

Day 7 — [channel]:
[final — acknowledge they may not be the right timing, leave a door open]

Expected reply rate: [benchmark]
```

**Three signals to build first:**

1. **Job Posting Signal** — company posts "Legal Operations Manager" or "Contract Manager" or "Head of Legal" role on LinkedIn/Indeed/Greenhouse. Detection: use LinkedIn job alerts + Hunter.io/Clay enrichment. Why it works: company is formalizing contracts for the first time; no incumbent CLM yet; decision-maker is being hired. Window: 1-3 weeks after post goes live.

2. **Tech Stack Signal** — company has a public GitHub org with active repos + uses Linear or Notion (detectable via Wappalyzer/BuiltWith). Why it works: developer-forward team will evaluate self-hosting seriously; high probability of technical champion internally. No urgency so this is a slower, value-lead sequence.

3. **Complaint Signal** — LinkedIn post or G2/Capterra review in last 30 days mentioning DocuSign price, DocuSign complexity, or switching from DocuSign. Detection: LinkedIn Boolean search `"DocuSign" AND ("too expensive" OR "looking for alternative" OR "switching from")`. Why it works: they're already in decision mode; you're an inbound call they haven't made yet.

---

## Module 7 — Pricing Page Strategy

**Purpose:** Produce the complete copy structure and rationale for the three-tier pricing page. Anchoring, objection handling, and CTA copy included.

**Rules:**
- Per-org flat rate (not per-seat) removes the "how many seats do I need to pay for" objection that kills SMB conversion
- Lead with the free tier prominently — this is a trust signal, not a loss. It says "we believe in the product enough to give most of it away."
- Anchor Cloud price against DocuSign Business Pro ($40/user/month) not against free. The question is "compared to what I'm paying now", not "compared to free."
- Objection handling below the fold is mandatory — legal buyers are risk-averse and will not purchase without answers to "what happens to my data", "is Community really free", "can I migrate"

**Output template:**

```
## Page Layout
[Community] | [Teams ← "Most Popular" badge] | [Cloud]

## Community Edition
Price: Free forever
Tagline (≤6 words):
Includes:
  - [bullet]
  - [bullet]
CTA: [button copy] → [destination: GitHub repo or one-click deploy button]

## Teams Edition
Price: $[X]/month flat (up to [N] users), then $[Y]/user above
Tagline (≤6 words):
Includes: Everything in Community, plus:
  - [bullet — gate 1]
  - [bullet — gate 2]
CTA: [button copy] → [license request form or self-serve Stripe]
Pricing rationale: [1-2 sentences on how this compares to alternatives]

## Cloud Edition
Price: $[X]/user/month (min [N] users) or $[X]/month flat
Tagline (≤6 words):
Includes: Everything in Teams, plus:
  - Managed hosting + backups
  - [managed AI key - if applicable]
  - [SLA]
CTA: [button copy]

## Objection Handlers (FAQ below the fold)
Q: Is Community Edition really free forever?
A:

Q: What happens to my data if I self-host?
A:

Q: Can I switch from self-hosted Teams to Cloud?
A:

Q: Do I need a developer to deploy?
A:

Q: What happens at the end of a Teams trial?
A:
```

**Pre-loaded pricing rationale:**
DocuSign Business Pro: $40/user/month. For a 5-person legal team, that's $2,400/year just for eSign+CLM basics. ClauseFlow Teams at $249/month flat for up to 10 users = $2,988/year — more features, data on your infra, and AI Q&A included. For teams already paying DocuSign, this is a lateral move on price with a major capability jump.

---

## Module 8 — Partnerships

**Purpose:** Identify the three-tier partnership opportunities and produce an outreach brief for each. Partnerships here mean distribution, not revenue share.

**Output template per partnership:**

```
## [Partner name]
Tier: [Integration / Ecosystem / Developer Distribution]
Why this partner matters: [what distribution or credibility they unlock]
What we offer them: [why they'd say yes]
Contact path: [who to reach, via what channel]
Outreach brief (3 sentences):
  1. [relevance — why ClauseFlow fits their users]
  2. [the ask — specific, low-commitment first step]
  3. [the value — what they get]
Timeline: [when to pursue — now vs. post-launch vs. post-Cloud]
```

**Pre-loaded partner targets:**

**Tier 1 — Integration Partnerships (build-first, then announce):**
- n8n (187k GitHub stars, strong self-hosted community, natural fit for contract automation workflows — already have docs/zapier-integration.md as starting point)
- Make (formerly Integromat) — larger non-technical buyer reach
- Zapier — highest SMB reach even if lowest dev credibility

**Tier 2 — Legal Tech Ecosystem:**
- Clio, PracticePanther, MyCase — law firm practice management. Integration use case: import client matters → generate contracts.
- Legal tech newsletters (Above the Law, Legal Rebels) — editorial coverage, not paid placement

**Tier 3 — Developer Distribution (submit, don't pitch):**
- Awesome Self-Hosted (GitHub, 46k+ stars) — submit PR. Highest value per hour of effort in this tier.
- Coolify app catalog
- Portainer templates
- Elestio, Caprover, Railway templates
- AlternativeTo listing (for SEO on "DocuSign alternative" queries)

---

## Module 9 — GTM Metrics Dashboard

**Purpose:** Define the metrics, targets, and tracking cadence that tell you whether the GTM is working — across the full funnel from awareness to revenue.

**Rules:**
- Define PQL with a specific measurable event, not a vague category like "active user"
- PLG benchmarks for context: 2-5% free→paid (all OSS), 10-15% PQL→trial, 25-30% trial→paid. These are targets, not guarantees.
- Track GitHub star velocity (weekly new stars) as the leading indicator — it predicts deployment volume 2-3 weeks ahead

**Output template:**

```
## Awareness Metrics
- GitHub star total: target [X] at day 30, [X] at day 90
- Weekly star velocity: target [X]/week by month 2
- Docker Hub pulls: target [X] at day 90
- HN/Reddit referral sessions: [how to track in PostHog/Plausible]

## Activation Metrics
- Deployments (estimated via Docker pulls or opt-in ping): [target]
- Time-to-first-contract-uploaded: target median [X minutes]
- 7-day retention (instance still active): target [X%]

## PQL Definition
An instance qualifies as PQL when it has:
- [X] contracts uploaded
- [Y] users invited (team is using it, not solo eval)
- [Z] AI Q&A queries run OR [Z] approval workflows completed
...all within [N] days of first deployment

## Conversion Metrics (PLG benchmarks in parentheses)
- PQL → Teams trial: target [X%] (benchmark: 10-15%)
- Trial → Paid: target [X%] (benchmark: 25-30%)
- GitHub star → Paid (blended): target [X%] (benchmark: 0.1-0.3%)

## Revenue Metrics
- MRR target: month 3 [X], month 6 [X], month 12 [X]
- CAC (outbound-assisted): target [X]
- Payback period: target [X months]

## Community Health
- Discord active members (posted in last 30d): [target]
- GitHub issues resolved per week: [target]
- Community PRs merged per month: [target]
- Docs page coverage (% of features documented): [target]

## Tracking Cadence
Weekly (Mondays): GitHub star velocity, Discord new members, open issues
Monthly: PQL count, trial conversions, MRR, Docker pulls
Quarterly: Full funnel review — what to change in ICP/positioning/pricing
```

---

## References

See `references/` for:
- `competitor-profiles.md` — full profiles for Ironclad, DocuSign CLM, Juro, Evisort, OpenCLM
- `oss-launch-playbook.md` — Plane/Onlook/HN channel playbook with specific yield numbers
- `coldiq-signal-library.md` — ColdIQ buying signals adapted for legal/CLM buyer triggers
- `pricing-benchmarks.md` — PLG conversion benchmarks, CLM market pricing data, OSS pricing examples

Load a reference when deep-diving into a specific module — don't load all four simultaneously.
