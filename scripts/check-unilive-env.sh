#!/usr/bin/env bash
# Check UniLive’s / Asset Studio env presence without printing secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${1:-.env.local}"
echo "Repo root: $ROOT"
echo "Checking: $ENV_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: $ENV_FILE not found"
  echo "Copy docs/AI_project_control/env.example → .env.local and fill keys."
  exit 1
fi

# Load without echoing values
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

check_present() {
  local name="$1"
  local required="${2:-0}"
  local val="${!name-}"
  if [[ -n "${val}" ]]; then
    echo "OK   $name (set, length=${#val})"
    return 0
  fi
  if [[ "$required" == "1" ]]; then
    echo "MISS $name (required)"
    return 1
  fi
  echo "OPT  $name (empty)"
  return 0
}

fail=0

# Core providers (optional individually; at least warn)
check_present OPENAI_API_KEY || true
check_present OPENAI_IMAGE_MODEL || true
check_present MESHY_API_KEY || true
check_present RUNWAY_API_KEY || true
check_present ELEVENLABS_API_KEY || true

# Kling: either API key OR access+secret
if [[ -n "${KLING_API_KEY-}" ]]; then
  echo "OK   KLING_API_KEY (set, length=${#KLING_API_KEY})"
elif [[ -n "${KLING_ACCESS_KEY-}" && -n "${KLING_SECRET_KEY-}" ]]; then
  echo "OK   KLING_ACCESS_KEY + KLING_SECRET_KEY (set)"
else
  echo "OPT  Kling (no KLING_API_KEY and no access/secret pair)"
fi

# Studio safety — must be present with safe defaults if set
for k in ASSET_STUDIO_DRY_RUN ASSET_STUDIO_MAX_PAID_CALLS ASSET_STUDIO_AUTO_RETRY ASSET_STUDIO_REQUIRE_APPROVAL; do
  check_present "$k" || true
done

# Safety assertions when set
if [[ "${ASSET_STUDIO_DRY_RUN-}" == "false" ]]; then
  echo "WARN ASSET_STUDIO_DRY_RUN=false (paid calls enabled)"
fi
if [[ "${ASSET_STUDIO_AUTO_RETRY-}" == "true" ]]; then
  echo "FAIL ASSET_STUDIO_AUTO_RETRY must be false"
  fail=1
fi

# Never allow VITE_ secrets for these providers in .env.local
if grep -E '^[[:space:]]*VITE_(OPENAI|MESHY|RUNWAY|KLING|ELEVENLABS)_' "$ENV_FILE" >/dev/null 2>&1; then
  echo "FAIL found VITE_ provider secret keys in $ENV_FILE"
  fail=1
else
  echo "OK   no VITE_ provider secret keys"
fi

# Control docs present
test -d docs/AI_project_control && echo "OK   docs/AI_project_control"
test -d docs/unilives-assets && echo "OK   docs/unilives-assets (Phase 12)"
test -d lib/unilives-asset-studio && echo "OK   lib/unilives-asset-studio"

if [[ "$fail" -ne 0 ]]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (presence check only; values never printed)"
exit 0
