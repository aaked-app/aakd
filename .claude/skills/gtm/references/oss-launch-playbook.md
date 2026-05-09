# OSS Developer Tool Launch Playbook

Sourced from: Plane (20k+ stars), Onlook (3 launches), n8n ($60M Series B), Metabase (35k+ stars), and the definitive HN vs PH yield analysis.

---

## Channel Yield Rankings (GitHub stars per effort unit)

| Rank | Channel | Typical yield | Notes |
|------|---------|--------------|-------|
| 1 | Hacker News Show HN | 1,000–7,000 stars | Highest ceiling, high variance. Founder must be in comments all day. |
| 2 | r/selfhosted | 300–800 stars | High-intent community. "Self-hosted" in title mandatory. |
| 3 | r/devops | 200–500 stars | Works if there's a deployment/ops angle. |
| 4 | GitHub Trending algorithm | Multiplier (2-5x) | Triggered by concentrated HN + Reddit in 48h window. Self-reinforcing. |
| 5 | LinkedIn (founder story) | 50-300 stars + enterprise buyer awareness | Different audience: GC, COO, legal ops leads. Lower star yield, higher buyer yield. |
| 6 | Product Hunt | 500–1,500 stars | Use as Week 2 move after HN momentum is live. |
| 7 | r/legaltech | 100–300 stars | Smaller community but hyper-targeted ICP |
| 8 | DEV.to / Hashnode | 50-200 stars | Content durability; organic SEO value over time |

**Key insight:** HN and Reddit together in a 48-hour window is the only reliable way to hit GitHub Trending. Once you're trending, star velocity compounds for 3-5 days. Plan your launch for this exact scenario.

---

## Hacker News Show HN — Complete Playbook

### Title formula (based on top-performing dev tool launches)
```
Show HN: [Product] – [open-source alternative to X] ([3 key technical differentiators])
```

Examples from successful launches:
- "Show HN: Plane – open-source alternative to Jira (self-hosted, no vendor lock-in)"
- "Show HN: n8n – open-source alternative to Zapier (fair-code, self-hosted, 1,000+ integrations)"

For ClauseFlow:
- "Show HN: ClauseFlow – open-source, self-hostable alternative to DocuSign CLM (AI Q&A, pgvector, Docker Compose)"

### What drives HN upvotes
1. Clear "open-source alternative to [known product]" framing — developers immediately understand the value
2. Technical depth in the post body — explain *how* it's built, not just what it does (pgvector for semantic search, BullMQ for async jobs, etc.)
3. Founder honesty — mention what's not done yet, limitations, what you're learning
4. Fast, technical responses to every comment in the first 3 hours (this drives the upvote velocity before algorithms kick in)

### What kills HN performance
- Marketing language in title or post ("game-changing", "revolutionary")
- Generic description (just calling it "a contract management tool")
- Founder not present in comments — this is the most common failure
- Posting at wrong time (European morning, late evening US, weekends)

### Timing
- Best window: Tuesday or Wednesday, 8am–10am PT
- Avoid: Monday (inbox-clearing day), Thursday-Sunday (weekend drift)
- Avoid: same week as major tech news events (WWDC, major framework releases)

---

## Reddit Strategy

### Subreddit priority list
1. r/selfhosted — 350k members, extremely high-intent, self-hosting is the entire identity
2. r/devops — 500k members, infra-minded, respond well to Docker/K8s deploy stories
3. r/legaltech — smaller but hyper-targeted ICP (legal ops, GC, legal tech buyers)
4. r/projectmanagement — large, adjacent (contract management is project management)
5. r/entrepreneurship — for founder story angle, not technical pitch

### Reddit post tone rules (non-negotiable)
- Never start with "I'm excited to share" — immediate downvote trigger
- Lead with the problem you solved, not the product
- Include a self-hosted demo link or screenshot in every post
- Respond to every comment within 2 hours on launch day
- Acceptable: "built this because I was frustrated with X" → not acceptable: "check out my new product"

### Sample r/selfhosted post frame
```
Title: I got tired of paying $40/user/month for DocuSign CLM, so I built an open-source alternative you can self-host in 10 minutes

Body: [3-4 paragraphs of problem context, what you built, tech stack, how to try it]
[Screenshot of dashboard]
[GitHub link]
```

---

## The GitHub Trending Flywheel

The GitHub Trending algorithm shows repositories that have had concentrated star activity in the last 24-48 hours, not the highest absolute star count.

**How to trigger it:**
1. Coordinate HN + Reddit posts to land in the same 24-hour window
2. Pre-brief your personal network to star at launch time (not before — GitHub detects artificial early spikes)
3. Post HN at 8am PT, Reddit at 8am PT simultaneously
4. If you hit 50+ stars in the first hour, you're likely to trend by hour 6

**What trending does:**
- Once on trending, new visitors land and star "because it's trending" — self-reinforcing loop
- Trending drives inbound to your Discord, issues, and docs
- Some developer community newsletters (TLDR Dev, Hacker Newsletter) scan trending daily — free coverage

---

## Product Hunt

### When to launch on PH
- Week 2 after HN, not simultaneously
- Use the accumulated GitHub stars from HN as social proof ("20k GitHub stars in one week")
- PH hunters and makers are different from HN — less technical, more product-focused

### PH performance factors
1. Number of upvoters in first 2 hours (get your network aligned on timing)
2. Maker responsiveness to comments
3. Gallery assets — PH users are visual; strong screenshots matter more than on HN
4. Hunter with a large following sponsoring the launch (find a PH power-user to submit on your behalf)

### PH is not the launch — it's a signal amplifier
PH adds legitimacy for non-developer buyers (legal ops, GC, procurement). They search PH for tool alternatives. Being findable there matters more than the launch day spike.

---

## n8n's OSS → Commercial Playbook (Direct Analogue)

n8n is the most direct comparable to ClauseFlow: self-hosted automation tool, fair-code license, OSS community → commercial success.

Key facts:
- 187k+ GitHub stars
- $60M Series B (2022)
- 5x ARR YoY for multiple years
- 80%+ of paying customers came through OSS community first

**What they did right:**
1. Never gated core functionality — the OSS version is genuinely useful and complete
2. Community first, sales second — built Discord before running any paid acquisition
3. Docs as marketing — "how to automate [use case]" blog posts rank for commercial queries
4. Enterprise features gated thoughtfully: SSO, LDAP, audit logs, air-gapped deployment — things that hurt at scale, not cosmetic removals
5. Made it easy to self-host (npm package, Docker image, one-click cloud options) — reduced deployment friction was a deliberate growth lever

**Lesson for ClauseFlow:** The OSS flywheel requires genuinely good free product. Users who deploy ClauseFlow Community and succeed become advocates. Users who hit artificial gates become detractors. Design the gate for "I've outgrown Community" not "Community is crippled."

---

## Metabase's Community Strategy

Metabase (open-source BI) reached 35k+ GitHub stars with:
1. Monthly changelog with a fixed format (excitement → education → information)
2. "Answered every single GitHub issue" policy for first 18 months
3. Documentation that targeted search queries ("how to build a sales dashboard"), not just feature reference
4. Community forums before Discord — searchable history matters for developer tools

**Lesson for ClauseFlow:** Searchable documentation and GitHub issues are worth more long-term than Discord messages. Prioritize writing thorough responses to issues over chatting in Discord.
