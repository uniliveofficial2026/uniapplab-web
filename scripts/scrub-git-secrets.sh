#!/usr/bin/env bash
# Remove API keys from git history before GitHub push (GH013).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "[scrub] For first push / GH013 secret blocks, use a clean history:"
echo "      bash scripts/reset-clean-main.sh --yes"
echo ""
echo "[scrub] Then push:"
echo "      bash scripts/github-push.sh"
echo ""

if [[ "${1:-}" == "--rewrite" ]]; then
  echo "[scrub] Attempting in-place history rewrite (slow; may fail on macOS sandbox)…"
  export FILTER_BRANCH_SQUELCH_WARNING=1
  git filter-branch -f --tree-filter '
    find . -type f \( -name "*.env.example" -o -name "*.md" -o -name "*.mjs" -o -name "*.json" -o -name "*.json.example" \) ! -path "./.git/*" 2>/dev/null \
      | while IFS= read -r f; do
          [ -f "$f" ] || continue
          sed -i "" \
            -e "s/GEMINI_API_KEY=[^[:space:]#]*/GEMINI_API_KEY=your_gemini_api_key/g" \
            -e "s/AIzaSy[A-Za-z0-9_-]\{35\}/YOUR_FIREBASE_API_KEY/g" \
            -e "s/sb_publishable_[A-Za-z0-9_]*/your_supabase_publishable_key/g" \
            "$f" 2>/dev/null || true
        done
    rm -f attached_assets/extracted/remix_-instacollab/firebase.web.config.json \
          attached_assets/extracted/remix_-instacollab/google-services.json \
          attached_assets/extracted/remix_-instacollab/firebase-applet-config.json 2>/dev/null || true
  ' -- --all
  rm -rf .git/refs/original/ 2>/dev/null || true
  git reflog expire --expire=now --all 2>/dev/null || true
  git gc --prune=now 2>/dev/null || true
  echo "[scrub] Rewrite complete."
fi
