#!/usr/bin/env bash
# Bypass Cursor/VS Code broken vscode-git credential socket and use macOS keychain.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

unset GIT_ASKPASS SSH_ASKPASS VSCODE_GIT_ASKPASS_NODE VSCODE_GIT_ASKPASS_MAIN VSCODE_GIT_IPC_HANDLE 2>/dev/null || true

store_github_token() {
  local token="$1"
  [[ -n "$token" ]] || return 1
  printf 'protocol=https\nhost=github.com\nusername=x-access-token\npassword=%s\n' "$token" \
    | git credential-osxkeychain store
}

token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [[ -n "$token" ]]; then
  echo "[github-push] Storing token from GITHUB_TOKEN/GH_TOKEN in macOS keychain…"
  store_github_token "$token"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[github-push] No origin remote configured."
  exit 1
fi

branch="${1:-$(git branch --show-current)}"
echo "[github-push] Pushing branch: $branch → origin"

push_log="$(mktemp)"
set +e
GIT_TERMINAL_PROMPT=1 git push -u origin "$branch" 2>&1 | tee "$push_log"
push_status=${PIPESTATUS[0]}
set -e

if [[ "$push_status" -eq 0 ]]; then
  rm -f "$push_log"
  echo "[github-push] Done."
  exit 0
fi

if grep -qE 'GH006|Protected branch|pull request' "$push_log" 2>/dev/null; then
  cat <<'EOF'

GitHub blocked direct push to main (branch protection).

Deploy via pull request:
  git checkout -b chore/deploy-$(date +%Y%m%d)
  git add -A && git commit -m "Deploy stack updates"
  git push -u origin HEAD
  gh pr create --fill
  gh pr merge --squash --delete-branch

Vercel will build after the PR merges to main.

EOF
  rm -f "$push_log"
  exit 1
fi

if grep -q 'GH013\|Push cannot contain secrets\|repository rule violations' "$push_log" 2>/dev/null; then
  cat <<'EOF'

GitHub blocked the push — secrets detected in git history (GH013).

Fix:
  1. bash scripts/scrub-git-secrets.sh --yes
  2. git add -A && git commit -m "Remove secrets from tracked files"  # if needed
  3. bash scripts/github-push.sh

Also rotate any exposed keys (Gemini, Firebase, Supabase) in their dashboards.
Never put real keys in .env.example — use placeholders only.

EOF
  rm -f "$push_log"
  exit 1
fi

if grep -q 'Authentication failed\|403\|401\|could not read Username' "$push_log" 2>/dev/null; then
  cat <<'EOF'

GitHub push failed — authentication required.

  export GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
  bash scripts/github-push.sh

Or: scripts/.tools/gh/bin/gh auth login

EOF
  rm -f "$push_log"
  exit 1
fi

echo "[github-push] Push failed. See output above."
rm -f "$push_log"
exit 1
