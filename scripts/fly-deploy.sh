#!/usr/bin/env bash
# Deploy InstaCollab API to Fly.io
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v fly >/dev/null 2>&1; then
  echo "[fly] flyctl not installed — run: pnpm run fly:setup" >&2
  exit 1
fi

APP="${FLY_APP_NAME:-uniapplab-api}"

echo "[fly] deploying $APP from $ROOT"
fly deploy --app "$APP" "$@"

echo ""
echo "[fly] verify: pnpm run fly:check"
