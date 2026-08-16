# Aakd

Open-source contract management for teams that want to run their own stack.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](./docker-compose.yml)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://postgresql.org)

---

## What it does

1. **Upload** a PDF or DOCX contract (including scanned PDFs when OCR is enabled)
2. **Review** extracted fields with source text and page citations before writing them to the contract record
3. **Ask questions** in plain language when an AI provider is configured
4. **Track obligations and renewals** with owners, due dates, reminders, and completion status
5. **Collaborate** through approvals, comments, and optional DocuSeal signing
6. **Automate** through scoped API and MCP access, webhooks, and notifications

When self-hosted, your contracts stay on infrastructure you control. AI providers are optional: use Ollama locally or bring your own provider key.

### Phase 0 release scope

The supported first-run path is intentionally narrow: upload a real PDF or DOCX, review the extracted fields and citations, then create and complete obligations. Templates, contract authoring, autonomous agents, billing, and hosted service features remain hidden or paused until they have their own release evidence. The underlying code is retained for later phases, but it is not part of the Phase 0 promise.

---

## Quick start

```bash
# 1. Clone and configure
git clone https://github.com/aaked-app/aakd.git
cd aakd
cp .env.example .env       # fill in DATABASE_URL, BETTER_AUTH_SECRET, STORAGE_*, REDIS_URL

# 2. Start everything
docker compose up

# 3. Open the app
open http://localhost:3000
```

First signup creates your account and organization. The repository, uploads, manual metadata, approvals, obligations, and signing screens work without an AI key. Configure an AI provider in Settings only when you want extraction, Q&A, risk scoring, or AI-assisted obligation suggestions.

### Production deployment

For a public deployment on an Ubuntu VM, use the production installer. It creates strong secrets, validates the Compose configuration, builds the web app and worker, starts PostgreSQL, Redis, MinIO, DocuSeal, Caddy and backups, then waits for the health endpoint.

```bash
git clone https://github.com/aaked-app/aakd.git ~/aakd
cd ~/aakd
chmod +x scripts/*.sh
bash scripts/deploy.sh
```

Before running it, point your domain's DNS records to the server and allow inbound TCP ports 80 and 443 in the cloud firewall. The installer does not change host firewall rules by default. Set `CONFIGURE_FIREWALL=true` only when you want it to add those iptables rules. Email and AI are optional; configure them later in `.env.prod` if needed.

To update an existing installation:

```bash
cd ~/aakd
bash scripts/update.sh
```

To diagnose a running installation or export a backup:

```bash
bash scripts/doctor.sh
bash scripts/backup.sh
```

Restoring is deliberately guarded because it replaces the current database:

```bash
bash scripts/restore.sh backups/aakd-YYYYMMDD-HHMMSS.sql.gz --yes-really-restore
```

For the full production checklist, backups, TLS, storage, email and troubleshooting, see [the self-hosting guide](docs/self-hosting.md) and [the Oracle Cloud walkthrough](docs/deploy-oracle-cloud.md).

---

## Screenshots

**Dashboard** — renewal timeline, pending approvals, and recent contracts at a glance.

![Aakd dashboard](docs/screenshots/dashboard.png)

**Contract repository** — full-text search, status and risk filters, at-a-glance value and end dates.

![Aakd contracts list](docs/screenshots/contracts.png)

---

## Features

### Contract Management
| Feature | Status |
|---|---|
| PDF & DOCX upload (magic-byte validated, 50 MB max) | ✅ |
| OCR for scanned / image-only PDFs | ✅ |
| AI metadata extraction (parties, dates, value, governing law, auto-renewal) | ✅ optional |
| Soft-delete with full audit trail | ✅ |
| Folders, tags, full-text + semantic search | ✅ |
| Contract versions & document snapshots | ✅ |

### AI Layer
| Feature | Status |
|---|---|
| Contract Q&A with exact citations | ✅ optional |
| AI risk scoring — LOW / MEDIUM / HIGH + 6-category breakdown | ✅ optional |
| Obligation suggestions (review required before creation) | ✅ optional |
| BYOK — bring your own Anthropic or OpenAI key | ✅ |
| Ollama support for fully local AI | ✅ |

