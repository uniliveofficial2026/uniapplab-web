#!/usr/bin/env bash
# Open Vercel settings (optional — subfolder vercel.json now bundles /api/* on git deploy).
set -euo pipefail

PROJECT="${VERCEL_PROJECT_NAME:-uniapplab-web-instacollab}"
TEAM="${VERCEL_TEAM_SLUG:-uniliveofficial2026s-projects}"
URL="https://vercel.com/${TEAM}/${PROJECT}/settings/build-and-deployment"
DEPLOY_URL="https://vercel.com/${TEAM}/${PROJECT}/deployments"

echo ""
echo "=== Vercel production API (/api/*) ==="
echo ""
echo "Git deploys (default): artifacts/instacollab/vercel.json stages api-server at build time."
echo "Push to main or Redeploy Production after merge."
echo ""
echo "CLI deploy (if not rate-limited):"
echo "   pnpm run vercel:deploy-api"
echo ""
echo "Optional — monorepo root (clears subfolder workaround):"
echo "   Root Directory → EMPTY, Install/Build from repo root"
echo "   ${URL}"
echo ""
echo "Redeploy:"
echo "   ${DEPLOY_URL}"
echo ""

if command -v open >/dev/null 2>&1; then
  open "$DEPLOY_URL"
fi
