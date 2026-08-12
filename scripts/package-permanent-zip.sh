#!/usr/bin/env bash
# Build a permanent, portable Universal-Fixer zip under 500MB.
# Excludes secrets, caches, native build trees, vendor archives, and regenerable blobs.
#
# Usage:
#   ./scripts/package-permanent-zip.sh
#   ./scripts/package-permanent-zip.sh --max-mb 500
#
# Output:
#   exports/Universal-Fixer-permanent-<timestamp>.zip
#   exports/Universal-Fixer-permanent-latest.zip  (stable symlink/copy)

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
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/uf-permanent-XXXXXX")"
NAME="Universal-Fixer-permanent-${STAMP}"
DEST="$STAGE/$NAME"
ZIP_PATH="$OUT_DIR/${NAME}.zip"
LATEST="$OUT_DIR/Universal-Fixer-permanent-latest.zip"
MANIFEST="$OUT_DIR/${NAME}.MANIFEST.txt"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

echo "==> Phase 12 check"
if [[ ! -d docs/unilives-assets ]]; then
  echo "FAIL: docs/unilives-assets missing (Phase 12 project not found)" >&2
  exit 1
fi
echo "Phase 12 project found"

echo "==> Staging portable tree (no secrets / caches / heavy regenerables)"
mkdir -p "$DEST"
rsync -a \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude '.local/' \
  --exclude '**/.local/' \
  --exclude '.vercel/' \
  --exclude '.cursor/' \
  --exclude '.agents/' \
  --exclude 'exports/' \
  --exclude 'scripts/.tools/' \
  --exclude 'artifacts/instacollab/dist/' \
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

# Strip AppleDouble / Finder junk that can mirror secret filenames
find "$DEST" \( -name '._*' -o -name '.DS_Store' \) -delete 2>/dev/null || true

# Templates only — never copy live secrets
if [[ -f .env.providers.example ]]; then
  cp .env.providers.example "$DEST/.env.providers.example"
fi

# Hard fail if any secret env leaked into the stage
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

# Write archive contents note inside the package
cat > "$DEST/PERMANENT-PACKAGE.txt" <<EOF
Universal-Fixer permanent portable package
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Limit: ${MAX_MB}MB

INCLUDED
- App/source trees needed for cross-tool workflows
- Phase 12 docs: docs/unilives-assets/
- Workspace config, scripts, workers, supabase, lib
- .env.providers.example (templates only)
- README-FOR-AI-AGENT.md (start here for other AI models)

EXCLUDED (regenerate locally / keep secrets outside zip)
- .env / .env.local / .env.*.local  (permanent keys stay at Universal-Fixer/.env.local)
- node_modules/, .git/, .local/, .vercel/
- Native android/ios trees + vendor/archives (DeepAR zips)
- DeepAR public effect/runtime blobs (install via deepar:install)
- unilives_master_source/models/
- Previous exports/*.zip

After unzip on another machine:
  1. Read README-FOR-AI-AGENT.md
  2. Copy your permanent keys into Universal-Fixer/.env.local
     (use .env.providers.example as the key-name checklist)
  3. pnpm install
  4. test -d docs/unilives-assets && echo "Phase 12 project found"
EOF

cat > "$DEST/README-FOR-AI-AGENT.md" <<'EOF'
# Universal-Fixer — handoff for other AI models

This zip is the portable Universal-Fixer workspace (under 500MB).
It is ready to upload into ChatGPT, Claude, Cursor, Codex, Gemini, or similar tools.

## First checks

```bash
test -d docs/unilives-assets && echo "Phase 12 project found"
ls package.json pnpm-workspace.yaml artifacts/instacollab
```

## What this package is

- Brand / app: **UniLive’s**
- Main app: `artifacts/instacollab/`
- Phase 12 migration docs: `docs/unilives-assets/`
- Shared libs / workers / supabase: `lib/`, `workers/`, `supabase/`
- Character / Meshy docs: `unilives_master_source/docs/` (models excluded to stay under 500MB)

## Secrets (never in this zip)

Permanent local key file on the owner machine:

`Universal-Fixer/.env.local`

Required provider key **names** (never `VITE_`):

```
OPENAI_API_KEY=
MESHY_API_KEY=
ELEVENLABS_API_KEY=
RUNWAY_API_KEY=
KLING_API_KEY=
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
```

Only include the Kling format supported by the owner’s Kling account.
See `.env.providers.example`.

Do **not** invent or request secret values into chat unless the owner pastes them.

## After unzip

```bash
pnpm install
pnpm --filter @workspace/instacollab typecheck
```

DeepAR / native / large media are intentionally excluded. Restore with local install scripts when needed.

## Hard rules for agents

1. Do not commit `.env`, `.env.local`, or `.env.*.local`
2. Do not put provider secrets in `VITE_*` vars
3. Prefer editing `artifacts/instacollab/` for product UI/live/camera work
4. Keep Phase 12 docs intact under `docs/unilives-assets/`
5. Rebuild this package with: `./scripts/package-permanent-zip.sh`
EOF

echo "==> Zipping"
(
  cd "$STAGE"
  # -X omit macOS extra attrs; -y store symlinks as links
  zip -qrX "$ZIP_PATH" "$NAME"
)

BYTES=$(stat -f%z "$ZIP_PATH")
MB=$(python3 -c "print(round($BYTES/1024/1024, 2))")

{
  echo "archive=$ZIP_PATH"
  echo "bytes=$BYTES"
  echo "mb=$MB"
  echo "max_mb=$MAX_MB"
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
