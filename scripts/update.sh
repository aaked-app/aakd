#!/bin/bash
# Aakd — Production update script
# Run on your server to deploy one reviewed, exact release commit.
#
# Usage: AAKD_REF=<40-character commit SHA> bash scripts/update.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
# shellcheck source=lib/self-hosting-config.sh
source "$REPO_DIR/scripts/lib/self-hosting-config.sh"

if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required to prevent concurrent production updates." >&2
  exit 1
fi
LOCK_FILE="$(git rev-parse --git-path aakd-update.lock)"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another Aakd update is already running." >&2
  exit 1
fi

if ! validate_deploy_ref "${AAKD_REF:-}"; then
  echo "Refusing to update from a floating branch or tag." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to update from a working tree with uncommitted changes." >&2
  exit 1
fi
if ! ensure_docuseal_image ".env.prod" "docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc"; then
  echo "Refusing a mutable or malformed DOCUSEAL_IMAGE in .env.prod" >&2
  exit 1
fi

PREVIOUS_REF="$(git rev-parse HEAD)"
CHECKED_OUT_NEW_REF=false
rollback() {
  local status=$?
  trap - ERR
  if [ "$CHECKED_OUT_NEW_REF" = true ]; then
    echo "[Aakd] Update failed; restoring $PREVIOUS_REF..." >&2
    git checkout --detach "$PREVIOUS_REF" >&2 || {
      echo "[Aakd] Rollback could not restore the previous Git revision." >&2
      exit 1
    }
    docker compose -f docker-compose.prod.yml --env-file .env.prod build --parallel >&2 || {
      echo "[Aakd] Rollback could not rebuild the previous release." >&2
      exit 1
    }
    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d >&2 || {
      echo "[Aakd] Rollback could not restart the previous release." >&2
      exit 1
    }
  fi
  exit "$status"
}
trap rollback ERR

echo "[Aakd] Fetching requested release commit..."
git fetch --prune origin
if ! git cat-file -e "${AAKD_REF}^{commit}" 2>/dev/null; then
  echo "AAKD_REF was not found after fetch: ${AAKD_REF}" >&2
  exit 1
fi
if ! git diff --quiet "$PREVIOUS_REF" "$AAKD_REF" -- apps/web/prisma/migrations; then
  echo "Refusing an automatic update containing database migrations." >&2
  echo "Create and verify a recovery point, then follow the documented maintenance procedure." >&2
  exit 1
fi
git checkout --detach "$AAKD_REF"
CHECKED_OUT_NEW_REF=true

echo "[Aakd] Building new images..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build --parallel

echo "[Aakd] Restarting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

ATTEMPTS=0
MAX_ATTEMPTS=30
until docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T app wget -q --spider http://localhost:3000/api/health >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "Updated app did not become healthy; restoring the previous release." >&2
    false
  fi
  sleep 5
done
trap - ERR

echo ""
echo "✓ Update complete. Service containers may restart briefly while the new images come online."
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