### Workflow & Signing
| Feature | Status |
|---|---|
| Approval workflows with role-based routing | ✅ |
| E-signatures via DocuSeal (self-hostable) | ✅ |
| Track changes / redlining with version comparison | ✅ |
| Snapshot comparison with word-level diff | ✅ |
| Track changes sidebar with author context | ✅ |

### Authoring
| Feature | Status |
|---|---|
| Rich document editor (TipTap) with track changes | Paused after Phase 0 |
| Template studio with variable fill wizard | Paused after Phase 0 |
| Built-in clause snippet library (13 standard legal clauses) | ✅ |
| Word import + DOCX/PDF export | ✅ |
| Contract snapshots & version history | ✅ |
| AI Companion tab — contract Q&A inline in editor | Paused after Phase 0 |

### Renewals & Obligations
| Feature | Status |
|---|---|
| Auto-renewal risk dashboard (sorted by notice deadline) | ✅ |
| Obligation tracker with sub-tasks | ✅ |
| Daily overdue obligation cron | ✅ |
| Renewal alert emails | ✅ |

### Integrations & Ecosystem
| Feature | Status |
|---|---|
| Slack & Microsoft Teams notifications | ✅ |
| Outgoing webhooks (Zapier / Make compatible) | ✅ |
| MCP server endpoint (Claude, Cursor, any MCP client) | ✅ |
| REST API with API key auth | ✅ |
| CRM sync — HubSpot, Salesforce, Pipedrive | ✅ |
| Bulk import — CSV, PandaDoc, DocuSign CLM, Google Drive | ✅ |

### Internationalization
English · Français · Deutsch · Español · العربية (RTL)

---

## Why Aakd?

| | Aakd | Ironclad | DocuSign CLM | Signit |
|---|---|---|---|---|
| Open source | ✅ | ❌ | ❌ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ | ❌ |
| BYOK AI (no per-use fee) | ✅ | ❌ | ❌ | ❌ |
| Arabic RTL | ✅ | ❌ | ❌ | ✅ |
| MCP server | ✅ | ❌ | ❌ | ❌ |
| Software model | Free self-hosted software | Paid SaaS | Paid SaaS | Commercial |

This project is open source and self-hostable. It is not currently a hosted service and does not claim formal compliance certifications or enterprise identity features.

---

## Stack

- **Frontend:** Next.js 14 App Router · TypeScript · Tailwind CSS · TipTap editor
- **Backend:** Next.js API routes · Prisma ORM · PostgreSQL 16 + pgvector
- **Auth:** Better Auth (email/password + org management)
- **Jobs:** BullMQ + Redis
- **Storage:** S3-compatible (MinIO for self-hosted, AWS S3 for cloud)
- **AI:** Anthropic Claude · OpenAI · Ollama (local)
- **E-signature:** DocuSeal
- **Observability:** OpenTelemetry (opt-in OTLP traces, Jaeger-ready)

---

## Self-hosting

The default compose stack runs the web app, BullMQ worker, PostgreSQL, Redis, and MinIO. You need a database URL, Better Auth secret, Redis URL, and S3-compatible storage credentials. AI credentials are optional for local/manual workflows and required only for AI-assisted features.

See [docker-compose.yml](./docker-compose.yml) for local development and [docker-compose.prod.yml](./docker-compose.prod.yml) for production deployment. The development Compose file includes Mailpit and default MinIO credentials and must not be exposed to the internet.

Minimum environment variables:
```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<random 32+ char string>
BETTER_AUTH_URL=http://localhost:3000
STORAGE_BUCKET=aakd
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_ENDPOINT=http://minio:9000   # leave empty for AWS S3
REDIS_URL=redis://redis:6379
```

Optional (AI features degrade gracefully without these):
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## Development

```bash
pnpm install
pnpm dev            # Next.js on :3000
pnpm worker:dev     # BullMQ worker (watch mode)
pnpm db:migrate     # run Prisma migrations
pnpm db:studio      # Prisma Studio on :5555
pnpm test           # unit + integration tests
pnpm typecheck      # TypeScript across all packages
```

---

## License

AGPL-3.0 — free for self-hosted use. Commercial licenses available for white-labeling and SaaS redistribution.

---

## Contributing

PRs welcome. Read [CLAUDE.md](./CLAUDE.md) for the architecture decisions and coding conventions before contributing.
