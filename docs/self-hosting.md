# Self-Hosting ClauseFlow

ClauseFlow is fully self-hostable. This guide covers deploying the complete stack on your own infrastructure using Docker Compose.

---

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2 (`docker compose` — not `docker-compose`)
- **2 GB RAM** minimum (4 GB recommended for AI extraction)
- A domain name and TLS termination if exposing publicly (see [Production Hardening](#production-hardening))

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/clauseflow.git
cd clauseflow
```

### 2. Configure environment variables

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
```

Minimum required values:

```bash
# Generate a strong password for Postgres
POSTGRES_PASSWORD=$(openssl rand -base64 24)

# Generate the auth secret
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

Edit `.env` and set at minimum:

```
POSTGRES_PASSWORD=<generated above>
BETTER_AUTH_SECRET=<generated above>
BETTER_AUTH_URL=https://your-domain.com   # or http://localhost:3000 for local
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Start the stack

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** with the `pgvector` extension (required for semantic search)
- **Redis 7** for BullMQ job queues
- **MinIO** for S3-compatible file storage (contracts, uploaded files)
- **ClauseFlow app** — Next.js 14 web application on port 3000
- **ClauseFlow worker** — BullMQ background worker (text extraction, AI, alerts, email)

### 4. Run database migrations

On first boot the app container runs migrations automatically. To run them manually:

```bash
docker compose exec app npx prisma migrate deploy
```

### 5. Open the app

Navigate to `http://localhost:3000` (or your configured URL). Create your first account — the first registered user becomes the org admin.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Set automatically by Docker Compose. |
| `POSTGRES_PASSWORD` | Postgres password. Generate: `openssl rand -base64 24` |
| `BETTER_AUTH_SECRET` | Auth signing secret. Generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Full URL of your ClauseFlow instance (e.g. `https://clm.yourcompany.com`) |
| `NEXT_PUBLIC_APP_URL` | Same as `BETTER_AUTH_URL` — used for client-side links |
| `REDIS_URL` | Redis connection string. Set automatically by Docker Compose. |

### Storage (S3-compatible)

| Variable | Description | Default |
|---|---|---|
| `STORAGE_ENDPOINT` | S3 endpoint URL. Leave empty for AWS S3. Set to MinIO URL for self-hosting. | `http://minio:9000` (in Docker Compose) |
| `STORAGE_BUCKET` | S3 bucket name | `clauseflow` |
| `STORAGE_ACCESS_KEY` | S3 access key | `minioadmin` (change in production) |
| `STORAGE_SECRET_KEY` | S3 secret key | `minioadmin` (change in production) |
| `STORAGE_REGION` | S3 region | `us-east-1` |

For **AWS S3**: set `STORAGE_ENDPOINT=` (empty), and set your real `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, and `STORAGE_REGION`.

For **MinIO** (self-hosted): set `STORAGE_ENDPOINT=http://minio:9000` and choose your own credentials.

### AI Providers (optional — features degrade gracefully without)

ClauseFlow supports three AI backends. Set `AI_PROVIDER` to select one, or leave it empty to auto-detect from which key is present.

| Variable | Description |
|---|---|
| `AI_PROVIDER` | `anthropic` \| `openai` \| `ollama` — or leave empty to auto-detect |
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude models) |
| `ANTHROPIC_MODEL` | Model name. Default: `claude-haiku-4-5` |
| `OPENAI_API_KEY` | OpenAI API key (for GPT models + embeddings) |
| `OPENAI_MODEL` | Model name. Default: `gpt-4o-mini` |
| `OLLAMA_BASE_URL` | Ollama server URL. Default: `http://localhost:11434` |
| `OLLAMA_MODEL` | Model name. Default: `llama3` |
| `OLLAMA_EMBEDDING_MODEL` | **Must produce 1536-dim vectors.** Default: `mxbai-embed-large`. Do NOT use `nomic-embed-text` (768-dim — will fail). |

> **BYOK (Bring Your Own Key):** ClauseFlow never stores your AI API keys beyond your own `.env` file. You control costs entirely. AI features (extraction, Q&A, semantic search) work out of the box once a key is configured. The app runs without any AI key — AI features are gracefully disabled.

### Email / SMTP (optional)

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname. Leave empty to disable email. |
| `SMTP_PORT` | SMTP port. Default: `587` (STARTTLS). Use `465` for TLS. |
| `SMTP_SECURE` | `true` for TLS (port 465), `false` for STARTTLS (port 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address (e.g. `noreply@yourcompany.com`) |
| `ALERT_EMAIL_TO` | Comma-separated list of recipients for renewal alert emails |

Works with any SMTP provider: Gmail, SendGrid, Postmark, AWS SES, Mailgun, etc.

### E-Signature (DocuSeal)

| Variable | Description |
|---|---|
| `DOCUSEAL_API_URL` | DocuSeal API base URL. Default: `https://api.docuseal.com` (cloud). Set to your self-hosted instance URL. |
| `DOCUSEAL_API_KEY` | DocuSeal API key |
| `DOCUSEAL_WEBHOOK_SECRET` | HMAC-SHA256 secret for validating incoming DocuSeal webhooks. **Required in production.** |

### Notifications (Slack / Teams)

| Variable | Description |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL for renewal alerts. Create at [api.slack.com/messaging/webhooks](https://api.slack.com/messaging/webhooks) |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams incoming webhook URL. Create via Teams channel → Connectors → Incoming Webhook |

### Security

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | Key for encrypting API keys stored in the database |
| `REDIS_PASSWORD` | Optional Redis password. When set, Redis starts with `--requirepass`. Update `REDIS_URL` to `redis://:${REDIS_PASSWORD}@redis:6379`. |

---

## Using AWS S3 Instead of MinIO

To use AWS S3 for file storage instead of the bundled MinIO container:

1. Create an S3 bucket in your AWS account
2. Create an IAM user with `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on that bucket
3. In `.env`:
   ```
   STORAGE_ENDPOINT=
   STORAGE_BUCKET=your-bucket-name
   STORAGE_ACCESS_KEY=your-iam-access-key
   STORAGE_SECRET_KEY=your-iam-secret-key
   STORAGE_REGION=us-east-1
   ```
4. Remove the `minio` and `createbuckets` services from `docker-compose.yml`, or use a Docker Compose override.

---

## Using Ollama (Local AI — No API Key Required)

To run AI features entirely on your own hardware with no external API calls:

1. Install and start [Ollama](https://ollama.com)
2. Pull a 1536-dim embedding model:
   ```bash
   ollama pull mxbai-embed-large
   ```
3. Pull a text generation model:
   ```bash
   ollama pull llama3
   ```
4. In `.env`:
   ```
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://host.docker.internal:11434  # or your Ollama server URL
   OLLAMA_MODEL=llama3
   OLLAMA_EMBEDDING_MODEL=mxbai-embed-large
   ```

> **Important:** The embedding dimension is fixed at **1536**. Do NOT use `nomic-embed-text` (768-dim) — it will cause silent failures on semantic search. Use `mxbai-embed-large` or another 1536-dim model.

---

## Updating ClauseFlow

To update to a new version:

```bash
# Pull the latest code
git pull origin main

# Rebuild and restart containers
docker compose pull
docker compose up -d --build

# Run any new migrations
docker compose exec app npx prisma migrate deploy
```

---

## Development Setup

For local development with hot reload:

```bash
# Install dependencies
pnpm install

# Start the database and Redis (only)
docker compose -f docker-compose.dev.yml up -d db redis minio createbuckets

# Copy and configure env
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, BETTER_AUTH_SECRET, STORAGE_ENDPOINT=http://localhost:9000

# Run migrations
pnpm db:migrate

# Start the web app (hot reload)
pnpm dev

# In a second terminal — start the BullMQ worker (hot reload)
pnpm worker:dev
```

---

## Production Hardening

### Reverse proxy and TLS

Run ClauseFlow behind a reverse proxy (nginx, Caddy, Traefik) with TLS. The app listens on port 3000.

Example Caddy config:
```
clm.yourcompany.com {
  reverse_proxy localhost:3000
}
```

### Secrets management

Never commit `.env` to version control. For production:
- Use Docker secrets, Vault, AWS SSM Parameter Store, or your infrastructure's secret manager
- All required secrets will fail fast at container boot if unset (enforced via `${VAR:?message}` in `docker-compose.yml`)

### MinIO security

Change the default MinIO credentials in production:
```
STORAGE_ACCESS_KEY=your-strong-access-key
STORAGE_SECRET_KEY=your-strong-secret-key
```

Do not expose MinIO ports (9000, 9001) publicly. Only the ClauseFlow app and worker containers need access.

### Redis security

Set `REDIS_PASSWORD` in `.env` for production deployments. Do not expose Redis port 6379 publicly.

### DocuSeal webhook secret

Always set `DOCUSEAL_WEBHOOK_SECRET` in production. Without it, the webhook handler accepts all incoming requests.

---

## Troubleshooting

### App container fails to start

Check the logs:
```bash
docker compose logs app
```

Common causes:
- Missing `POSTGRES_PASSWORD` or `BETTER_AUTH_SECRET` → set them in `.env`
- Postgres not ready yet → wait a few seconds and retry; the app has a health-check dependency
- Migration failed → run `docker compose exec app npx prisma migrate deploy` manually

### Worker not processing jobs

```bash
docker compose logs worker
```

Common causes:
- `REDIS_URL` not reachable → check Redis is running (`docker compose ps redis`)
- Missing AI API key → set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OLLAMA_BASE_URL`

### Semantic search returns no results

The `pgvector` extension must be enabled. This is handled automatically by the `pgvector/pgvector:pg16` Docker image. If using an external Postgres instance, enable it manually:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Also ensure the embedding model produces **1536-dim** vectors. Any other dimension will cause errors.

### File uploads fail

Check that MinIO (or your S3 bucket) is reachable and the bucket exists. The `createbuckets` service creates the default `clauseflow` bucket on first boot.

### Emails not sending

Verify your SMTP credentials and that `SMTP_HOST` is set. Check the worker logs for `[email]` prefixed errors.
