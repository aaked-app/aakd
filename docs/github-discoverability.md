# GitHub discoverability plan

This plan improves how prospective users find and understand Aakd. It does not
promise rankings, customer adoption, or product claims that cannot be verified.

## Positioning

Use one consistent description everywhere:

> Aakd is an open-source, self-hosted, AI-native contract lifecycle management
> platform for contract operations.

Supporting terms belong in natural context, not keyword lists: contract
management, CLM, legal tech, PDF/DOCX, OCR, self-hosting, Ollama, DocuSeal,
API, and MCP.

## Priority 0 — keep the repository understandable

Owner: maintainers. Cadence: each public release.

- Keep GitHub's description and 12–15 accurate topics current.
- Keep the README's first screen specific about product category, deployment
  model, primary workflow, and limitations.
- Keep clone, installation, API, security, license, release, and screenshot
  links working.
- Publish releases with concise notes describing verified user-visible changes.
- Add a repository social preview image (1280 × 640 or similar) when brand
  assets are approved. It improves link recognition; it is not a ranking lever.

Success signal: the public repository page returns 200 and exposes a descriptive
title, Open Graph title/description, public visibility, and accurate topics.

## Priority 1 — establish one canonical public page

Owner: product/marketing. Prerequisite: a verified public domain or demo URL.

- Set the GitHub repository Homepage field only to that verified canonical URL.
- Make the page crawlable and give it a distinct title and description that
  match the repository positioning.
- Link to the GitHub repository with descriptive anchor text such as
  "Aakd open-source contract lifecycle management on GitHub".
- Add a sitemap and submit the canonical site to Google Search Console.
- Verify the domain in Search Console, inspect the homepage and repository
  referral URLs, then request a recrawl after material updates.

Success signal: Search Console shows the canonical page as indexed and reports
impressions for branded queries. Indexing can take days or weeks; requesting a
recrawl is not a ranking guarantee. See Google's guidance on
[requesting a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

## Priority 2 — earn relevant discovery links

Owner: maintainer with explicit approval for every destination.

1. Publish the existing launch post in one community where Aakd is genuinely
   useful, starting with an open-source or self-hosting audience.
2. Submit only to curated directories that explicitly accept self-hosted or
   legal-tech projects and meet their contribution rules.
3. Share a reproducible workflow demo: executed agreement → source-linked
   facts and obligations → human review → owners and deadlines.
4. Turn operator feedback into a release note, issue, or documentation update;
   do not manufacture testimonials, comparisons, or stars.

Before every post, verify the setup flow on a clean machine, describe one
reproducible workflow and its current limitations, and disclose the Aakd
affiliation. Never mass-submit, buy links, use keyword-stuffed profiles, or ask
people to star the project without evaluating it.

Success signal: qualified referral traffic, clean-install reports, first
contract uploads, actionable issues, and repeat use—not just stars.

## Measurement cadence

Review monthly and record the date, source, and result:

| Signal | Source | Decision it informs |
| --- | --- | --- |
| Branded search impressions/clicks | Google Search Console | Whether canonical-site SEO is working |
| Repository views, clones, and referrers | GitHub traffic insights | Which distribution channels reach developers |
| Clean-install and workflow completion | Issues, discussions, activation evidence | Whether visitors can use the product |
| Qualified feedback and repeat use | Evidence ledger | Whether to deepen a channel or change the workflow |

Do not treat a single search result, star spike, or crawl request as proof of
durable discoverability. Keep the repository and canonical site truthful,
useful, and linked from relevant places over time.
