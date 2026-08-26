#!/usr/bin/env bash
# Same-room Host A (iPhone XCUITest) + Viewer B (Mac AB harness) orchestrator.
# Does NOT recreate rooms between flips — one Solo Live session.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$ROOT/.local/device-logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
HOST_LOG="$LOG_DIR/camera-same-room-host-$STAMP.log"
AB_LOG="$LOG_DIR/camera-same-room-ab-$STAMP.log"

export UNILIVE_DEVICE_QA_TERMINATE="${UNILIVE_DEVICE_QA_TERMINATE:-0}"
export UNILIVE_CAMERA_HOLD_BEFORE_FLIP_SEC="${UNILIVE_CAMERA_HOLD_BEFORE_FLIP_SEC:-90}"
export UNILIVE_CAMERA_ROOM_WAIT_MS="${UNILIVE_CAMERA_ROOM_WAIT_MS:-360000}"
export UNILIVE_CAMERA_AB_SECONDS="${UNILIVE_CAMERA_AB_SECONDS:-120}"
export UNILIVE_CAMERA_ROOM_MAX_AGE_MS="${UNILIVE_CAMERA_ROOM_MAX_AGE_MS:-900000}"

rm -f "$ROOT/.local/camera-ab-room.json" "$ROOT/.local/camera-ab-stages.json"

ONLY="${1:-}"
if [[ -z "$ONLY" ]]; then
  # Chain Live entry (proven chat path) then same-room camera flip in ONE xcodebuild
  # so Cap session stays warm (no terminate between tests).
  ONLY="UniLiveDeviceQAUITests/UniLiveAuthUITests/testLiveChatComposerLandmark,UniLiveDeviceQAUITests/UniLiveAuthUITests/testSoloLiveFrontRearFrontCamera"
fi

echo "[same-room] Starting Mac Viewer B discovery/join harness…"
(
  cd "$ROOT"
  node scripts/device-qa/run-camera-remote-ab.mjs
) >"$AB_LOG" 2>&1 &
AB_PID=$!

# Stream CAMERA_ROOM_ID from host log into discovery file as soon as it appears
# (Host A app landmark is authoritative when party_rooms cloud lag/Firebase routing hides rows).
(
  : >"$HOST_LOG"
  while true; do
    if [[ -f "$HOST_LOG" ]]; then
      RID="$(rg -o 'CAMERA_ROOM_ID=[0-9]+' "$HOST_LOG" 2>/dev/null | tail -1 | cut -d= -f2 || true)"
      if [[ -n "${RID:-}" ]]; then
        printf '{"roomId":"%s","source":"xuitest-live-stream","at":"%s"}\n' "$RID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          >"$ROOT/.local/camera-ab-room.json"
        echo "[same-room] Live-scraped CAMERA_ROOM_ID=$RID" >>"$AB_LOG"
        break
      fi
    fi
    sleep 2
  done
) &
SCRAPE_PID=$!

echo "[same-room] Waiting 8s for AB poller, then starting Host A XCUITest ($ONLY)…"
sleep 8

set +e
(
  IFS=',' read -ra TESTS <<< "$ONLY"
  ARGS=()
  for t in "${TESTS[@]}"; do
    ARGS+=(-only-testing:"$t")
  done
  UDID="${UNILIVE_IPHONE_UDID:-04E86E0A-14A3-524B-919C-EB7C477083EE}"
  ENV_FILE="$ROOT/.local/device-qa-uitest.env"
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$ENV_FILE" && set +a
  fi
  echo "[device-qa] Preserving Cap session (UNILIVE_DEVICE_QA_TERMINATE=${UNILIVE_DEVICE_QA_TERMINATE:-0})"
  cd "$ROOT/artifacts/instacollab/ios/UniLiveDeviceQA"
  xcodebuild test \
    -project UniLiveDeviceQA.xcodeproj \
    -scheme UniLiveDeviceQA \
    -destination "platform=iOS,id=$UDID" \
    "${ARGS[@]}"
) >"$HOST_LOG" 2>&1
HOST_EC=$?
set -e

ROOM_ID="$(rg -o 'CAMERA_ROOM_ID=[0-9]+' "$HOST_LOG" | tail -1 | cut -d= -f2 || true)"
if [[ -n "${ROOM_ID:-}" ]]; then
  printf '{"roomId":"%s","source":"xuitest-log","at":"%s"}\n' "$ROOM_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >"$ROOT/.local/camera-ab-room.json"
  echo "[same-room] Scraped CAMERA_ROOM_ID=$ROOM_ID"
fi

echo "[same-room] Waiting for AB harness (pid=$AB_PID)…"
set +e
wait "$AB_PID"
AB_EC=$?
set -e

echo "[same-room] HOST_EC=$HOST_EC AB_EC=$AB_EC"
echo "[same-room] HOST_LOG=$HOST_LOG"
echo "[same-room] AB_LOG=$AB_LOG"

LATEST_AB="$(ls -t "$LOG_DIR"/camera-remote-ab-*.json 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST_AB:-}" ]]; then
  echo "[same-room] AB_RESULT=$LATEST_AB"
  python3 - <<PY
import json
p="$LATEST_AB"
d=json.load(open(p))
r=d.get("result", d)
keys=["applicationRoomId","failClass","verdict","ViewerRoomDiscovery","ViewerRtcGrant","MacRemoteFrontFrames","HostParticipantFound"]
print({k: r.get(k) for k in keys})
PY
fi

if [[ "$HOST_EC" -ne 0 || "$AB_EC" -ne 0 ]]; then
  exit 1
fi
exit 0
