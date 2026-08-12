#!/usr/bin/env bash
# Load Meshy API key into the current shell without printing it.
# Usage:  source tools/character-pipeline/meshy/load-env.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="$ROOT/.env.meshy.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.meshy.local.example and add your key."
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -n "${MESHY_API_KEY:-}" ]]; then
  echo "Meshy key loaded"
else
  echo "Meshy key missing"
  return 1 2>/dev/null || exit 1
fi
