#!/usr/bin/env bash
# Install pnpm when missing. Works around npm "double-loading npmrc" when user/global
# point at the same file (common on this machine: /Volumes/Wei2TB/MacData/config/npmrc).
set -euo pipefail

if command -v pnpm >/dev/null 2>&1; then
  echo "pnpm $(pnpm --version) is available at $(command -v pnpm)"
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node/npm not found. Install Node 20+ (nvm recommended), then re-run:" >&2
  echo "  bash scripts/ensure-pnpm.sh" >&2
  exit 1
fi

echo "Installing pnpm@10 globally..."
env -u NPM_CONFIG_USERCONFIG \
  -u NPM_CONFIG_GLOBALCONFIG \
  -u npm_config_userconfig \
  -u npm_config_globalconfig \
  npm install -g pnpm@10

echo "pnpm $(pnpm --version) installed at $(command -v pnpm)"
