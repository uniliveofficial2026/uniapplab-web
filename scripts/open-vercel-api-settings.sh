#!/usr/bin/env bash
# Open Vercel settings to fix API 404 (Root Directory must be repo root).
set -euo pipefail

PROJECT="${VERCEL_PROJECT_NAME:-uniapplab-web-instacollab}"
TEAM="${VERCEL_TEAM_SLUG:-uniliveofficial2026s-projects}"
URL="https://vercel.com/${TEAM}/${PROJECT}/settings/build-and-deployment"

echo ""
echo "=== Fix Vercel API (404 on /api/*) ==="
echo ""
echo "1) Opening Vercel Build settings…"
echo "   ${URL}"
echo ""
echo "2) Set Root Directory to EMPTY (repo root, not artifacts/instacollab)"
echo ""
echo "3) Set commands:"
echo "   Install: pnpm install && pnpm --filter @workspace/api-server run build"
echo "   Build:   pnpm --filter @workspace/instacollab run build"
echo ""
echo "4) Save → Deployments → Redeploy latest Production"
echo ""
echo "Or use CLI token:"
echo "   export VERCEL_TOKEN=…  # https://vercel.com/account/tokens"
echo "   pnpm run vercel:fix-root"
echo ""

if command -v open >/dev/null 2>&1; then
  open "$URL"
fi
