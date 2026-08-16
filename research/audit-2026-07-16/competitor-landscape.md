# CLM Competitor & Open-Source Landscape

**Date:** 2026-07-16 · **Phase:** Desk research (Phase 1) · **Context:** Aakd (repo ClauseFlow) — open-source, self-hostable CLM. Primary ICP: non-lawyer business operators (ops/finance/founders).

> **Headline:** There is **no real open-source competitor covering the full contract lifecycle** (repository + renewals + approvals + obligations + AI). The one product marketed that way — OpenCLM (openclm.ai) — is **vaporware**: its claimed GitHub repo 404s and does not exist. Every other OSS project in the space (Wraft, Documenso, DocuSeal, OpenSign) is document-authoring or e-signature only. Aakd's "open-source, self-hostable, full-lifecycle CLM" positioning is genuinely uncontested in OSS as of July 2026.

---

## Task 1 — Commercial CLM competitors (2026 state)

| Vendor | Feature set vs. Aakd | Pricing | ICP | AI | Biggest weakness for non-lawyer ops |
|---|---|---|---|---|---|
| **Ironclad** | Repository, workflow, in-browser editor, track changes, AI Jurist assistant, template library, version compare. No native e-sign. | Custom quote; ~$40K-$80K/yr SMB, $150K+ enterprise, effective $200-$600/user/mo [single-source: hyperstart.com] | Enterprise legal ops teams | AI Jurist, risk flagging | Built for legal-ops admins, not ops generalists; no native e-sign; 3-6mo implementation typical |
| **DocuSign CLM / IAM** | Full enterprise CLM, Navigator/Iris AI semantic search + drafting + risk scoring, obligation tracking, deep Salesforce/Slack | $10K-$50K+/yr, $480/user/yr Business Pro [single-source: hyperstart.com] | Enterprise legal + sales ops | Navigator/Iris | Word-dependent, 3-12mo implementation, unintuitive UI for non-power-users |
| **PandaDoc** | Proposals, CPQ, e-sign, workflow, Salesforce/HubSpot/Pipedrive native. **Not a full CLM** — no obligation tracking, no renewal mgmt, no contract analytics. | $35/user/mo Starter, $65/user/mo Business, median buyer $16K/yr [costbench.com] | Sales/procurement/HR — explicitly non-legal | Basic doc automation | Structurally can't do lifecycle work — a document/proposal tool wearing CLM branding |
| **ContractBook** | Full lifecycle claim (drafting → approvals → compliance → renewal), browser editor, e-sign | $599/mo Essential (1 user) to $599/mo Accelerate (10 users), hard caps; Slack/SSO/API/Salesforce are Accelerate-only add-ons [hyperstart.com] | SMB-to-mid-market | Limited | User/contract-volume caps at every tier feel like a trial product past ~10 users |
| **Juro** | AI-native contract workspace, unlimited users/templates on paid, "accessible to non-lawyers" | No published pricing; Vendr avg buyer $34,500/yr [single-source: vendr.com] | In-house legal + business users | AI-native drafting/redlining | Markets non-lawyer-friendly but 100% sales-led custom-quote — contradicts own positioning |
| **LinkSquares** | "All-agentic CLM" (LinkAI): agents draft/redline/research; Finalize/Analyze/Sign modules; 11 integrations | Median $31K/yr, $2.5-3.5K/user/yr, e-sign +$5-10K/yr, API +$10K/yr [hyperstart.com] | Mid-market to enterprise legal | Most aggressive agentic positioning | Legal-team-first; add-on pricing hits ops teams at enterprise rates once they need e-sign + API |
| **Spellbook** | Word add-in only — AI review/draft/redline. **No repository, no e-sign, no workflow.** | ~$20-40/user/mo entry, ~$350/user/mo enterprise, 6-mo commit [hyperstart.com] | In-house counsel drafting in Word | Clause-level AI review (2,300+ agreement corpus) | Not a CLM — pure drafting assistant |
| **Lexion** | CLM + AI assist, no-code workflows, DocuSign-native e-sign | Custom, no free tier; acquired by DocuSign May 2024 | Legal ops teams | AI assist search/extraction | Post-acquisition roadmap uncertainty; folding into DocuSign IAM |
| **Common Paper** | Free tier (2 agreements/mo), $50/user/mo Startup, $100/user/mo Growth, built-in e-sign, AI negotiation agent | $50-100/user/mo | Startup SaaS agreements (MSAs, DPAs) | AI negotiation agent | Narrow scope (standard SaaS templates) — not general-purpose CLM |

**Pattern across all nine:** every commercial competitor is either (a) not actually full-lifecycle (PandaDoc, Spellbook, Common Paper), (b) legal-team-first in UX and pricing (Ironclad, DocuSign, LinkSquares, Lexion), or (c) enterprise custom-quote sales-led (Juro, Ironclad, LinkSquares, Lexion). **None combine self-serve + full lifecycle + non-lawyer-operator design.** That gap is Aakd's wedge.

---

## Task 2 — Open-source / self-hostable CLM & adjacent tools (verified directly on GitHub)

| Project | Stars | License | Actually a CLM? |
|---|---|---|---|
| **OpenCLM** (openclm.ai) | N/A — **repo does not exist** | Claims AGPL-3.0 | **No — vaporware.** Marketing site claims a full AGPL product at github.com/nxglabs/openclm; that URL 404s. nxglabs' 22 public repos have no openclm repo. Do not treat as a real competitor. |
| **Wraft** | 153 (28 forks) | AGPL-3.0 | No — document authoring/generation + e-sign distribution (Elixir/React). No repository/renewal/approval/obligation tracking. |
| **Documenso** | 12.9K+ | MIT-style | No — pure e-signature (DocuSign alt), explicitly not a CLM. |
| **DocuSeal** | ~18K | AGPL-3.0 | No — e-signature + PDF forms only. (The e-sig tool Aakd already integrates against.) |
| **OpenSign** | 1,000+ | MIT | No — e-signature + template/audit trail only. |
| github.com/topics/contract-management & /contract-lifecycle | 0-2 stars each | Mixed | No — student/hobby projects, none production-viable. |

