#!/usr/bin/env bash
# Aakd production diagnostics. Usage: bash scripts/doctor.sh

set -u
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; WARNINGS=0; FAILURES=0
pass() { PASS=$((PASS + 1)); echo -e "${GREEN}[PASS]${NC} $1"; }
warn() { WARNINGS=$((WARNINGS + 1)); echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { FAILURES=$((FAILURES + 1)); echo -e "${RED}[FAIL]${NC} $1"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
echo "Aakd production doctor"
echo "======================="

if [ ! -f .env.prod ]; then fail ".env.prod is missing. Run scripts/deploy.sh first."; exit 1; fi
pass ".env.prod exists"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  fail "Docker and Docker Compose v2 are required."; exit 1
fi
pass "Docker and Compose are available"
if "${COMPOSE[@]}" config --quiet >/dev/null 2>&1; then pass "Production Compose configuration is valid"; else fail "Production Compose configuration is invalid"; fi

for service in app worker db redis minio; do
  if "${COMPOSE[@]}" ps --status running --services | grep -qx "$service"; then pass "$service container is running"; else fail "$service container is not running"; fi
done
if "${COMPOSE[@]}" exec -T app node -e "fetch(process.env.INTERNAL_APP_URL + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then pass "Application health endpoint responds"; else fail "Application health endpoint does not respond"; fi

REDIS_PASSWORD=""
while IFS='=' read -r key value; do [ "$key" = REDIS_PASSWORD ] && REDIS_PASSWORD="$value"; done < .env.prod
if [ -n "$REDIS_PASSWORD" ] && "${COMPOSE[@]}" exec -T redis redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG; then pass "Redis responds to authenticated ping"; else warn "Redis ping could not be verified"; fi

AVAILABLE_KB=$(df -Pk . | awk 'NR==2 {print $4}')
if [ "${AVAILABLE_KB:-0}" -gt 10485760 ]; then pass "More than 10 GB of host disk space is available"; else warn "Less than 10 GB of host disk space is available"; fi
if "${COMPOSE[@]}" exec -T backup sh -c 'find /backups -maxdepth 1 -name "*.sql.gz" -type f | grep -q .' >/dev/null 2>&1; then pass "A scheduled database backup exists"; else warn "No scheduled database backup was found"; fi

echo ""
echo "Summary: ${PASS} passed, ${WARNINGS} warnings, ${FAILURES} failures"
[ "$FAILURES" -eq 0 ]
