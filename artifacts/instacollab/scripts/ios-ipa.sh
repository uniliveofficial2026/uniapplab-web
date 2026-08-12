#!/usr/bin/env bash
# Build an iOS archive and export a signed IPA (requires Xcode + Apple signing).
#
# Usage:
#   ./scripts/ios-ipa.sh              # offline bundled (default)
#   ./scripts/ios-ipa.sh --live       # live shell → app.uniapplab.com
#   ./scripts/ios-ipa.sh --skip-sync  # xcodebuild only (already synced)
#
# Output:
#   exports/UniLive-ios-<stamp>-v{versionName}.ipa

set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$APP/../.." && pwd)"
IOS="$APP/ios/App"
EXPORTS="$ROOT/exports"
ARCHIVE="$APP/ios/build/UniLive.xcarchive"
EXPORT_DIR="$APP/ios/build/ipa-export"

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

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "FAIL: xcodebuild not found (macOS + Xcode required)" >&2
  exit 1
fi

echo "==> UniLive iOS IPA (mode=$MODE)"

if [[ "$SKIP_SYNC" -eq 0 ]]; then
  if [[ "$MODE" == "live" ]]; then
    echo "==> cap:sync:live (https://app.uniapplab.com)"
    pnpm run cap:sync:live
  else
    echo "==> cap:sync (bundled dist/public)"
    pnpm run cap:sync
  fi

  if [[ -f "$IOS/Podfile" ]]; then
    echo "==> pod install"
    (cd "$IOS" && pod install)
  fi
else
  echo "==> skip sync"
fi

WORKSPACE="$IOS/App.xcworkspace"
PROJECT="$IOS/App.xcodeproj"
if [[ -d "$WORKSPACE" ]]; then
  BUILD_TARGET=(-workspace "$WORKSPACE" -scheme App)
else
  BUILD_TARGET=(-project "$PROJECT" -scheme App)
fi

mkdir -p "$APP/ios/build"
rm -rf "$ARCHIVE" "$EXPORT_DIR"

resolve_development_team() {
  if [[ -n "${DEVELOPMENT_TEAM:-}" ]]; then
    if [[ "$DEVELOPMENT_TEAM" == "YOUR_TEAM_ID" ]]; then
      echo "FAIL: DEVELOPMENT_TEAM is still the placeholder YOUR_TEAM_ID." >&2
      echo "      Use your 10-character Apple Team ID, or omit it to auto-detect from Xcode." >&2
      exit 1
    fi
    echo "$DEVELOPMENT_TEAM"
    return
  fi
  python3 - <<'PY'
import plistlib
from pathlib import Path
p = Path.home() / "Library/Preferences/com.apple.dt.Xcode.plist"
if not p.exists():
    raise SystemExit("FAIL: set DEVELOPMENT_TEAM or sign in to Xcode (Settings → Accounts)")
data = plistlib.loads(p.read_bytes())
teams = data.get("IDEProvisioningTeamByIdentifier") or {}
seen = []
for account_teams in teams.values():
    if not isinstance(account_teams, list):
        continue
    for team in account_teams:
        tid = team.get("teamID")
        if tid and tid not in seen:
            seen.append(tid)
if not seen:
    raise SystemExit("FAIL: no Apple team in Xcode — open Xcode → Settings → Accounts")
print(seen[0])
PY
}

DEV_TEAM="$(resolve_development_team)"
echo "==> signing team: $DEV_TEAM"

echo "==> xcodebuild archive"
xcodebuild \
  "${BUILD_TARGET[@]}" \
  -configuration Release \
  -archivePath "$ARCHIVE" \
  -destination "generic/platform=iOS" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$DEV_TEAM" \
  ASSETCATALOG_COMPILER_SKIP_APP_STORE_DEPLOYMENT=YES \
  COMPRESS_PNG_FILES=NO \
  -allowProvisioningUpdates \
  archive

EXPORT_OPTS="$APP/ios/build/ExportOptions.plist"
cat > "$EXPORT_OPTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>development</string>
  <key>teamID</key>
  <string>${DEV_TEAM}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>compileBitcode</key>
  <false/>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
PLIST

echo "==> xcodebuild exportArchive"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTS"

IPA_SRC="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
if [[ -z "$IPA_SRC" || ! -f "$IPA_SRC" ]]; then
  echo "FAIL: IPA not produced under $EXPORT_DIR" >&2
  exit 1
fi

VERSION_NAME="$(python3 - <<'PY'
import re
from pathlib import Path
t=Path("ios/App/App.xcodeproj/project.pbxproj").read_text()
m=re.search(r'MARKETING_VERSION = ([^;]+);', t)
print(m.group(1).strip() if m else "1.0")
PY
)"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EXPORTS"
OUT_NAME="UniLive-ios-${STAMP}-v${VERSION_NAME}.ipa"
OUT_PATH="$EXPORTS/$OUT_NAME"
cp -f "$IPA_SRC" "$OUT_PATH"
cp -f "$IPA_SRC" "$EXPORTS/UniLive-ios-latest.ipa"

BYTES=$(stat -f%z "$OUT_PATH")
MB=$(python3 -c "print(round($BYTES/1024/1024, 2))")

{
  echo "bundle=com.uniapplab.unilive"
  echo "versionName=$VERSION_NAME"
  echo "mode=$MODE"
  echo "ipa_build=$IPA_SRC"
  echo "ipa_export=$OUT_PATH"
  echo "bytes=$BYTES"
  echo "mb=$MB"
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$EXPORTS/${OUT_NAME%.ipa}.MANIFEST.txt"

echo "OK: signed IPA"
echo "  build:  $IPA_SRC"
echo "  export: $OUT_PATH"
echo "  latest: $EXPORTS/UniLive-ios-latest.ipa"
echo "  versionName=$VERSION_NAME (${MB}MB)"
