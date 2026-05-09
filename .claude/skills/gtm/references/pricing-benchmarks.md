# Pricing & PLG Benchmarks

## PLG Conversion Benchmarks

From ProductLed research (2025) and OpenView Partners SaaS benchmarks:

| Stage | Benchmark | Top quartile |
|-------|-----------|-------------|
| Free install → any paid | 2-5% | 7-10% |
| PQL (Product Qualified Lead) → trial | 10-15% | 20-25% |
| Trial → paid | 25-30% | 35-45% |
| GitHub star → paid (blended, OSS) | 0.1-0.3% | 0.5-1% |
| Self-hosted deploy → paid (blended) | 1-3% | 5-8% |

**Implication for ClauseFlow targets:**
- 10,000 GitHub stars → 30-100 paying orgs (low end at launch, improving as PQL funnel matures)
- 1,000 self-hosted deployments → 10-30 paying orgs
- 150 PQLs → 15-45 trials → 4-14 paid orgs per cohort

---

## CLM Market Pricing (2025-2026)

| Product | Pricing model | SMB entry price |
|---------|--------------|----------------|
| DocuSign Business Pro | Per user/year | $40/user/month (~$480/user/year) |
| Ironclad | Quote-based | $50,000+/year minimum |
| Juro | Per workspace | ~$7,500/year (Team plan) |
| Contractbook | Per workspace | $249-599/month |
| Evisort | Quote-based | Enterprise only |
| Conga CLM | Quote-based | Enterprise only |

**Average legal team size at SMB (20-200 employees):** 1-3 people  
**Average spend on CLM at SMB:** $5,000-25,000/year if they're using an enterprise tool  
**Most common current state:** DocuSign standard eSign ($15-25/user/month) + Google Drive + spreadsheet tracker = total chaos

---

## Open Core Pricing Benchmarks

Companies with similar open-core models and their pricing:

| Company | Community | Teams/Pro | Enterprise |
|---------|-----------|-----------|-----------|
| Metabase | Free (OSS) | $500/month (5 users) | Custom |
| n8n | Free (self-hosted) | $20/user/month | Custom |
| Plane | Free (OSS) | $8/user/month | Custom |
| GitLab | Free (CE) | $29/user/month | $99/user/month |
| Grafana | Free (OSS) | $299/month (3 users) | Custom |
| Supabase | Free | $25/month | Custom |
| Cal.com | Free (OSS) | $12/user/month | Custom |
| Posthog | Free (OSS) | Pay-as-you-go | Custom |

**Pattern:** Most successful open-core companies price their paid tier at 3-10x the cost of an individual paying their share of a SaaS alternative. The mental math: "I'm paying DocuSign $40/user/month = $480/year for 3 users = $1,440/year. ClauseFlow Teams at $199/month = $2,388/year but I also get AI agents and self-hosting. Net-net reasonable."

---

## Recommended ClauseFlow Pricing Structure

Based on market data, competitor pricing, and open-core benchmarks:

### Community Edition
- **Price:** Free forever
- **Gates:** None on core features (contracts, upload, AI extraction, search, approvals, DocuSeal signing, webhooks, notifications, API)
- **Rationale:** This is the viral engine. Don't nerf it.

### Teams Edition — Self-Hosted
- **Price:** $199/month flat for up to 10 users, $19/user/month above 10
- **Gates:** AI Agents (Renewal Agent, Review Agent, Intake Agent), SSO/SAML, advanced analytics dashboard, audit log export (CSV/API), custom data retention policies, priority email support (48h SLA)
- **Rationale:**
  - $199/month vs $40/user/month DocuSign for a 3-person team = same annual cost, but you own your infra and get AI agents
  - Flat rate removes "how many seats" negotiation — SMBs hate per-seat math
  - AI Agents are genuinely painful to not have at scale (renewing 50+ contracts manually hurts)
  - SSO gates enterprise evaluation — if they need SSO, they're at Teams+ budget
- **Trial:** 14 days, all features unlocked, no credit card required, self-serve via license key

### Cloud Edition (future)
- **Price:** $29/user/month (minimum 3 users = $87/month floor), or $249/month flat for up to 10 users
- **Includes:** Everything in Teams + managed hosting + automated backups + managed AI keys (we pay for Anthropic/OpenAI) + 99.9% uptime SLA
- **Rationale:**
  - Competes directly with Juro Team plan (~$625/month for 10 users) at a lower price
  - Managed AI keys remove the "I need to get an OpenAI API key" friction for non-technical buyers
  - Cloud is the upsell path for orgs that started on self-hosted Community and grew past their ops capacity

---

## Support Pricing Logic

From the open-source commercial model research: 67% of orgs that pay for commercial OSS cite enhanced support as the #1 driver.

This means the Teams tier must include a meaningful support SLA — not just access to a Discord channel. Recommended:
- Community: GitHub issues + community Discord (best effort, no SLA)
- Teams: Private email support, 48-hour first response SLA, dedicated Slack channel for orgs with 5+ users
- Cloud: 24-hour SLA, dedicated onboarding session, priority feature requests

---

## Annual vs Monthly Pricing

OSS open-core best practice: offer annual billing with a 2-month discount (16% off = 10 months for 12 months price).

- Monthly Teams: $199/month
- Annual Teams: $1,990/year ($166/month equivalent — "2 months free")

Annual billing improves cash flow and reduces churn risk. Most open-core companies see 60-70% of Teams customers choose annual once the product proves value.
