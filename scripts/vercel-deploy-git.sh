#!/usr/bin/env bash
# Deploy via GitHub → Vercel remote build (bypasses CLI api-upload-free limit).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/sync-vercel-config.mjs

PROJECT="$(node scripts/vercel-project-name.mjs)"
GIT_URL="${VERCEL_GIT_URL:-https://github.com/uniliveofficial2026/uniapplab-web.git}"
BRANCH="${VERCEL_GIT_BRANCH:-$(git branch --show-current)}"

vercel_env() {
  env -u NPM_CONFIG_USERCONFIG \
    -u NPM_CONFIG_GLOBALCONFIG \
    -u npm_config_userconfig \
    -u npm_config_globalconfig \
    "$@"
}

echo "[deploy] Git → Vercel remote build"
echo "  Project: $PROJECT"
echo "  Repo:    $GIT_URL"
echo "  Branch:  $BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  echo ""
  echo "✗ Uncommitted changes — commit before deploying:"
  echo "    git add -A"
  echo "    git commit -m \"Deploy\""
  echo "    pnpm run deploy:vercel"
  echo ""
  exit 1
fi

echo "[deploy] Ensuring Vercel project is linked to GitHub…"
set +e
connect_log="$(mktemp)"
vercel_env pnpm dlx vercel@latest git connect "$GIT_URL" --yes 2>&1 | tee "$connect_log"
connect_status=${PIPESTATUS[0]}
set -e
if [[ "$connect_status" -ne 0 ]] && ! grep -qiE 'already connected|already linked|connected to' "$connect_log"; then
  echo "[deploy] Warning: git connect returned $connect_status (may already be linked)." >&2
fi
rm -f "$connect_log"

if [[ "$BRANCH" == "main" ]]; then
  echo "[deploy] Note: main is branch-protected — use a PR branch if push fails."
  echo "  git checkout -b chore/deploy-\$(date +%Y%m%d)"
  echo "  git push -u origin HEAD && gh pr create --fill && gh pr merge --squash"
fi

echo "[deploy] Pushing to GitHub…"
bash scripts/github-push.sh "$BRANCH"

echo ""
echo "✓ Pushed to GitHub — Vercel will remote-build on its servers."
echo "  Dashboard: https://vercel.com/uniliveofficial2026s-projects/$PROJECT"
echo "  Production: https://app.uniapplab.com (after build completes)"
echo ""
