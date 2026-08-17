#!/usr/bin/env bash
# Reproduce the local Phase 0 engineering verification boundary.
#
# This verifies code, public capability truth, and self-hosting configuration.
# It does not create customer evidence or replace the clean Compose/MCP runtime
# replays documented in research/gates/.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[phase-0] validating self-hosting configuration"
bash scripts/validate-self-hosting.sh

echo "[phase-0] checking TypeScript"
pnpm typecheck

echo "[phase-0] running lint"
pnpm --filter web lint

echo "[phase-0] running the complete test suite"
pnpm --filter web test

echo "[phase-0] building the production application"
pnpm build

echo "[phase-0] engineering verification passed"
echo "[phase-0] customer-evidence gate remains separate; review research/gates/phase-0-customer-evidence-ledger.md"
