#!/usr/bin/env bash
# Validate self-hosting configuration without modifying the user's .env files.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# shellcheck source=lib/self-hosting-config.sh
source "$ROOT_DIR/scripts/lib/self-hosting-config.sh"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required to validate self-hosting." >&2
  exit 1
fi

TEMP_ENV="$(mktemp)"
trap 'rm -f "$TEMP_ENV"' EXIT

cat > "$TEMP_ENV" <<'EOF'
POSTGRES_PASSWORD=phase0-test-postgres
REDIS_PASSWORD=phase0-test-redis
REDIS_URL=redis://:phase0-test-redis@redis:6379
MINIO_ROOT_USER=phase0minio
MINIO_ROOT_PASSWORD=phase0-test-minio
BETTER_AUTH_SECRET=phase0-test-auth-secret
NOTIFICATION_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000001
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000001
DOCUSEAL_SECRET_KEY_BASE=phase0-test-docuseal-secret
DOCUSEAL_IMAGE=docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc
DOMAIN=example.com
EOF

validate_docuseal_image "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc"

docker compose --env-file "$TEMP_ENV" -f docker-compose.yml config --quiet
docker compose --env-file "$TEMP_ENV" -f docker-compose.prod.yml config --quiet

mutable_images="$(docker compose --env-file "$TEMP_ENV" -f docker-compose.prod.yml config | awk '/^[[:space:]]+image: / { print $2 }' | grep -v '@sha256:' || true)"
if [ -n "$mutable_images" ]; then
  echo "Production Compose contains mutable image references:" >&2
  echo "$mutable_images" >&2
  exit 1
fi

echo "Self-hosting Compose configuration is valid (development and production)."
