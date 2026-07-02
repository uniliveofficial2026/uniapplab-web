#!/usr/bin/env bash
# Deploy InstaCollab API to Fly.io
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FLY_BIN=""
for candidate in flyctl fly; do
  if command -v "$candidate" >/dev/null 2>&1; then
    FLY_BIN="$candidate"
    break
  fi
done

if [[ -z "$FLY_BIN" ]]; then
  echo "[fly] flyctl not installed." >&2
  echo "  brew install flyctl" >&2
  echo "  flyctl auth login" >&2
  exit 1
fi

APP="${FLY_APP_NAME:-uniapplab-api}"

echo "[fly] deploying $APP from $ROOT (using $FLY_BIN)"
"$FLY_BIN" deploy --app "$APP" "$@"

echo ""
echo "[fly] verify: pnpm run fly:check"
