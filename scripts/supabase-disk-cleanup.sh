#!/usr/bin/env bash
# Run AFTER Supabase org is upgraded off Free (read-only lifts).
# Usage from repo root:
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   ./scripts/supabase-disk-cleanup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${SUPABASE_PROJECT_REF:-ffhvdoooxkthlvlvdiiu}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
API="https://api.supabase.com/v1/projects/${REF}/database/query"

query() {
  local sql="$1"
  local payload
  payload="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$sql")"
  curl -sS -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo "== status =="
query "SELECT current_setting('transaction_read_only') AS read_only, pg_size_pretty(pg_database_size(current_database())) AS db_size;"
echo

RO="$(query "SELECT current_setting('transaction_read_only') AS read_only;" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["read_only"])')"
if [ "$RO" = "on" ]; then
  echo "Still read-only. Upgrade org to Pro, then re-run this script."
  exit 1
fi

echo "== truncate party_room_sync_events =="
query "TRUNCATE TABLE public.party_room_sync_events;"
echo

echo "== apply prune + automation table SQL =="
SQL_FILE="$ROOT/artifacts/instacollab/supabase/migrations/20260717180000_disk_cleanup_and_automation.sql"
FILTERED="$(python3 -c 'import sys; print(sys.stdin.read().replace("TRUNCATE TABLE public.party_room_sync_events;", "-- truncated above"))' <"$SQL_FILE")"
query "$FILTERED"
echo

echo "== post-cleanup =="
query "SELECT current_setting('transaction_read_only') AS read_only, pg_size_pretty(pg_database_size(current_database())) AS db_size;"
echo
echo "Done."
