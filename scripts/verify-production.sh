#!/usr/bin/env bash
# Verify the Phase 0 production infrastructure path. This does not claim that
# the product activation journey has been completed by a human user.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

if [ ! -f .env.prod ]; then
  echo ".env.prod is missing." >&2
  exit 1
fi

DOMAIN="$(awk -F= '$1 == "DOMAIN" { print substr($0, index($0, "=") + 1); exit }' .env.prod)"
if [ -z "$DOMAIN" ]; then
  echo "DOMAIN is missing from .env.prod." >&2
  exit 1
fi

for service in app worker db redis minio caddy; do
  if ! "${COMPOSE[@]}" ps --status running --services | grep -qx "$service"; then
    echo "Required service is not running: $service" >&2
    exit 1
  fi
done

"${COMPOSE[@]}" exec -T app node -e "fetch(process.env.INTERNAL_APP_URL + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
"${COMPOSE[@]}" exec -T app npx prisma migrate status >/dev/null
"${COMPOSE[@]}" exec -T db pg_isready -U postgres -d clauseflow >/dev/null
"${COMPOSE[@]}" exec -T redis redis-cli -a "$(awk -F= '$1 == "REDIS_PASSWORD" { print substr($0, index($0, "=") + 1); exit }' .env.prod)" ping | grep -qx PONG
"${COMPOSE[@]}" run --rm --no-deps createbuckets >/dev/null
WORKER_CONTAINER="$("${COMPOSE[@]}" ps -q worker)"
WORKER_STARTED_AT="$(docker inspect --format '{{.State.StartedAt}}' "$WORKER_CONTAINER")"
docker logs --since "$WORKER_STARTED_AT" "$WORKER_CONTAINER" 2>&1 | grep -F '[worker] ClauseFlow BullMQ worker started' >/dev/null

for hostname in "$DOMAIN" "sign.$DOMAIN"; do
  curl --fail --silent --show-error --max-time 15 "https://$hostname/" >/dev/null
done

echo "Infrastructure verification passed: app, worker, PostgreSQL, Redis, object storage, migrations-at-startup, and TLS endpoints."
echo "A human must still create an organization, sign in, and complete the intended first-value journey before declaring the pilot complete."
