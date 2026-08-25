#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
UDID="${UNILIVE_IPHONE_UDID:-04E86E0A-14A3-524B-919C-EB7C477083EE}"
PROJECT="$ROOT/artifacts/instacollab/ios/UniLiveDeviceQA/UniLiveDeviceQA.xcodeproj"
ENV_FILE="$ROOT/.local/device-qa-uitest.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

ONLY="${1:-UniLiveDeviceQAUITests}"
TERMINATE="${UNILIVE_DEVICE_QA_TERMINATE:-0}"

if [[ "$TERMINATE" == "1" ]]; then
  echo "[device-qa] Terminating Cap app on $UDID (UNILIVE_DEVICE_QA_TERMINATE=1)"
  xcrun devicectl device process terminate --device "$UDID" com.uniapplab.unilive 2>/dev/null || true
  sleep 2
else
  echo "[device-qa] Preserving Cap session (set UNILIVE_DEVICE_QA_TERMINATE=1 to force terminate)"
fi

echo "[device-qa] Running XCUITest: $ONLY"
cd "$ROOT/artifacts/instacollab/ios/UniLiveDeviceQA"
xcodebuild test \
  -project UniLiveDeviceQA.xcodeproj \
  -scheme UniLiveDeviceQA \
  -destination "platform=iOS,id=$UDID" \
  -only-testing:"$ONLY"
