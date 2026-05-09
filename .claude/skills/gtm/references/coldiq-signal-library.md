# CLM Buyer Signal Library

Adapted from ColdIQ's buying-signals framework for legal/contract management buyers.

## Signal Ranking by Purchase Correlation

| Rank | Signal | Purchase correlation | Detection difficulty |
|------|--------|---------------------|---------------------|
| 1 | Former DocuSign/Ironclad user who left → now at new company | Very high | Medium (LinkedIn history) |
| 2 | New legal operations hire | Very high | Low (job alerts) |
| 3 | DocuSign complaint on LinkedIn or G2 | High | Low (Boolean search) |
| 4 | Company posts "Head of Legal" or "Contract Manager" role | High | Low (job boards) |
| 5 | Company has active GitHub org + uses Linear/Notion (dev-forward) | Medium | Low (Wappalyzer/GitHub) |
| 6 | Series A/B funding announcement in last 90 days | Medium | Low (Crunchbase/LinkedIn) |

---

## Signal 1: Former CLM User (Highest Intent)

**Description:** Someone who previously used DocuSign CLM, Ironclad, Juro, or Evisort at a prior company, just joined a new company that has no CLM yet.

**Detection:** LinkedIn + Job Changes
```
Boolean search: "legal operations" OR "contract manager" AND "DocuSign" OR "Ironclad" OR "Juro"
Filter: Changed jobs in last 90 days
```

**Trigger condition:** Person has [CLM tool] in work history AND started new role in last 60 days AND new company has <200 employees (likely no CLM yet)

