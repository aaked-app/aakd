# Self-Hosting Aakd

Aakd is self-hostable. This guide covers deploying the complete stack on your own infrastructure using Docker Compose.

---

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2 (`docker compose` — not `docker-compose`)
- **2 GB RAM** minimum (4 GB recommended for AI extraction)
- A domain name and TLS termination if exposing publicly (see [Production Hardening](#production-hardening))

---

## Quick Start

Before starting a deployment, you can validate both Compose files and the required secret interpolation without changing your local environment:

```bash
bash scripts/validate-self-hosting.sh
```

This checks configuration only. It does not start or modify containers.

For the complete local Phase 0 engineering verification, including the
application tests and production build, run from the repository root:

```bash
bash scripts/verify-phase-0.sh
```

The verifier checks the source tree, tests, isolation suite and production
build. It does not replace deployment acceptance on a clean host or customer
validation; record those separately in your release process.

### 1. Clone the repository

```bash
git clone https://github.com/aaked-app/aakd.git ~/aakd
cd ~/aakd
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
- **Aakd app** — Next.js 16 web application on port 3000
- **Aakd worker** — BullMQ background worker (text extraction, AI, alerts, email)

DocuSeal is not started by default. Connect DocuSeal Cloud or another DocuSeal
server from Settings → Integrations → E-signature. The bundled server remains
available for local testing with `docker compose --profile signing up`.

The default stack needs neither `DOCUSEAL_IMAGE` nor `DOCUSEAL_SECRET_KEY_BASE`.
If you explicitly enable the bundled signing profile, first generate its secret
with `openssl rand -hex 64` and set the resulting 128 hexadecimal characters as
`DOCUSEAL_SECRET_KEY_BASE`. A network-isolated prerequisite rejects empty,
whitespace, short or non-hexadecimal values. The production profile defaults to
the reviewed pinned image digest; changing it still requires a reviewed digest.
Do not rotate an existing server's secret automatically during an upgrade.

### 4. Run database migrations

On first boot the app container runs migrations automatically. To run them manually:

```bash
docker compose exec app npx prisma migrate deploy
```

### 5. Open the app

Navigate to `http://localhost:3000` (or your configured URL). Create your first account — the first registered user becomes the org admin.

## Production install in one command

For a public Ubuntu VM, use the checked-in installer. It generates the required secrets, validates the production Compose file, builds the app and worker, starts the complete stack, and waits for `/api/health` before reporting success. It requires a reviewed, exact 40-character Git commit SHA so that it never deploys a floating branch.

```bash
cd ~/aakd
chmod +x scripts/*.sh
AAKD_REF=<reviewed-40-character-commit-sha> bash scripts/deploy.sh
```

Before running it:

1. Point your domain's DNS record to the VM.
2. Allow inbound TCP ports 80 and 443 in the cloud firewall/security list.
3. Leave `CONFIGURE_FIREWALL=false` unless you explicitly want the installer to modify host iptables rules.

The installer can run without AI, email, or DocuSeal API credentials. Add those values to `.env.prod` and restart the relevant services when you need those features. Keep `.env.prod` private and backed up separately from the repository.

To update an existing deployment, use a new reviewed commit SHA:

```bash
AAKD_REF=<reviewed-40-character-commit-sha> bash scripts/update.sh
```

To check service health and create a downloadable database backup:

```bash
bash scripts/doctor.sh
bash scripts/backup.sh
```

The bundled scheduled backup retains PostgreSQL dumps on the same host for
seven days. It does not cover MinIO contract files, DocuSeal data, or
`.env.prod`; configure encrypted off-host copies and complete a restore drill
before describing recovery as verified.

Restore requires both an explicit flag and typing `RESTORE` because it replaces the current database schema:

```bash
bash scripts/restore.sh backups/aakd-YYYYMMDD-HHMMSS.sql.gz --yes-really-restore
```

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Set automatically by Docker Compose. |
| `POSTGRES_PASSWORD` | Postgres password. Generate: `openssl rand -base64 24` |
| `BETTER_AUTH_SECRET` | Auth signing secret. Generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Full URL of your Aakd instance (e.g. `https://clm.yourcompany.com`) |
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
| `DOCUMENT_EXPORT_RETENTION_SECONDS` | Download lifetime for generated DOCX/PDF exports | `86400` (24 hours) |

For **AWS S3**: set `STORAGE_ENDPOINT=` (empty), and set your real `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, and `STORAGE_REGION`.

For **MinIO** (self-hosted): set `STORAGE_ENDPOINT=http://minio:9000` and choose your own credentials.

Extraction previews use disposable objects under the `previews/` prefix. The
worker deletes them on success, failure, or expiry. As a defense against a
simultaneous worker/Redis outage, configure an object-lifecycle rule that
expires the `previews/` prefix after one day; these objects are never contract
records and are no longer usable after the five-minute preview window.

Generated document exports use the separate `exports/` prefix. They become
unavailable after `DOCUMENT_EXPORT_RETENTION_SECONDS`; the worker checks for
expired exports every five minutes and deletes at most 100 records per sweep.
Physical deletion can therefore lag the configured expiry, and it can lag
longer while the worker or object store is unavailable. Failed deletions remain
recorded and are retried. Export cleanup never deletes an original contract
file. Keep the worker running and add an object-store lifecycle backstop for the
`exports/` prefix if your retention policy requires one.

### Phase 1 engineering preview

The Action Ledger and Team Brief UI is an opt-in engineering preview while the
Phase 1 customer, safety, repeat-use and funding gates remain open. Enabling the
UI does not mean those product gates have passed and does not change its
authorization or review requirements.

`NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED` defaults to `false`. Because this is a
Next.js public build-time setting, changing it on a running container is not
enough. Set the following value in `.env.prod`:

```dotenv
NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=true
```

Then rebuild and replace the app container:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app
```

Set the value back to `false` and repeat both commands to hide the preview UI.
The APIs and their authorization boundaries remain active in either state.

### Scanned-PDF OCR

When a PDF has little or no extractable text, the worker attempts local OCR.
The worker image includes the English recognition model and checks its
integrity. OCR does not require an AI-provider key or download a model at
runtime. Optional AI processing after text extraction is separate and follows
the organization's selected provider configuration.

OCR currently supports English only. The five interface languages do not
imply five OCR languages. Original files remain unchanged, and OCR retains
page boundaries for source citations. Review the recognized text, especially
dates, amounts and names, before accepting extracted facts.

The OCR path has operational limits: 50 MiB input, 50 pages, 120 seconds total,
20 seconds per native conversion command, and a 2,000-pixel raster long edge.
Rendered pages are capped at 20 MiB each and 128 MiB combined, and recognized
text at 2 MiB total.
Exceeding a limit fails the OCR attempt rather than accepting partial OCR.
These limits bound resource use; they are not an accuracy or processing-time
guarantee. Use a clearer or smaller document when recognition fails. Native
text-PDF extraction is a separate path and is not subject to the OCR page cap.

OCR removes its private temporary files after normal processing or failure.
If removal fails, the attempt fails closed and the worker logs
`cleanup_failed`; an operator must investigate the worker's temporary storage.
A process crash or power loss can interrupt cleanup. Do not treat these
controls as a guarantee that interrupted processes leave no temporary files.

### AI Providers (optional — features degrade gracefully without)

Aakd supports three AI backends. Set `AI_PROVIDER` to select one, or leave it empty to auto-detect from which key is present.

| Variable | Description |
|---|---|
| `AI_PROVIDER` | `anthropic` \| `openai` \| `ollama` — or leave empty to auto-detect |
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude models) |
| `ANTHROPIC_MODEL` | Model name. Default: `claude-haiku-4-5` |
| `OPENAI_API_KEY` | OpenAI API key (for GPT models + embeddings) |
| `OPENAI_MODEL` | Model name. Default: `gpt-4o-mini` |
| `OLLAMA_BASE_URL` | Ollama server URL. Default: `http://localhost:11434` |
| `OLLAMA_MODEL` | Model name. Default: `llama3` |
| `OLLAMA_PRIVATE_ORIGINS` | Comma-separated exact private origins organizations may use, each including scheme, host and port. Empty by default. |
| `OLLAMA_EMBEDDING_MODEL` | Optional. Must support `/api/embed` with exactly 1536 output dimensions. Empty by default: keyword search and lexical Q&A retrieval remain available. |

> **BYOK (Bring Your Own Key):** Operator credentials may be configured through environment variables. Organization credentials entered in Settings are encrypted in your database using the configured encryption key; keep that encryption key available for recovery and separate from public source control. Provider requests incur costs on the configured provider account. Aakd can run without a provider key: supported local extraction and keyword-search fallbacks are labeled, while features that require a model report that configuration is needed. Model availability, permissions and provider limits still determine whether a configured AI feature can run.

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

New in-app signature sends, reminders, and resets are temporarily paused.
Existing signing records remain readable. Automatic signed-document intake
requires an exact provider binding and an agreement still awaiting signature;
late provider events cannot reactivate an archived or terminated agreement.

The recommended setup is per-organization configuration from Settings →
Integrations → E-signature. Each organization can connect DocuSeal Cloud or a
self-hosted DocuSeal URL; API keys and webhook secrets are encrypted at rest.
The environment variables below remain as a backwards-compatible fallback for
single-tenant deployments and older installations.

For an organization integration, configure the webhook URL returned by Settings
(including its `integrationId`) and the matching webhook secret. Changing an
integration's API base URL, including its path, is rejected while historical
submissions reference it. Credential rotation on the same API base remains
available.

The signing-boundary migration deliberately leaves all historical submissions
unbound. A current integration setting is not evidence of where an older
submission originated. These records remain readable, but automatic intake
fails closed until an operator verifies their exact provider origin and performs
an audited reconciliation. Do not bulk-bind them to the current integration.
There is no automatic reconciliation command in this release.

The migration uses a single transaction, with a five-second lock timeout and
30-second statement timeout. Regular index creation briefly requires table
locks. Schedule it during a maintenance window, back up first, and stop writes.
A database error rolls back the schema changes; inspect the failed migration
and database state before following Prisma's failed-migration resolution process.

| Variable | Description |
|---|---|
| `DOCUSEAL_API_URL` | DocuSeal API base URL. Default: `https://api.docuseal.com` (cloud). Set to your self-hosted instance URL. |
| `DOCUSEAL_API_KEY` | DocuSeal API key |
| `DOCUSEAL_PRIVATE_ORIGINS` | Exact private origins that organizations may connect, comma-separated and including scheme, host, and explicit port. Empty by default. |
| `DOCUSEAL_WEBHOOK_SECRET` | HMAC-SHA256 secret for validating incoming DocuSeal webhooks. **Required in production.** |

Organization-entered DocuSeal endpoints are connection-bound to their vetted
DNS address and may reach public addresses by default. A self-hosting operator
can permit an internal DocuSeal service with an exact origin such as:

```dotenv
DOCUSEAL_PRIVATE_ORIGINS=http://docuseal.internal:3000
```

The allowlist does not accept paths, credentials, wildcard hosts, implicit
ports, loopback, link-local, or cloud-metadata addresses. The same value must
be available to both the app and worker. The legacy `DOCUSEAL_API_URL` path is
operator-controlled and remains available for single-tenant deployments.

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
2. Pull a text generation model:
   ```bash
   ollama pull llama3
   ```
3. In `.env`:
   ```
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://host.docker.internal:11434  # or your Ollama server URL
   OLLAMA_MODEL=llama3
   OLLAMA_EMBEDDING_MODEL=
   ```

`OLLAMA_BASE_URL` is trusted operator configuration and may point at the
operator's local Ollama service. URLs entered by organization administrators
are untrusted, so private network destinations are denied by default. To let
an organization use a specific private Ollama server, approve only its exact
origin, including scheme and port:

```dotenv
OLLAMA_PRIVATE_ORIGINS=http://ollama.internal:11434
```

Separate multiple approved origins with commas. Entries must not contain a
path, query string, fragment or credentials. One malformed or unsafe entry
invalidates the full allowlist. Loopback, link-local and cloud metadata
destinations cannot be enabled through this organization allowlist. Configure
a server-local endpoint through `OLLAMA_BASE_URL` instead.

Embeddings are optional. Without a compatible embedding model, search reports
keyword matches and contract Q&A retrieves excerpts locally before calling your
selected chat model. Aakd does not substitute an operator OpenAI key for an
organization that selected Ollama or Anthropic.

For meaning search, install a model that supports `/api/embed` with exactly
1536 output dimensions, then set `OLLAMA_EMBEDDING_MODEL` to that model's name.
This model setting applies to all Ollama organizations; their selected server
URLs remain separate. Incompatible responses fail safely without padding or
truncating vectors. The former recommendation of `mxbai-embed-large` was wrong:
it produces 1024-dimensional vectors. [Ollama model metadata](https://ollama.com/library/mxbai-embed-large/blobs/819c2adf5ce6).

Changing the provider, embedding model, or Ollama server makes old vectors
ineligible for retrieval. Keyword search remains available until indexing is
rebuilt with the current configuration. New uploads use the selected provider.

To rebuild one existing contract, first run the operator command without
`--execute`. The actor must still be the exact organization member holding a
current access grant for that contract:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec worker \
  node_modules/.bin/tsx scripts/reindex-contract.ts \
  --organization-id <organization-id> \
  --contract-id <contract-id> \
  --actor-user-id <user-id> \
  --actor-member-id <member-id>
```

The dry run reports eligibility, text length, and the stored vector identity;
it does not print contract text, credentials, or call an AI provider. Review
that result, make sure the standalone worker is running, then repeat the exact
command with `--execute`. The worker rechecks the same live membership, access
grant, organization, contract, and unchanged extracted text before every
provider request. It replaces vectors atomically and never regenerates AI
metadata or reviewed contract facts. There is deliberately no all-organization
mode, and duplicate in-flight requests for the same contract text coalesce into
one job. Wait for that job to finish before repeating the reviewed command for
another contract.

For a non-container development checkout, the equivalent entry point is
`pnpm --filter web semantic:reindex --` followed by the same identifiers.

---

## Updating Aakd

To update to a new version:

```bash
# Run one reviewed release commit. Automatic updates refuse migrations until a
# pre-update recovery point and restore procedure have been verified.
AAKD_REF=<reviewed-40-character-commit-sha> bash scripts/update.sh
```

---

## Development Setup

For local development with hot reload, use Node.js 24 LTS and the pnpm
version pinned in `package.json`. Docker deployments include the supported
Node runtime and do not require a host Node installation.

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

Run Aakd behind a reverse proxy (nginx, Caddy, Traefik) with TLS. The app listens on port 3000.

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

Do not expose MinIO ports (9000, 9001) publicly. Only the Aakd app and worker containers need access.

### Redis security

Set `REDIS_PASSWORD` in `.env` for production deployments. Do not expose Redis port 6379 publicly.

### DocuSeal webhook secret

Organization webhooks require the secret saved with that exact integration.
Legacy environment-configured webhooks require `DOCUSEAL_WEBHOOK_SECRET`.
Without the matching secret, the webhook handler rejects the request. A valid
webhook alone does not establish a historical submission's provider binding.

### OpenTelemetry

The production Compose stack does not include an OpenTelemetry collector. Keep
`OTEL_ENABLED=false` unless you provide an OTLP endpoint reachable from both
the app and worker containers. The default service names are `clauseflow-app`
and `clauseflow-worker`.

### Agreement-access migration runbook

If an authorization incident is suspected, set
`AGREEMENT_ACCESS_EMERGENCY_DENY_ALL=true` on both the web and worker services
and restart them. This blocks agreement reads and agreement-related delivery
without blocking authentication or organization settings. Only the exact value
`false` (or an unset/empty value) enables normal agreement access; any other
non-empty value fails closed. Restore `false` only after the incident is resolved.

The agreement-access migration is additive, but its owner-grant and Team Brief
bindings are data-specific. Do not deploy it as an unattended startup migration.
An operator must review the exact mapping for the target database.

Prerequisites:

- take and verify a restorable database backup;
- schedule a maintenance window for the reviewed backfill;
- identify the real operator user ID and a change-ticket or incident request ID;
- keep the generated report in an access-controlled location because it contains
  contract, organization, user and membership identifiers.

Run the read-only preflight before changing the schema:

```bash
pnpm --filter web db:preflight:agreement-access > /secure/operator/path/agreement-access-preflight.json
```

The command exits with code `2` if an owner has no exact current membership or
has multiple matches. Resolve those rows explicitly. Do not infer an owner from
role, membership age or organization administration rights.

After the pre-schema report is clean, apply the schema migration during the
deployment window. Constraint work uses a five-second PostgreSQL lock timeout;
a timeout aborts the migration and requires operator recovery through Prisma's
failed-migration procedure before retrying.

```bash
pnpm --filter web db:migrate:prod
```

Keep writes stopped and generate the final post-schema report. This report has a
different digest from the pre-schema report because it includes the installed
grant table and Brief binding column.

```bash
pnpm --filter web db:preflight:agreement-access > /secure/operator/path/agreement-access-post-schema.json
```

Review every mapping and record the report's `mappingSha256`. Apply only that
reviewed report:

The actor must be a current owner or administrator in every organization whose
grants or Brief bindings this report changes. A globally existing user is not
sufficient. If no single authorized operator spans those organizations, stop
and arrange an authorized migration rather than attributing grants to an
unrelated account.

```bash
pnpm --filter web db:backfill:agreement-access -- \
  --mapping /secure/operator/path/agreement-access-post-schema.json \
  --approved-sha256 <reviewed-mapping-sha256> \
  --actor-user-id <operator-user-id> \
  --request-id <change-ticket-or-incident-id>
```

The backfill takes table locks and is therefore a maintenance-window operation.
It waits at most five seconds to acquire a lock, re-creates the live mapping
inside the same serializable transaction, and aborts if the signed mapping is
stale. A successful run inserts only owner grants, removes invalid Brief
bindings, and writes one attributed `ACCESS_GRANTED` activity per inserted grant.
It never grants a new Brief audience from a matching user ID: an unbound legacy
Brief is indistinguishable from a revoked membership, including a user who later
rejoined the organization. Review the report's exact unbound/missing/invalid
Brief IDs and counts. An authorized publisher must review and republish these
Briefs to a current named recipient through the app; do not manually restore
their old recipient binding. Valid, already-bound exact memberships are retained.

Import error reports are downloaded through an access-checked, non-cacheable
application endpoint. Storage URLs issued by an older deployment may remain
usable until their original one-hour expiry; deploying the new endpoint cannot
recall bytes or bearer URLs already issued. Include that expiry window in the
containment plan before treating an upgrade as fully revocation-safe.

Before restoring traffic, rerun the preflight and the agreement isolation suite.
The new report must show zero owner grants to insert and zero Brief bindings to
change.

Application rollback must retain the additive schema and grant enforcement.
Never roll back to a build that restores organization-wide contract access, and
do not drop grants, Brief bindings or their audit records. If enforcement is in
doubt, deny agreement reads and egress while rolling forward a correction.

### Interrupted contract-intake migration

This procedure applies only to `20260909200000_contract_intake_replay`.
Its column addition and concurrent index build commit separately. If the index
build is interrupted, the three columns may exist while Prisma still records a
failed migration. Re-running the original SQL then fails on the existing columns.
Do not edit an applied migration, drop contract columns, or mark it applied merely
to make deployment continue.

Before repair, stop application and worker writes, verify a restorable backup,
and confirm the exact target database and migration checksum against the release
being installed. Keep diagnostic output private. In an authenticated PostgreSQL
operator session, inspect the migration and schema:

```sql
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20260909200000_contract_intake_replay';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Contract'
  AND column_name IN ('intakeRequestId', 'intakeRequestHash', 'intakeRequestedByMemberId')
ORDER BY column_name;

SELECT indisvalid, indisready, indisunique, pg_get_indexdef(indexrelid)
FROM pg_index
WHERE indexrelid = to_regclass('public."Contract_organizationId_intakeRequestId_key"');

SELECT count(*) AS duplicate_groups
FROM (
  SELECT "organizationId", "intakeRequestId"
  FROM "Contract"
  WHERE "intakeRequestId" IS NOT NULL
  GROUP BY "organizationId", "intakeRequestId"
  HAVING count(*) > 1
) AS duplicates;
```

Choose the case established by those results:

1. **No columns and no index:** if the failed migration made no schema changes,
   resolve it as rolled back, then rerun deployment. Verify this case first.
2. **All three nullable `text` columns exist:** preserve them. If the index is
   absent, run only the original migration's `CREATE UNIQUE INDEX CONCURRENTLY`
   statement. If an index with the exact expected definition exists but is
   invalid, an operator may drop that specific invalid index concurrently and
   recreate it from the original statement. Run concurrent index operations
   outside a transaction. Do not drop a valid index.
3. **Duplicate identities, mismatched definitions, partial columns, or an unknown
   checksum:** stop and investigate. Do not delete contracts or automatically
   clear replay identities to bypass uniqueness.

For case 1 only, from the repository root with the intended database configured:

```bash
pnpm --filter web exec prisma migrate resolve --rolled-back 20260909200000_contract_intake_replay
pnpm --filter web db:migrate:prod
```

For case 2, first repeat the checks: all three columns must match, duplicate
groups must be zero, and the unique index must be valid and ready on exactly
`("organizationId", "intakeRequestId")`. Only then record the completed migration:

```bash
pnpm --filter web exec prisma migrate resolve --applied 20260909200000_contract_intake_replay
pnpm --filter web db:migrate:prod
pnpm --filter web exec prisma migrate status
```

Before restoring traffic, verify that no unfinished migration remains and test
contract creation plus retry recovery against the repaired deployment. Roll
forward with the additive schema retained. The opt-in local
`tests/e2e/intake-migration-recovery-probe.mts` verifies PostgreSQL recovery after
the column commit and after an invalid concurrent index, preserving fixture
rows. It does not substitute for reviewing Prisma history on the target system.

### Generated-export migration recovery

Migration `20260910020000_document_export_artifacts` is one explicit database
transaction. A lock timeout should leave no export enums, tables, or indexes,
but Prisma still records the failed attempt as unfinished. Before changing its
migration status, inspect `_prisma_migrations` and verify all of the following:

```sql
SELECT id, started_at, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20260910020000_document_export_artifacts';

SELECT to_regclass('"DocumentExportArtifact"'),
       to_regclass('"DocumentExportAttempt"');

SELECT typname FROM pg_type
WHERE typname IN ('DocumentExportArtifactState', 'DocumentExportAttemptState');

SELECT indexname FROM pg_indexes
WHERE schemaname = current_schema()
  AND (indexname LIKE 'DocumentExportArtifact_%'
       OR indexname LIKE 'DocumentExportAttempt_%');
```

Only when both tables are `NULL`, neither enum exists, and no matching index
exists may an operator mark the exact failed migration rolled back and retry:

```bash
pnpm --filter web exec prisma migrate resolve --rolled-back 20260910020000_document_export_artifacts
pnpm --filter web db:migrate:prod
pnpm --filter web exec prisma migrate status
```

If any export table, enum, or index exists, stop. Do not mark the migration
rolled back and do not drop partial objects until their definitions and the
failed migration logs have been reviewed against the checked-in SQL. The local,
opt-in `tests/e2e/document-export-lifecycle-probe.mts` forces the lock-timeout
case, verifies zero partial DDL plus the unfinished Prisma row, performs the
exact rollback resolution, and proves a clean redeploy and finished ledger.

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

Also ensure the embedding model produces exactly **1536-dimensional** vectors.
Incompatible or unavailable indexes use labeled keyword results instead; they
are not silently compared with vectors from another provider or model.

### File uploads fail

Check that MinIO (or your S3 bucket) is reachable and the bucket exists. The `createbuckets` service creates the default `clauseflow` bucket on first boot.

### Emails not sending

Verify your SMTP credentials and that `SMTP_HOST` is set. Check the worker logs for `[email]` prefixed errors.
