#!/usr/bin/env bash
# Focused regression tests for production self-hosting configuration guards.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/self-hosting-config.sh
source "$ROOT_DIR/scripts/lib/self-hosting-config.sh"

for dockerfile in apps/web/Dockerfile apps/web/Dockerfile.worker; do
  if grep -Eq '^FROM node:20-alpine([[:space:]]|$)' "$ROOT_DIR/$dockerfile"; then
    echo "Expected $dockerfile to pin its Node base image by digest." >&2
    exit 1
  fi
done

if grep -q '^[[:space:]]*sleep 86400;' "$ROOT_DIR/docker-compose.prod.yml"; then
  echo "Expected the production backup job to run before its first sleep." >&2
  exit 1
fi
if ! grep -q 'pg_dump -h db -U postgres clauseflow >' "$ROOT_DIR/docker-compose.prod.yml"; then
  echo "Expected the production backup job to validate pg_dump before compression." >&2
  exit 1
fi
if ! grep -q 'mv .* || return 1' "$ROOT_DIR/docker-compose.prod.yml"; then
  echo "Expected the production backup job to fail when finalizing a dump fails." >&2
  exit 1
fi
if ! grep -q 'set -eu;' "$ROOT_DIR/docker-compose.prod.yml" || ! grep -q 'mc stat local/clauseflow' "$ROOT_DIR/docker-compose.prod.yml"; then
  echo "Expected bucket initialization to fail closed and verify the storage bucket." >&2
  exit 1
fi

if ! grep -q 'flock -n' "$ROOT_DIR/scripts/update.sh" || ! grep -q 'git rev-parse --git-path aakd-update.lock' "$ROOT_DIR/scripts/update.sh"; then
  echo "Expected updates to take an exclusive deployment lock." >&2
  exit 1
fi
if ! grep -q 'apps/web/prisma/migrations' "$ROOT_DIR/scripts/update.sh"; then
  echo "Expected automatic updates to refuse releases carrying database migrations." >&2
  exit 1
fi
if ! grep -q 'scripts/verify-production.sh' "$ROOT_DIR/scripts/deploy.sh"; then
  echo "Expected the installer to run full infrastructure verification." >&2
  exit 1
fi
if ! grep -q '/api/health' "$ROOT_DIR/scripts/update.sh"; then
  echo "Expected updates to verify the application health endpoint." >&2
  exit 1
fi

assert_valid_docuseal_image() {
  local image="$1"
  if ! validate_docuseal_image "$image" >/dev/null 2>&1; then
    echo "Expected valid DocuSeal image to be accepted: $image" >&2
    exit 1
  fi
}

assert_invalid_docuseal_image() {
  local image="$1"
  if validate_docuseal_image "$image" >/dev/null 2>&1; then
    echo "Expected invalid DocuSeal image to be rejected: $image" >&2
    exit 1
  fi
}

assert_valid_docuseal_image "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc"
assert_invalid_docuseal_image ""
assert_invalid_docuseal_image "docuseal/docuseal:latest"
assert_invalid_docuseal_image "docuseal/docuseal@sha256:not-a-digest"

if ! validate_deploy_ref "0123456789abcdef0123456789abcdef01234567" >/dev/null 2>&1; then
  echo "Expected an exact commit SHA to be accepted." >&2
  exit 1
fi
for ref in "" "main" "v1.2.1" "0123456"; do
  if validate_deploy_ref "$ref" >/dev/null 2>&1; then
    echo "Expected mutable or abbreviated deployment reference to be rejected: $ref" >&2
    exit 1
  fi
done

TEMP_ENV="$(mktemp)"
MARKER_FILE="$(mktemp)"
trap 'rm -f "$TEMP_ENV" "$MARKER_FILE"' EXIT

if ensure_docuseal_image "$TEMP_ENV" "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc" >/dev/null 2>&1; then
  echo "Expected an incomplete production environment file to be rejected." >&2
  exit 1
fi
printf 'DOMAIN=app.example.com\n' > "$TEMP_ENV"
ensure_docuseal_image "$TEMP_ENV" "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc"
grep -Fx "DOCUSEAL_IMAGE=docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc" "$TEMP_ENV" >/dev/null

printf 'DOMAIN=app.example.com\nDOCUSEAL_IMAGE=registry.example/docuseal@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' > "$TEMP_ENV"
ensure_docuseal_image "$TEMP_ENV" "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc"
grep -Fx 'DOCUSEAL_IMAGE=registry.example/docuseal@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$TEMP_ENV" >/dev/null
[ "$(grep -c '^DOCUSEAL_IMAGE=' "$TEMP_ENV")" -eq 1 ]

printf 'DOMAIN=app.example.com\nDOCUSEAL_IMAGE=docuseal/docuseal:latest\n' > "$TEMP_ENV"
if ensure_docuseal_image "$TEMP_ENV" "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc" >/dev/null 2>&1; then
  echo "Expected a mutable legacy DocuSeal image to be rejected." >&2
  exit 1
fi

printf 'DOMAIN=app.example.com\nDOCUSEAL_IMAGE=$(printf injected > %s)\n' "$MARKER_FILE" > "$TEMP_ENV"
if read_env_value "$TEMP_ENV" DOCUSEAL_IMAGE >/dev/null 2>&1; then
  echo "Expected shell syntax in .env.prod to be rejected." >&2
  exit 1
fi
if [ -s "$MARKER_FILE" ]; then
  echo "Environment parser executed shell syntax." >&2
  exit 1
fi

echo "Self-hosting production configuration guards passed."
