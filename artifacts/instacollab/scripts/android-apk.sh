#!/usr/bin/env bash
# Build a signed release APK for sideload / direct install.
#
# Usage:
#   ./scripts/android-apk.sh              # offline bundled (default)
#   ./scripts/android-apk.sh --live       # live shell → app.uniapplab.com
#   ./scripts/android-apk.sh --skip-sync  # gradle only (already synced)
#
# Output:
#   android/app/build/outputs/apk/release/app-release.apk
#   exports/UniLive-<stamp>-v{versionName}-vc{versionCode}.apk

set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$APP/../.." && pwd)"
ANDROID="$APP/android"
EXPORTS="$ROOT/exports"

MODE="offline"
SKIP_SYNC=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --live) MODE="live"; shift ;;
    --skip-sync) SKIP_SYNC=1; shift ;;
    -h|--help)
      sed -n '2,11p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

cd "$APP"

if [[ ! -f "$ANDROID/key.properties" ]]; then
  echo "FAIL: missing $ANDROID/key.properties" >&2
  exit 1
fi

STORE_FILE="$(python3 - <<'PY'
from pathlib import Path
d={}
for line in Path("android/key.properties").read_text().splitlines():
    if "=" in line:
        k,v=line.split("=",1); d[k]=v
print(d.get("storeFile",""))
PY
)"
if [[ -z "$STORE_FILE" || ! -f "$ANDROID/$STORE_FILE" ]]; then
  echo "FAIL: keystore not found at android/$STORE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ANDROID/local.properties" ]]; then
  echo "FAIL: missing android/local.properties (sdk.dir=...)" >&2
  exit 1
fi

if [[ ! -x "$ANDROID/gradlew" ]]; then
  chmod +x "$ANDROID/gradlew"
fi

echo "==> UniLive APK (mode=$MODE)"

if [[ "$SKIP_SYNC" -eq 0 ]]; then
  if [[ "$MODE" == "live" ]]; then
    echo "==> cap:sync:live (https://app.uniapplab.com)"
    pnpm run cap:sync:live
  else
    echo "==> cap:sync (bundled dist/public)"
    pnpm run cap:sync
  fi
else
  echo "==> skip sync"
fi

echo "==> assembleRelease"
(
  cd "$ANDROID"
  ./gradlew :app:assembleRelease --no-daemon
)

APK_SRC="$ANDROID/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK_SRC" ]]; then
  echo "FAIL: APK not produced at $APK_SRC" >&2
  exit 1
fi

VERSION_CODE="$(python3 - <<'PY'
import re
from pathlib import Path
t=Path("android/app/build.gradle").read_text()
print(re.search(r"versionCode\s+(\d+)", t).group(1))
PY
)"
VERSION_NAME="$(python3 - <<'PY'
import re
from pathlib import Path
t=Path("android/app/build.gradle").read_text()
print(re.search(r'versionName\s+"([^"]+)"', t).group(1))
PY
)"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EXPORTS"
OUT_NAME="UniLive-${STAMP}-v${VERSION_NAME}-vc${VERSION_CODE}.apk"
OUT_PATH="$EXPORTS/$OUT_NAME"
cp -f "$APK_SRC" "$OUT_PATH"
cp -f "$APK_SRC" "$EXPORTS/UniLive-latest.apk"

BYTES=$(stat -f%z "$OUT_PATH")
MB=$(python3 -c "print(round($BYTES/1024/1024, 2))")

{
  echo "package=com.uniapplab.unilive"
  echo "versionName=$VERSION_NAME"
  echo "versionCode=$VERSION_CODE"
  echo "mode=$MODE"
  echo "apk_build=$APK_SRC"
  echo "apk_export=$OUT_PATH"
  echo "bytes=$BYTES"
  echo "mb=$MB"
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$EXPORTS/${OUT_NAME%.apk}.MANIFEST.txt"

echo "OK: signed APK"
echo "  build:  $APK_SRC"
echo "  export: $OUT_PATH"
echo "  latest: $EXPORTS/UniLive-latest.apk"
echo "  versionName=$VERSION_NAME versionCode=$VERSION_CODE (${MB}MB)"
