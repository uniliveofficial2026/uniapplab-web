#!/usr/bin/env bash
# Squash unpushed commits into one clean commit without oversized blobs.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

branch="${1:-$(git branch --show-current)}"
upstream="origin/${branch}"

if ! git rev-parse --verify "$upstream" >/dev/null 2>&1; then
  echo "[fix-large-files] Fetching origin/$branch…"
  git fetch origin "$branch"
fi

ahead="$(git rev-list --count "${upstream}..${branch}" 2>/dev/null || echo 0)"
if [[ "$ahead" == "0" ]]; then
  echo "[fix-large-files] Branch is not ahead of $upstream — nothing to squash."
  exit 0
fi

echo "[fix-large-files] Squashing $ahead commit(s) on $branch (base: $upstream)"

stashed=0
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files -o --exclude-standard)" ]]; then
  echo "[fix-large-files] Stashing working tree changes…"
  git stash push -u -m "fix-large-files-$(date +%Y%m%d%H%M%S)"
  stashed=1
fi

git reset --soft "$upstream"

# Drop paths GitHub rejects (>100MB) and local Vercel mirrors from the squash commit.
git rm -rf --cached --ignore-unmatch \
  ".vercel" \
  ".vercel/source-staging/artifacts/instacollab/vendor/archives/free_package.zip" \
  ".vercel/source-staging/artifacts/instacollab/public/trtc-webar/backgrounds/video-bg-2.mp4" \
  "artifacts/instacollab/vendor/archives/free_package.zip" \
  "artifacts/instacollab/public/trtc-webar/backgrounds/video-bg-2.mp4" \
  2>/dev/null || true

git add -A

if git diff --cached --quiet; then
  echo "[fix-large-files] No staged changes after cleanup."
else
  git commit -m "$(cat <<EOF
Ship ${branch}: squash unpushed work without oversized assets.

Drops .vercel mirrors and vendor zip/media blobs from git — those stay local or CDN.
EOF
)"
fi

if [[ "$stashed" -eq 1 ]]; then
  echo "[fix-large-files] Restoring stashed changes…"
  git stash pop || echo "[fix-large-files] Stash pop had conflicts — resolve manually with: git stash list"
fi

echo "[fix-large-files] Done. Next: bash scripts/github-push.sh ${branch}"
