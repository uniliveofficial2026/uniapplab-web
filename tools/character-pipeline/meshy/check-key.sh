#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
source .env.meshy.local
set +a
if [ -n "${MESHY_API_KEY:-}" ]; then
  echo "Meshy key loaded"
else
  echo "Meshy key missing"
fi
unset MESHY_API_KEY
