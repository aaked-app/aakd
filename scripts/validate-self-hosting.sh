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
TEMP_ENV_NO_SIGNING="$(mktemp)"
trap 'rm -f "$TEMP_ENV" "$TEMP_ENV_NO_SIGNING"' EXIT

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

# Validate the exact reverse-proxy configuration used by production. This
# catches malformed placeholders and directives before a host requests TLS.
docker run --rm --network none \
  --env DOMAIN=example.com \
  --volume "$ROOT_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 \
  caddy validate --config /etc/caddy/Caddyfile

docker compose --env-file "$TEMP_ENV" -f docker-compose.yml config --quiet
docker compose --env-file "$TEMP_ENV" -f docker-compose.prod.yml config --quiet

grep -Ev '^DOCUSEAL_(SECRET_KEY_BASE|IMAGE)=' "$TEMP_ENV" > "$TEMP_ENV_NO_SIGNING"
env -u DOCUSEAL_IMAGE -u DOCUSEAL_SECRET_KEY_BASE docker compose --env-file "$TEMP_ENV_NO_SIGNING" -f docker-compose.yml config --quiet
env -u DOCUSEAL_IMAGE -u DOCUSEAL_SECRET_KEY_BASE docker compose --env-file "$TEMP_ENV_NO_SIGNING" -f docker-compose.prod.yml config --quiet

invalid_hex="$(printf '%0128d' 0 | tr '0' 'z')"
for compose_file in docker-compose.yml docker-compose.prod.yml; do
  for invalid_secret in '' ' ' 'too-short' 'not-hexadecimal' "$invalid_hex"; do
    if docker compose --project-name aakd-signing-config-check --env-file "$TEMP_ENV_NO_SIGNING" -f "$compose_file" --profile signing \
      run --rm --no-deps -e "DOCUSEAL_SECRET_KEY_BASE=$invalid_secret" docuseal-secret-check >/dev/null 2>&1; then
      echo "Expected $compose_file signing prerequisite to reject invalid secret format." >&2
      exit 1
    fi
  done
  synthetic_secret="$(openssl rand -hex 64)"
  docker compose --project-name aakd-signing-config-check --env-file "$TEMP_ENV_NO_SIGNING" -f "$compose_file" --profile signing \
    run --rm --no-deps -e "DOCUSEAL_SECRET_KEY_BASE=$synthetic_secret" docuseal-secret-check >/dev/null
done

mutable_images="$(docker compose --env-file "$TEMP_ENV" -f docker-compose.prod.yml config | awk '/^[[:space:]]+image: / { print $2 }' | grep -v '@sha256:' || true)"
if [ -n "$mutable_images" ]; then
  echo "Production Compose contains mutable image references:" >&2
  echo "$mutable_images" >&2
  exit 1
fi

echo "Self-hosting Compose configuration is valid (development and production)."
