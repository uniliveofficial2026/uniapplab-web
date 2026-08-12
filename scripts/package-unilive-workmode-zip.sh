#!/usr/bin/env bash
# Build one clean UniLive’s work-mode pack zip under 500MB.
# Excludes: node_modules, dist, build, .git, old zips, mp4s, real env files.
#
# Usage:
#   ./scripts/package-unilive-workmode-zip.sh
#   ./scripts/package-unilive-workmode-zip.sh --max-mb 500
#
# Output:
#   exports/UniLive-workmode-<timestamp>.zip
#   exports/UniLive-workmode-latest.zip

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MAX_MB=500
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-mb)
      MAX_MB="${2:?}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

MAX_BYTES=$((MAX_MB * 1024 * 1024))
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/exports"
mkdir -p "$OUT_DIR"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/uf-workmode-XXXXXX")"
NAME="UniLive-workmode-${STAMP}"
DEST="$STAGE/$NAME"
ZIP_PATH="$OUT_DIR/${NAME}.zip"
LATEST="$OUT_DIR/UniLive-workmode-latest.zip"
MANIFEST="$OUT_DIR/${NAME}.MANIFEST.txt"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

echo "Repo root: $ROOT"
echo "==> Control docs check"
if [[ ! -d docs/AI_project_control ]]; then
  echo "FAIL: docs/AI_project_control missing" >&2
  exit 1
fi
if [[ ! -d docs/unilives-assets ]]; then
  echo "FAIL: docs/unilives-assets missing (Phase 12)" >&2
  exit 1
fi
echo "OK: docs/AI_project_control + Phase 12 present"

echo "==> Staging work-mode tree"
mkdir -p "$DEST"
rsync -a \
  --exclude 'node_modules/' \
  --exclude '**/node_modules/' \
  --exclude 'dist/' \
  --exclude '**/dist/' \
  --exclude 'build/' \
  --exclude '**/build/' \
  --exclude '.git/' \
  --exclude '.local/' \
  --exclude '**/.local/' \
  --exclude '.vercel/' \
  --exclude '.cursor/' \
  --exclude '.agents/' \
  --exclude 'exports/' \
  --exclude 'scripts/.tools/' \
  --exclude 'artifacts/instacollab/android/' \
  --exclude 'artifacts/instacollab/ios/' \
  --exclude 'artifacts/instacollab/vendor/archives/' \
  --exclude 'artifacts/instacollab/public/effects/' \
  --exclude 'artifacts/instacollab/public/deepar-resources/' \
  --exclude 'artifacts/instacollab/public/deepar-beauty/' \
  --exclude 'artifacts/instacollab/public/trtc-webar/backgrounds/' \
  --exclude 'unilives_master_source/models/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.*.local' \
  --exclude '.env.meshy.local' \
  --exclude '.env*.local' \
  --exclude '.env*.bak*' \
  --exclude '.env.local.bak*' \
  --exclude '*.mp4' \
  --exclude '*.zip' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude '**/._*' \
  ./ "$DEST/"

find "$DEST" \( -name '._*' -o -name '.DS_Store' \) -delete 2>/dev/null || true

# Templates only
if [[ -f docs/AI_project_control/env.example ]]; then
  cp docs/AI_project_control/env.example "$DEST/docs/AI_project_control/env.example"
fi
if [[ -f .env.providers.example ]]; then
  cp .env.providers.example "$DEST/.env.providers.example"
fi

if find "$DEST" \( \
    -name '.env' -o -name '.env.local' -o -name '.env.*.local' -o -name '.env.meshy.local' \
    -o -name '._.env' -o -name '._.env.local' -o -name '._.env.*.local' \
    -o -name '.env*.bak*' -o -name '.env.local.bak*' \
  \) | grep -q .; then
  echo "FAIL: secret env file leaked into package stage" >&2
  find "$DEST" \( \
      -name '.env' -o -name '.env.local' -o -name '.env.*.local' -o -name '.env.meshy.local' \
      -o -name '._.env' -o -name '._.env.local' -o -name '._.env.*.local' \
      -o -name '.env*.bak*' -o -name '.env.local.bak*' \
    \) >&2
  exit 1
fi

if find "$DEST" -name '*.mp4' | grep -q .; then
  echo "FAIL: mp4 leaked into package stage" >&2
  exit 1
fi
if find "$DEST" -name '*.zip' | grep -q .; then
  echo "FAIL: zip leaked into package stage" >&2
  exit 1
fi

cat > "$DEST/WORKMODE-PACKAGE.txt" <<EOF
UniLive’s work-mode portable package
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Limit: ${MAX_MB}MB
Repo root (origin): $ROOT

INCLUDED
- docs/AI_project_control/ (AI work-mode control)
- docs/unilives-assets/ (Phase 12)
- artifacts/, lib/, scripts/, workers/, supabase/, config/
- env templates only (docs/AI_project_control/env.example)

EXCLUDED
- node_modules/, dist/, build/, .git/
- exports/*.zip and other zips
- *.mp4
- .env / .env.local / .env.*.local (real secrets)
- heavy regenerables (DeepAR blobs, native trees, master models)

Start here after unzip:
  docs/AI_project_control/README.md
Then:
  cp docs/AI_project_control/env.example .env.local
  # fill keys locally — never commit
  pnpm install
  ./scripts/check-unilive-env.sh
EOF

echo "==> Zipping"
(
  cd "$STAGE"
  zip -qrX "$ZIP_PATH" "$NAME"
)

BYTES=$(stat -f%z "$ZIP_PATH")
MB=$(python3 -c "print(round($BYTES/1024/1024, 2))")

{
  echo "archive=$ZIP_PATH"
  echo "bytes=$BYTES"
  echo "mb=$MB"
  echo "max_mb=$MAX_MB"
  echo "control=docs/AI_project_control"
  echo "phase12=docs/unilives-assets"
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "top_level:"
  (cd "$DEST" && ls -1)
} > "$MANIFEST"

cp -f "$ZIP_PATH" "$LATEST"

echo "==> Size gate"
if (( BYTES > MAX_BYTES )); then
  echo "FAIL: package is ${MB}MB > ${MAX_MB}MB limit" >&2
  echo "See $MANIFEST" >&2
  rm -f "$ZIP_PATH" "$LATEST"
  exit 1
fi

echo "OK: ${MB}MB <= ${MAX_MB}MB"
echo "zip: $ZIP_PATH"
echo "latest: $LATEST"
echo "manifest: $MANIFEST"
