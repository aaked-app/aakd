#!/usr/bin/env bash
# Export a compressed PostgreSQL backup to the host.
# Usage: bash scripts/backup.sh [output-file]

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
if [ ! -f .env.prod ]; then echo "Error: .env.prod is missing. Run scripts/deploy.sh first." >&2; exit 1; fi
mkdir -p backups
OUTPUT="${1:-backups/aakd-$(date -u +%Y%m%d-%H%M%S).sql.gz}"
case "$OUTPUT" in /*|backups/*) ;; *) echo "Error: output must be inside backups/ or use an absolute path." >&2; exit 1 ;; esac
echo "Creating PostgreSQL backup: $OUTPUT"
"${COMPOSE[@]}" exec -T db pg_dump -U postgres -d clauseflow | gzip -c > "$OUTPUT"
if [ ! -s "$OUTPUT" ]; then echo "Error: backup file is empty." >&2; rm -f "$OUTPUT"; exit 1; fi
gzip -t "$OUTPUT"
echo "Backup complete: $(du -h "$OUTPUT" | awk '{print $1}')"
