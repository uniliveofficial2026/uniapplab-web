#!/usr/bin/env bash
# Deploy instacollab to Vercel (uniapplab-web-instacollab).
# Default → staged source + remote Vite build on Vercel (--archive=tgz).
# VERCEL_PREBUILT=1 → local build + small prebuilt upload (SPA only — no /api/*).
# LIVE_SYNC_FULL_REPO=1 → legacy full monorepo upload (not recommended).
# On CLI limits → falls back to Git deploy (remote build, no CLI upload).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RAW_ARGS=("$@")
if [[ ${#RAW_ARGS[@]} -eq 0 ]]; then
  RAW_ARGS=(--prod)
fi

VERCEL_ARGS=()
for arg in "${RAW_ARGS[@]}"; do
  case "$arg" in
    --prod|--prebuilt|--yes|-y) VERCEL_ARGS+=("$arg") ;;
  esac
done
if [[ ${#VERCEL_ARGS[@]} -eq 0 ]]; then
  VERCEL_ARGS=(--prod)
fi

is_prod=false
for arg in "${VERCEL_ARGS[@]}"; do
  if [[ "$arg" == "--prod" ]]; then
    is_prod=true
    break
  fi
done

PROJECT="$(node scripts/vercel-project-name.mjs)"
PROJECT_ARGS=(--project "$PROJECT")

vercel_env() {
  env -u NPM_CONFIG_USERCONFIG \
    -u NPM_CONFIG_GLOBALCONFIG \
    -u npm_config_userconfig \
    -u npm_config_globalconfig \
    "$@"
}

deploy_log="$(mktemp)"
deploy_status=0

if [[ "${VERCEL_PREBUILT:-}" == "1" || "${LIVE_SYNC_PREBUILT:-}" == "1" ]]; then
  echo "[deploy] Note: VERCEL_PREBUILT=1 uploads static SPA only — /api/* routes are NOT included."
  echo "[deploy]       Use default deploy (staged source) or deploy:vercel:git for API + frontend."
  echo "[deploy] Building @workspace/instacollab…"
  pnpm --filter @workspace/instacollab run build

  echo "[deploy] Preparing .vercel/output…"
  rm -rf .vercel/output
  mkdir -p .vercel/output/static
  cp -R artifacts/instacollab/dist/public/. .vercel/output/static/
  cat > .vercel/output/config.json <<'EOF'
{
  "version": 3,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

  echo "[deploy] Uploading prebuilt bundle (archive)…"
  set +e
  vercel_env pnpm dlx vercel@latest deploy --prebuilt --yes --archive=tgz "${PROJECT_ARGS[@]}" "${VERCEL_ARGS[@]}" 2>&1 | tee "$deploy_log"
  deploy_status=${PIPESTATUS[0]}
  set -e
elif [[ "${LIVE_SYNC_FULL_REPO:-}" == "1" ]]; then
  node scripts/sync-vercel-config.mjs
  echo "[deploy] Uploading full repo (legacy — may hit api-upload-free)…"
  set +e
  vercel_env pnpm dlx vercel@latest deploy --yes --archive=tgz "${PROJECT_ARGS[@]}" "${VERCEL_ARGS[@]}" 2>&1 | tee "$deploy_log"
  deploy_status=${PIPESTATUS[0]}
  set -e
else
  node scripts/sync-vercel-config.mjs
  node scripts/prepare-vercel-source.mjs

  echo "[deploy] Uploading staged source (archive) → remote build on ${PROJECT}..."
  set +e
  (
    cd .vercel/source-staging
    vercel_env pnpm dlx vercel@latest deploy --yes --archive=tgz "${PROJECT_ARGS[@]}" "${VERCEL_ARGS[@]}"
  ) 2>&1 | tee "$deploy_log"
  deploy_status=${PIPESTATUS[0]}
  set -e
fi

if [[ "$deploy_status" -ne 0 ]]; then
  if grep -qE 'api-upload-free|api-deployments-free|Too many requests|Resource is limited|Can.t deploy more than one path' "$deploy_log"; then
    echo ""
    echo "[deploy] CLI deploy failed or limit hit."
    echo "[deploy] Falling back to Git → Vercel remote build…"
    echo ""
    rm -f "$deploy_log"
    exec bash scripts/vercel-deploy-git.sh
  fi
  rm -f "$deploy_log"
  exit "$deploy_status"
fi

if $is_prod; then
  deployment_url="$(grep -oE 'https://uniapplab-web-instacollab-[a-z0-9]+\.vercel\.app' "$deploy_log" | tail -1)"
  if [[ -n "$deployment_url" ]]; then
    echo "[deploy] Updating custom domain aliases → $deployment_url"
    for host in app.uniapplab.com uniapplab.com www.uniapplab.com; do
      vercel_env pnpm dlx vercel@latest alias set "$deployment_url" "$host"
    done
  else
    echo "[deploy] Warning: could not parse deployment URL; custom domains unchanged." >&2
  fi
fi

rm -f "$deploy_log"
echo "[deploy] Done."
