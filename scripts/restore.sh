#!/usr/bin/env bash
# Restore a PostgreSQL backup. This replaces the current public schema.
# Usage: bash scripts/restore.sh backups/file.sql.gz --yes-really-restore

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
BACKUP="${1:-}"
CONFIRM="${2:-}"
if [ -z "$BACKUP" ] || [ "$CONFIRM" != "--yes-really-restore" ]; then
  echo "Usage: bash scripts/restore.sh backups/file.sql.gz --yes-really-restore" >&2
  echo "WARNING: this replaces the current public database schema." >&2
  exit 2
fi
if [ ! -f "$BACKUP" ]; then echo "Error: backup file not found: $BACKUP" >&2; exit 1; fi
gzip -t "$BACKUP"
echo "This will replace the current Aakd database with: $BACKUP"
read -r -p "Type RESTORE to continue: " ANSWER
if [ "$ANSWER" != "RESTORE" ]; then echo "Restore cancelled."; exit 1; fi

"${COMPOSE[@]}" stop app worker >/dev/null
trap '"${COMPOSE[@]}" start app worker >/dev/null 2>&1 || true' EXIT
"${COMPOSE[@]}" exec -T db psql -U postgres -d clauseflow -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c "$BACKUP" | "${COMPOSE[@]}" exec -T db psql -U postgres -d clauseflow -v ON_ERROR_STOP=1
"${COMPOSE[@]}" start app worker >/dev/null
trap - EXIT
echo "Restore complete. Run scripts/doctor.sh to verify the stack."
