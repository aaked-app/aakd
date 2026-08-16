#!/bin/bash
# Aakd — Production update script
# Run on your server whenever you want to deploy the latest version.
#
# Usage: bash scripts/update.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "[Aakd] Pulling latest code..."
git pull origin main

echo "[Aakd] Building new images..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build --parallel

echo "[Aakd] Restarting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo ""
echo "✓ Update complete. Service containers may restart briefly while the new images come online."
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
