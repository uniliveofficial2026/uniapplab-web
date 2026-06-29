#!/usr/bin/env bash
# Create a fresh main branch with no secret-bearing history (for first GitHub push).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ "${1:-}" != "--yes" ]]; then
  echo "Creates a new orphan main branch (no old commits). Use when GH013 blocks first push."
  echo "Run: bash scripts/reset-clean-main.sh --yes"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "[reset-clean-main] origin → $(git remote get-url origin)"
fi

current="$(git branch --show-current)"
backup="backup-before-clean-$(date +%Y%m%d-%H%M%S)"
git branch "$backup" "$current"
echo "[reset-clean-main] Backed up current branch as: $backup"

git checkout --orphan clean-main
git add -A
git commit -m "$(cat <<'EOF'
Initial commit — InstaCollab monorepo.

Secrets are not committed; copy .env.example → .env locally.
EOF
)"

git branch -D "$current"
git branch -m "$current"

echo "[reset-clean-main] New history on $current ($(git rev-list --count HEAD) commit)."
echo "[reset-clean-main] Verify: git grep -E 'AQ\\.Ab8|AIzaSy' || echo 'no secrets found'"
echo "[reset-clean-main] Push: bash scripts/github-push.sh"
