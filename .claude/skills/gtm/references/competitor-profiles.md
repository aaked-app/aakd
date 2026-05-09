# Competitor Profiles

## DocuSign CLM
- **Price:** Business Pro ~$40/user/month ($480/user/year). Enterprise custom. eSign seats additional.
- **Deployment:** Cloud only
- **Implementation:** 3-12 month average. Requires dedicated IT/legal ops resources.
- **Key features:** Word add-in for authoring, workflow automation, repository, eSign integrated
- **Key weaknesses:** Word-dependent (non-technical legal teams struggle), slow to deploy, complex pricing, no AI Q&A, no self-host
- **G2 rating:** 4.4/5 — most complaints are about pricing, complexity, and customer support
- **Who buys it:** Enterprise legal teams 200+ employees, procurement orgs, companies already on DocuSign eSign
- **Our angle:** "DocuSign CLM for teams who want control of their data and a 10-minute deploy"

## Ironclad
- **Price:** Quote-based, reportedly $50k/year minimum at SMB scale. Not available to companies under 100 employees.
- **Deployment:** Cloud only
- **Key features:** Sophisticated workflow builder (Workflow Designer), contract repository, counterparty portal, Salesforce integration
- **Key weaknesses:** No native eSign (requires DocuSign add-on), no self-host, complex setup, completely out of SMB reach, no semantic search or AI Q&A
- **G2 rating:** 4.6/5 — mostly enterprise reviewers
- **Who buys it:** In-house legal teams at growth-stage to enterprise companies, deal-heavy industries (SaaS, finance, real estate)
- **Our angle:** "Ironclad's workflow power, without the $50k floor or vendor lock-in"

## Juro
- **Price:** ~$400-500/user/year at SMB scale. Team plan reportedly $7,500/year minimum.
- **Deployment:** Cloud only
- **Key features:** Clean browser-native editor, approval workflows, eSign, repository, basic analytics
- **Key weaknesses:** No self-host, no AI Q&A, no semantic search, proprietary format limits Word import/export fidelity, opaque pricing
- **G2 rating:** 4.7/5 — strong UX reviews
- **Who buys it:** SMB/mid-market legal teams, HR teams, ops-focused buyers who want a clean UX over power features
- **Our angle:** "Juro's UX philosophy, self-hosted, with AI Q&A and transparent pricing"

## Evisort (now Workday)
- **Price:** Enterprise only, quote-based ($50k+ range)
- **Deployment:** Cloud only
- **Key features:** AI extraction (market leader for post-signature analysis), obligation tracking, analytics
- **Key weaknesses:** Acquired by Workday in 2024 — vendor lock-in risk just increased substantially. Enterprise only. No self-host. Prices will increase.
- **Who buys it:** Enterprise legal+procurement teams that need post-signature obligation tracking
- **Our angle:** "Everything Evisort does for AI extraction — with no Workday dependency, on your infra"

## Icertis
- **Price:** Enterprise, quote-based ($100k+ range)
- **Deployment:** Cloud + on-prem enterprise
- **Key features:** Enterprise CLM, global multi-language, SAP/Salesforce deep integration
- **Weaknesses:** Not relevant to our ICP (enterprise only, too complex for SMB)
- **Our angle:** Not a direct competitor at current ICP

## OpenCLM (open source)
- **GitHub stars:** Low (under 500 at last check)
- **Last commit:** Irregular, unclear maintenance status
- **Stack:** PHP-based, no AI features, no pgvector, no Docker Compose quick-start
- **Our angle:** ClauseFlow has BullMQ job queue, pgvector semantic search, AI Q&A, full test suite, active development

## Contractbook
- **Price:** $249-599/month per workspace (SMB-friendly)
- **Deployment:** Cloud only
- **Key features:** Template library, eSign, basic repository, Zapier integrations
- **Weaknesses:** No self-host, no AI Q&A, limited for complex workflows, no semantic search
- **Our angle:** Direct SMB competitor on price — we win on AI + self-hostability

## Summary Competitive Matrix

| Dimension           | DocuSign CLM | Ironclad | Juro | Evisort | ClauseFlow |
|---------------------|-------------|----------|------|---------|------------|
| Self-hostable       | ✗           | ✗        | ✗    | ✗       | ✓          |
| Open source         | ✗           | ✗        | ✗    | ✗       | ✓ (AGPL)   |
| AI Q&A              | ✗           | ✗        | ✗    | ✓       | ✓          |
| Semantic search     | ✗           | ✗        | ✗    | ✓       | ✓ pgvector |
| eSign built-in      | ✓           | ✗        | ✓    | ✗       | ✓ DocuSeal |
| Transparent pricing | ✗           | ✗        | ✗    | ✗       | ✓          |
| SMB accessible      | ✗           | ✗        | ✓    | ✗       | ✓          |
| Deploy time         | Months      | Months   | Days | Months  | 10 min     |
| API-first           | Partial     | Partial  | ✗    | ✗       | ✓ (MCP)    |
