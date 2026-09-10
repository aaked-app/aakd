#!/usr/bin/env bash
# Reproduce the local Phase 0 engineering verification boundary.
#
# This verifies code, public capability truth, and self-hosting configuration.
# It does not replace deployment acceptance on a clean host or customer
# validation, which remain separate release activities.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[phase-0] validating self-hosting configuration"
bash scripts/validate-self-hosting.sh

echo "[phase-0] checking TypeScript"
pnpm typecheck
pnpm --filter web exec tsc --noEmit -p tsconfig.worker.json

echo "[phase-0] running lint"
pnpm --filter web lint

echo "[phase-0] running the complete test suite"
pnpm --filter web test

echo "[phase-0] running the mandatory tenant-isolation suite"
pnpm --filter web test:isolation

echo "[phase-0] building the production application"
pnpm build

echo "[phase-0] engineering verification passed"
echo "[phase-0] deployment acceptance and customer validation remain separate; see README.md and SECURITY.md"
