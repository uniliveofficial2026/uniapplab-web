#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[codespace] Enabling pnpm…"
corepack enable
corepack prepare pnpm@10.34.4 --activate

echo "[codespace] Installing dependencies…"
pnpm install

if [[ -f scripts/sync-vercel-config.mjs ]]; then
  node scripts/sync-vercel-config.mjs || true
fi

echo ""
echo "[codespace] Ready. Copy secrets into .env (not committed), then run:"
echo "  pnpm develop"
echo ""
