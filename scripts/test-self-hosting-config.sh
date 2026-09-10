#!/usr/bin/env bash
# Focused regression tests for production self-hosting configuration guards.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/self-hosting-config.sh
source "$ROOT_DIR/scripts/lib/self-hosting-config.sh"

dockerignore="$ROOT_DIR/.dockerignore"
for private_pattern in \
  '**/AGENTS.md' \
  '**/CLAUDE.md' \
  '**/.claude' \
  '**/.codex' \
  '**/.vercel' \
  '.agents' \
  '.specify' \
  '.seo' \
  'research' \
  'specs' \
  'reports' \
  'production-e2e-audit-*.md'; do
  if ! grep -Fxq "$private_pattern" "$dockerignore"; then
    echo "Expected Docker build context to exclude private or build-irrelevant path: $private_pattern" >&2
    exit 1
  fi
done

for required_build_path in \
  package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  apps/web/package.json \
  apps/web/prisma/schema.prisma \
  apps/web/worker.ts \
  worker/jobs; do
  if [ ! -e "$ROOT_DIR/$required_build_path" ]; then
    echo "Expected required Docker build input to remain available: $required_build_path" >&2
    exit 1
  fi
  if grep -Fxq "$required_build_path" "$dockerignore"; then
    echo "Required Docker build input is excluded: $required_build_path" >&2
    exit 1
  fi
done

for dockerfile in apps/web/Dockerfile apps/web/Dockerfile.worker; do
  if grep -Eq '^FROM node:20-alpine([[:space:]]|$)' "$ROOT_DIR/$dockerfile"; then
    echo "Expected $dockerfile to pin its Node base image by digest." >&2
    exit 1
  fi
done

web_dockerfile="$ROOT_DIR/apps/web/Dockerfile"
flag_arg_line="$(grep -nF 'ARG NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=false' "$web_dockerfile" | cut -d: -f1 || true)"
# The Dockerfile must contain this literal expansion.
# shellcheck disable=SC2016
flag_env_line="$(grep -nF 'ENV NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=${NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED}' "$web_dockerfile" | cut -d: -f1 || true)"
web_build_line="$(grep -nF 'RUN pnpm run build' "$web_dockerfile" | cut -d: -f1 || true)"
if [ -z "$flag_arg_line" ] || [ -z "$flag_env_line" ] || [ -z "$web_build_line" ] \
  || [ "$flag_arg_line" -ge "$web_build_line" ] || [ "$flag_env_line" -ge "$web_build_line" ]; then
  echo "Expected the Phase 1 UI flag to default false and be exported before the Next.js image build." >&2
  exit 1
fi
if ! awk '
  /^  app:/ { app = 1 }
  /^  worker:/ { app = 0 }
  app && /^    build:/ { build = 1 }
  app && /^    environment:/ { build = 0 }
  build && /NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED: \$\{NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED:-false\}/ { found = 1 }
  END { exit(found ? 0 : 1) }
' "$ROOT_DIR/docker-compose.prod.yml"; then
  echo "Expected production Compose to pass the default-false Phase 1 flag as an app build argument." >&2
  exit 1
fi
if [ "$(grep -c '^NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=false$' "$ROOT_DIR/.env.prod.example")" -ne 1 ]; then
  echo "Expected the production environment example to keep the Phase 1 UI disabled by default." >&2
  exit 1
fi
if ! awk '
  /- name: Build web image/ { web = 1 }
  /- name: Build worker image/ { web = 0 }
  web && /NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=true/ { found = 1 }
  END { exit(found ? 0 : 1) }
' "$ROOT_DIR/.github/workflows/ci.yml"; then
  echo "Expected candidate CI to compile the Phase 1 UI for browser verification." >&2
  exit 1
fi

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

for compose_file in docker-compose.yml docker-compose.prod.yml; do
  for service in app worker; do
    if ! awk -v target="$service" '
      /^  [A-Za-z0-9_-]+:/ { selected = ($0 == "  " target ":") }
      selected && /AGREEMENT_ACCESS_EMERGENCY_DENY_ALL:/ { found = 1 }
      END { exit(found ? 0 : 1) }
    ' "$ROOT_DIR/$compose_file"; then
      echo "Expected $compose_file $service to honor emergency agreement denial." >&2
      exit 1
    fi
  done
  if ! grep -q '^  docuseal-secret-check:$' "$ROOT_DIR/$compose_file"; then
    echo "Expected $compose_file to gate the optional DocuSeal service on a secret check." >&2
    exit 1
  fi
  # The Compose interpolation must remain literal in this source assertion.
  # shellcheck disable=SC2016
  if ! grep -q 'DOCUSEAL_SECRET_KEY_BASE: ${DOCUSEAL_SECRET_KEY_BASE:-}' "$ROOT_DIR/$compose_file"; then
    echo "Expected $compose_file to allow default-stack interpolation without a DocuSeal secret." >&2
    exit 1
  fi
  if ! awk '
    /^  docuseal:/ { docuseal = 1; next }
    /^  [A-Za-z0-9_-]+:/ { docuseal = 0 }
    docuseal && /docuseal-secret-check:/ { dependency = 1 }
    docuseal && /condition: service_completed_successfully/ { condition = 1 }
    END { exit(dependency && condition ? 0 : 1) }
  ' "$ROOT_DIR/$compose_file"; then
    echo "Expected DocuSeal in $compose_file to wait for its successful secret check." >&2
    exit 1
  fi
done

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

# Deliberately write inert shell syntax to test that the environment parser rejects it.
# shellcheck disable=SC2016
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