**Conclusion:** Aakd faces **zero real open-source overlap on the full-lifecycle claim.** Overlap exists only at the component level — DocuSeal/Documenso/OpenSign compete for the e-signature slice, which Aakd deliberately doesn't build in-house (integrates DocuSeal per CLAUDE.md's "never build signing from scratch").

### Adjacent / DIY tools people stretch to cover CLM (from deep comment-tree mining, 2026-07-17)

Full comment-tree mining of the r/selfhosted CLM-ask threads surfaced what people ACTUALLY recommend to each other when no real OSS CLM exists — none are CLMs, they're adjacent tools stretched to cover part of the job or small point tools:

| Tool | Category | Notes |
|---|---|---|
| **Odoo** (Estimates/Quotes module) | ERP | **Recommended 3× by 3 people across 2 threads — more organic recommendations than ANY real CLM competitor got anywhere in this research.** The de-facto "just use this" answer. |
| **ERPNext / Frappe** | ERP | Contract module exists; recommended as the OSS ERP route |
| **Dolibarr** | ERP/CRM | Recommended as lightweight OSS business suite |
| **Wallos** (verified real) | Subscription/renewal tracker | People use it for the renewal-reminder slice specifically |
| **Snipe-IT** | Asset management | Stretched for contract/asset tracking |
| **InvoiceNinja** | Invoicing | Adjacent billing tool |
| **DocuSeal** | E-signature | **Organically, unprompted-recommended for this use case — third-party validation of Aakd's own locked e-sig choice.** |
| PlainVanilla, Volody CLM (verified real); BoloSign, OpenSignLabs, easy-software.com (unverified/vendor mentions) | Point tools / proprietary | Small or proprietary, not OSS full-CLM |

**Two high-signal validations from that thread for Aakd's roadmap:**
- **M6 Authoring is solving a named, articulated gap.** A commenter recommended DocuSeal but then said it's not enough: *"you still need to make documents in Word... an all-in-one online editor would be awesome."* That's Aakd's Plate editor + Word import (M6) answering a real complaint, not a speculative feature.
- **3 independent "I built my own" declarations** across 2 threads (up from 1 in the first pass) — people who looked for an OSS CLM, found nothing, and built their own. Strongest unmet-demand signal in the dataset.

**Corrected volume read (honest):** demand is real but the "many comments" intensity applies to essentially ONE sustained thread (r/selfhosted 19392l3, ~15 comments over 14 months); every other CLM-ask thread stayed in the 1-6 comment range. Niche-but-real with one standout data point, not a broad groundswell. Full detail: `voice-of-customer-deep.md`.

---

## Task 3 — Gap map

| Capability | Aakd | Top 3 commercial (Ironclad/DocuSign/Juro) | Top 2 OSS (Wraft/DocuSeal) |
|---|---|---|---|
| Self-hosted / data sovereignty | Yes | No (SaaS-only) | Yes |
| Full lifecycle (repo+renewals+approvals+obligations) | Yes | Yes | No |
| AI contract Q&A w/ citations | Yes | Yes | No |
| **Self-hosted/local AI (Ollama)** | **Yes — rare** | No (cloud-only) | N/A |
| **MCP server for agent access** | **Yes — rare, none surfaced in any competitor** | No | No |
| **i18n incl. Arabic RTL** | **Yes — rare** | Partial (Agiloft via Google Translate) | No |
| Tracked changes / redlining | No (deferred v3) | Yes | No |
| Browser-native editor | Partial (Plate, M6) | Yes (Ironclad) | No |
| Clause/template library | Yes (M6) | Yes | No |
| CRM integration | Yes | Yes | No |
| Self-serve signup (no sales call) | Yes | **No — all custom-quote/sales-led** | Yes but no lifecycle |

**(a) Competitor features Aakd lacks & users ask for:** tracked-changes/redlining — the #1 gap cited across Ironclad/DocuSign/Spellbook marketing. Already deferred to v3; expect it as the top objection from prospects comparing to Ironclad/DocuSign.

**(b) Rare Aakd differentiators:** MCP server (zero competitors), self-hosted/local AI via Ollama (all commercial rivals cloud-AI-only), native Arabic RTL i18n. Lead positioning with these.

**(c) Pricing wedge:** cheapest credible commercial *full* CLM for a 20-person ops team ≈ **$12K-$16K/yr** once real add-ons (Slack, API, SSO) priced in (Gatekeeper ~$14,940/yr; PandaDoc Business $15,600/yr but not full CLM). Enterprise players (Ironclad, LinkSquares, Juro) start $30K-$80K+/yr. Aakd self-host = infra cost only; hosted SaaS positioned under the $12K floor.

---

## Sources (Phase-1 desk, July 2026)
costbench.com/software/contract-management/pandadoc · hyperstart.com/blog/{contractbook,linksquares,ironclad,spellbook}-pricing · juro.com/pricing · vendr.com · docusign.com/products/clm · lexion.ai · commonpaper.com/pricing · openclm.ai (repo 404) · github.com/{nxglabs, wraft/wraft, documenso/documenso, docusealco/docuseal, OpenSignLabs/OpenSign, topics/contract-management, topics/contract-lifecycle} · gatekeeperhq.com/pricing · agiloft.com