**Timing:** Contact within 2 weeks of job start date (they're in "build the function" mode)

**Why it works:** They know the problem deeply, have used incumbents, and are building a new function from scratch. Budget is likely available. They will evaluate alternatives seriously.

**Day 1 LinkedIn DM:**
```
{{First name}}, saw you just joined [company] — congrats. With your background at [prior company] using [CLM tool], you've probably already started thinking about how to set up contracts at [new company].

Quick question before you lock anything in: are you evaluating self-hosted options at all, or has cloud-only already been decided?

[Your name]
```

---

## Signal 2: Legal Operations Hire (High Intent, Time-Sensitive)

**Description:** Company posts a Legal Operations Manager, Contract Manager, or Head of Legal role on LinkedIn or a job board.

**Detection:**
- LinkedIn Jobs Alert: "Legal Operations" AND "contract" in title, last 7 days
- Greenhouse/Lever/Ashby job boards: same search
- Clay.com enrichment to qualify firmographics after detection

**Trigger condition:** 
- Company size 25-300 employees (formalizing contracts for first time)
- No existing legal ops infrastructure (can verify via LinkedIn — no existing legal ops people at company)
- Industry: SaaS, professional services, healthcare, real estate (high contract volume)

**Timing:** Act within 5 days of job posting. After 3 weeks, the hire is likely imminent and the decision will be made by the incoming person, not the current decision-maker.

**Day 1 email:**
```
Subject: Contract infrastructure for [company]'s incoming legal hire

{{First name}},

Noticed [company] is hiring a Legal Operations Manager — usually signals the team is ready to move beyond shared drives and DocuSign standard.

The person you hire will almost certainly evaluate CLM tools in their first 30 days. Before that decision gets made, worth knowing there's an open-source option that deploys in 10 minutes and keeps data on your infra.

Worth a quick look before the search closes? [GitHub link]

[Your name]
```

---

## Signal 3: DocuSign Complaint Signal (Active Shopping)

**Description:** Someone at an ICP company publicly complained about DocuSign pricing, complexity, or is "looking for an alternative."

**Detection:**
```
LinkedIn Boolean: "DocuSign" AND ("too expensive" OR "alternative" OR "switching" OR "frustrated" OR "overpriced")
Filter: Posted in last 30 days, poster is at company matching ICP firmographics
```

Also monitor:
- G2 reviews mentioning switching (flag 3-star or below DocuSign CLM reviews from last 60 days)
- Reddit: r/legaltech, r/smallbusiness posts mentioning DocuSign frustration

**Trigger condition:** Direct complaint OR stated intent to switch, poster is decision-maker or influencer (legal ops, COO, Head of Legal, founder)

**Timing:** Within 24 hours of post — they're in active consideration mode

**Day 1 LinkedIn comment + DM:**
```
Comment on their post: "If you're open to it, there's an open-source option that deploys on your own infra — might be worth a look: [GitHub link]"

Follow-up DM (if no response in 3 days):
{{First name}}, dropped a link on your [DocuSign] post. Happy to share more context if the self-hosted angle is interesting. What's your current contract volume like?
```

**"Why Are You Paying" framework (ColdIQ):**
This is the most effective cold email framework for free alternatives:
```
Subject: What's your DocuSign CLM costing you?

{{First name}},

Quick math question: at $40/user/month with [N] legal team members, you're paying [$X]/year for DocuSign CLM.

ClauseFlow is an open-source alternative that deploys on your infra in 10 minutes, includes AI contract Q&A, and costs $0 for the community edition.

Worth 15 minutes to look at the numbers together?
```

---

## Signal 4: New Legal Hire (Greenfield Opportunity)

**Description:** Company hires their first in-house lawyer or first dedicated legal person.

**Detection:**
- LinkedIn new job announcements: "General Counsel" OR "Associate GC" OR "VP Legal" at company with no prior legal team visible
- Search for "first in-house" posts on LinkedIn

**Trigger condition:** First legal hire at company 25-500 employees, no existing CLM (no legal ops people visible on LinkedIn)

**Timing:** First 30 days — they're building their toolstack and will set defaults the company uses for years

---

## Signal 5: Tech Stack Signal (Dev-Forward Company)

**Description:** Company has a public GitHub org with active repos AND their website uses Notion, Linear, or developer-forward tooling — indicates they'll evaluate self-hosting seriously.

**Detection:**
- Wappalyzer / BuiltWith API: detect Notion, Linear, Vercel, Cloudflare on company domain
- GitHub orgs: company with public repos and recent commits
- Job posts mentioning "you'll use Linear" or "we use Notion"

**Trigger condition:** 2+ of: public GitHub org, Notion/Linear detected, recent engineering job posts

**Timing:** No urgency signal — this is a slow outreach campaign (educational, not "act now")

**Day 1 LinkedIn DM (value-first, no pitch):**
```
{{First name}}, saw [company] uses [Linear/Notion] — nice stack. 

We're building ClauseFlow, an open-source CLM built on the same principles (self-hostable, API-first, actually developer-friendly). 

Not pitching — just curious: how does [company] currently manage vendor contracts? Building in public and always want to understand real workflows.
```

---

## Signal 6: Funding Announcement

**Description:** Company announces Series A or B funding. Legal volume is about to increase sharply (hiring, new vendor contracts, customer contracts, NDAs).

**Detection:** Crunchbase, LinkedIn funding posts, TechCrunch, press releases

**Trigger condition:** Series A-B, $5M-$50M range, company size 20-200 employees

**Timing:** Within 1 week of announcement

**Day 1 email:**
```
Subject: Contracts will triple in the next 90 days

{{First name}},

Congrats on [round] — that's a strong signal for [company].

One thing most Series [A/B] companies underestimate: contract volume triples in the first 90 days post-close (new hires, vendors, customers, partnership agreements).

Worth knowing about ClauseFlow before that happens — open-source CLM, deploys on your infra, AI extraction built in. [GitHub link]

[Your name]
```

---

## Outreach Rules (ColdIQ philosophy)

1. **Diagnose before prescribing.** First message asks about their situation. Never pitches a solution.
2. **One CTA per message.** Never "check this out AND book a call AND reply if interested." Pick one.
3. **Mention the signal.** The message must reference WHY you're reaching out now. Timely relevance = trust.
4. **Three touches max.** Day 1, Day 3-4, Day 7-8. After that, move on. No "bumping this to the top" emails.
5. **Short = higher reply rate.** Mobile-optimized. Under 100 words for first message. Under 60 for follow-ups.
6. **Personal LinkedIn DM before cold email** for high-signal prospects (signals 1, 2, 3). Email for bulk outreach on lower signals (5, 6).
