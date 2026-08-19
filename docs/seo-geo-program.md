# Aakd SEO and generative-search program

**Status:** active Phase 0 acquisition and evidence work

**Canonical domain:** `https://aakd.app`

**Audience:** maintainers, founder, and approved marketing contributors

## Goal

Within 90 days of the first verified deployment, make Aakd a crawlable,
unambiguous, evidence-rich source for open-source and self-hosted contract
operations. This program measures qualified discovery and activation, not
rankings, stars, or AI mentions in isolation.

The program is successful only when all of the following are true:

- Intended public pages are available over HTTPS, return `200`, have
  self-referential canonical URLs, unique metadata, and sitemap entries.
- Private workspace, authentication, invitation, and API routes are not
  indexable.
- `http`, apex, and `www` variants converge in one permanent redirect to
  `https://aakd.app`.
- Google Search Console and Bing Webmaster Tools have accepted the sitemap.
- Six public intent pages and three reproducible evidence assets are live.
- Search, GitHub, approved community, and AI-referral sources can be measured
  through a high-intent action without collecting contract content.

These are operating targets, not promises that Google, Bing, or an AI system
will index, rank, or cite Aakd.

## What GEO means here

For Google Search, generative-search optimization is ordinary SEO: crawlable
pages, clear entity information, useful original content, and good page
experience. There is no special schema, `llms.txt`, content chunking, or
keyword-page strategy required for AI Overviews or AI Mode. See Google's
[AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
and [generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

Use structured data to describe visible facts, not to create claims. Do not
publish AI-generated comparison pages, invented reviews, customer outcomes,
certifications, or citations.

## Current baseline

Record the date and evidence source whenever this table changes.

| Concern | Verified state | Required action |
| --- | --- | --- |
| Canonical domain | `aakd.app` is the chosen domain. | Maintain one apex canonical. |
| Production deployment | The live site must be checked after every deployment; local source changes do not prove live behavior. | Run the live crawl matrix below. |
| Public discovery files | The app generates `/robots.txt` and `/sitemap.xml`. | Verify public `200` responses after deployment. |
| Public product surface | The homepage is the only current public product page. | Do intent research before adding pages. |
| Entity claims | Aakd is an early AGPL, self-hostable contract operations workspace. | Keep README, site, GitHub, releases, and schema aligned. |

## Workstream 0: deploy and unblock discovery

### Repository controls

- Keep canonical metadata, Open Graph/Twitter metadata, a canonical-only
  sitemap, and machine-readable `WebSite`/`SoftwareApplication` data on the
  homepage.
- Keep `/robots.txt` and `/sitemap.xml` public through the authentication
  middleware.
- Use `noindex, follow` on login, registration, recovery, organization setup,
  and invitation pages, while allowing crawlers to fetch those pages and read
  the directive. `robots.txt` is crawl management, not a reliable deindexing
  control.
- Keep all private application and API paths out of the sitemap.
- Preserve visible-text and structured-data parity.

### External actions owned by Wassim

1. Point the apex domain at the deployed application and verify its TLS
   certificate.
2. Create a `www.aakd.app` DNS/TLS route and permanently redirect it to
   `https://aakd.app`. Also redirect HTTP to HTTPS in one hop.
3. Deploy the verified repository changes.
4. Verify the Google Search Console domain property and the Bing Webmaster
   Tools property.
5. Submit `https://aakd.app/sitemap.xml`, inspect the homepage, and request a
   recrawl only after the live crawl matrix passes.

### Live crawl matrix

| URL or client | Expected result |
| --- | --- |
| `https://aakd.app/` | `200`, canonical to itself, descriptive title/description, Open Graph/Twitter data, JSON-LD |
| `https://aakd.app/robots.txt` | `200`, `text/plain`, sitemap reference |
| `https://aakd.app/sitemap.xml` | `200`, XML, only canonical public URLs |
| `https://www.aakd.app/` | one `301` or `308` redirect to the apex URL |
| `http://aakd.app/` | one permanent redirect to the HTTPS apex URL |
| Googlebot, Bingbot, OAI-SearchBot | same public homepage response as a normal visitor |
| login, registration, invitation | `noindex, follow` |
| workspace/API paths | absent from sitemap and denied by crawler policy |

## Workstream 1: entity and trust

Use this exact core identity, with natural grammatical variations only:

> Aakd is an open-source, self-hostable contract lifecycle management platform for reviewed, source-linked contract operations.

Maintain it in the homepage, README opening, GitHub description and homepage,
organization profile, releases, and founder profiles. Supporting concepts such
as Agreement Operations, citations, obligations, and governed API/MCP access
must not replace the category name.

Safe repository work:

- Maintain a connected `WebSite` and `SoftwareApplication` graph linked to the
  public GitHub repository.
- Add a real product-specific 1200 × 630 social image before changing the
  social card to `summary_large_image`.
- Add first-party About/Product Truth and Security/Trust pages only from
  verified product facts.
- Correct a public version or framework statement when the release evidence
  changes. Do not make a release claim only because source code changed.

External settings:

- GitHub homepage must be exactly `https://aakd.app`.
- Keep relevant GitHub topics accurate, not exhaustive.
- Upload an approved repository social-preview image.
- Publish a GitHub release only after the standard release verification.

## Workstream 2: intent research and page architecture

Before creating new public URLs, collect US and UK SERPs separately for these
seed intents:

1. open-source CLM
2. self-hosted CLM
3. open-source contract management software
4. contract obligation management
5. contract renewal management
6. post-signature contract management
7. AI contract review with citations

The research output must contain 20 sampled queries, the first ten results for
each seed intent, five non-overlapping intent clusters, target audience,
evidence requirement, CTA, and cannibalization risk. Do not invent search
volume before Search Console data exists.

Potential pages, pending that research:

- `/open-source-contract-lifecycle-management`
- `/self-hosted-contract-management`
- `/contract-obligation-management`
- `/contract-renewal-management`
- `/post-signature-contract-management`
- `/docs/self-hosting`

Each approved page needs server-rendered main content, one H1, a unique title
and description, a self-canonical, at least two contextual internal links in
and out, a sitemap entry, current limitations, and claims checked against
`PRODUCT.md`.

## Workstream 3: original evidence before routine content

Publish these assets in order, only after a second person can reproduce their
core result:

1. An open-source CLM benchmark: clean install to a source-cited, reviewed
   action.
2. A self-hosted CLM data and AI-egress evaluation checklist.
3. A synthetic executed-agreement to obligation-register walkthrough with an
   owner, deadline, citation, review, and completion evidence.

Each asset needs an author, update date, Aakd-affiliation disclosure, tested
version, method, limitations, primary sources, descriptive media, and one
useful CTA. It must not claim customer adoption or competitor shortcomings
without direct evidence.

After those assets are reproducible, the next educational pages may cover:

- what Aakd includes today as an open-source CLM;
- production self-hosting checks;
- renewal dates versus contract notice mechanics, without legal advice;
- safely exposing contract context through reviewable API/MCP access.

## Workstream 4: measurement

### Source of truth by question

| Question | Source |
| --- | --- |
| Is Google indexing the page? | Google Search Console |
| Which query drove Google discovery? | Search Console Performance |
| Which page or query is cited by Bing AI? | Bing Webmaster Tools AI Performance, when available |
| Did the visitor take a high-intent action? | Consent-aware product analytics |
| Did developer discovery lead to use? | GitHub traffic, clone data, issues, and clean-install reports |

Add only consent-aware public-site events:

- `marketing_cta_clicked`
- `github_outbound_clicked`
- `self_hosting_guide_opened`
- `registration_started`

Each event may include page path, CTA name, destination class, referrer domain,
and UTM campaign fields. It must never include contract text, document names,
user-entered content, secrets, or customer-specific data.

Review weekly by indexed status, page, query cluster, country, source, and CTA.
Track US and UK evidence separately. A useful 90-day outcome is an indexed
official branded result, impressions in at least three non-branded clusters,
and five organic or AI-referred high-intent actions. If two non-branded clusters
have not produced impressions after the initial evidence assets, stop publishing
new pages and revise the positioning from Search Console evidence.

## Workstream 5: authority and distribution

Every external post, directory submission, or message requires explicit review
of destination rules, the exact claim, and the affiliation disclosure. Share
reproducible evidence pages, release notes, or checklists—not generic product
promotions. Do not buy links, mass-submit directories, manufacture stars or
reviews, or create inauthentic mentions.

## References

- [Google: technical requirements](https://developers.google.com/search/docs/essentials/technical)
- [Google: canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google: sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google: structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google: helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: AI features and websites](https://developers.google.com/search/docs/appearance/ai-features)
