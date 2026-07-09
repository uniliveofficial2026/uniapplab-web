#!/usr/bin/env bash
# Deploy monorepo (SPA + /api/*) via Vercel CLI — uses `vercel login`, not VERCEL_TOKEN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

vercel_env() {
  env -u NPM_CONFIG_USERCONFIG \
    -u NPM_CONFIG_GLOBALCONFIG \
    -u npm_config_userconfig \
    -u npm_config_globalconfig \
    "$@"
}

PROJECT="$(node scripts/vercel-project-name.mjs)"

echo "[vercel] Deploying monorepo (SPA + API) from staged source…"
node scripts/sync-vercel-config.mjs
node scripts/prepare-vercel-source.mjs

deploy_log="$(mktemp)"
set +e
(
  cd .vercel/source-staging
  vercel_env pnpm dlx vercel@latest deploy --prod --yes --archive=tgz --project "$PROJECT"
) 2>&1 | tee "$deploy_log"
deploy_status=${PIPESTATUS[0]}
set -e

if [[ "$deploy_status" -ne 0 ]]; then
  if grep -qE 'api-upload-free|Too many requests|Resource is limited|rate' "$deploy_log"; then
    echo ""
    echo "[vercel] CLI rate-limited. Fix Git deploys instead:"
    echo "  pnpm run vercel:open-settings"
    echo "  Clear Root Directory → Save → Redeploy Production in dashboard"
    rm -f "$deploy_log"
    exit 2
  fi
  rm -f "$deploy_log"
  exit "$deploy_status"
fi

deployment_url="$(grep -oE 'https://uniapplab-web-instacollab-[a-z0-9-]+\.vercel\.app' "$deploy_log" | tail -1)"
if [[ -n "$deployment_url" ]]; then
  echo "[vercel] Aliasing production domains → $deployment_url"
  for host in app.uniapplab.com uniapplab.com www.uniapplab.com; do
    vercel_env pnpm dlx vercel@latest alias set "$deployment_url" "$host" --project "$PROJECT" || true
  done
fi

rm -f "$deploy_log"
echo ""
echo "[vercel] ✓ Deploy complete. Verify:"
echo "  curl -s https://app.uniapplab.com/api/healthz"
