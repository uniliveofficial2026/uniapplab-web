#!/usr/bin/env bash
# Apply GitHub branch protection on main (force-push/delete block + PR + CI).
# Usage: bash scripts/protect-github-main.sh
set -euo pipefail

REPO="${GITHUB_REPO:-uniliveofficial2026/uniapplab-web}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

gh api --method PUT "repos/${REPO}/branches/main/protection" --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF

echo "[github] main protected: no force-push/delete, PR + verify CI required"
