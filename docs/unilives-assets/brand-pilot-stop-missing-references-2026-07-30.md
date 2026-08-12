# Brand pilot STOP — missing approved references

Date: 2026-07-30  
Pilot scope: primary logo + application icon + default animated splash only  
Action taken: **stopped before any paid API call** (Meshy / Runway / Kling / OpenAI / ElevenLabs)

## Canonical IDs resolved (existing — not invented)

| Role | Canonical ID | Seed name | Declared runtime path |
|------|--------------|-----------|------------------------|
| Primary UniLive’s logo | `brand.logo.primary` | Primary logo | `/unilives-assets/brand/logos/primary/logo-primary.{png,webp,svg}` |
| Application icon | `brand.logo.icon` | App icon mark | `/unilives-assets/brand/logos/icon/logo-icon.{png,webp,svg}` |
| Default animated splash | `brand.logo.animated` | Animated logo | `/unilives-assets/brand/logos/animated/logo-animated.{webm,json,webp}` |

Related (not generated this pilot; static splash layout companion): `brand.splash.main` → `/unilives-assets/brand/splash/splash-main.{png,webp}`

## Gate A — reference validation (FAILED)

Per production manual Gate A and pilot rule §3: every required approved reference must **physically exist** before spending API credits.

### What exists on disk (insufficient)

| Path | Classification | Why it is not enough |
|------|----------------|----------------------|
| `artifacts/instacollab/public/brand/app-logo.png` | legacy fallback | RGB (no alpha); not listed as `approved-reference-only`; not a transparent logo master |
| `docs/unilives-assets/phase-1-screenshots/00-known-good-brand-mark.png` | known-good capture | Same legacy mark; not APPROVED brand master |
| Sun Baby Boy turnaround PNGs under `unilives_master_source/references/**/approved*` | approved character boards | Character turnarounds — **not** logo/icon/splash masters; boards must not be used as runtime brand assets |

### Approved-reference ledger status for brand/splash

**No approved-reference-only entries** for logo, app icon, or splash animation/layout.

## Exact required filenames (missing — place under references before re-run)

Using the production-manual `URL_*_APPROVED` naming pattern and seed deliverable intent. Place individual files under:

`production/unilives-assets/references/branding/`  
and/or  
`unilives_master_source/references/branding/approved/`

### 1) Primary logo (`brand.logo.primary`)

| Required filename | Purpose |
|-------------------|---------|
| `URL_BRAND_LOGO_PRIMARY_TRANSPARENT_v001_APPROVED.png` | Individual transparent primary logo master (RGBA), preserving UniLive’s lettering + unicorn mark exactly |
| `URL_BRAND_LOGO_PRIMARY_LETTERING_v001_APPROVED.png` | Optional lockup if lettering is a separate approved layer |

### 2) Application icon (`brand.logo.icon`)

| Required filename | Purpose |
|-------------------|---------|
| `URL_BRAND_LOGO_ICON_512_v001_APPROVED.png` | Individual 512×512 app icon master (safe margins for maskable later) |

### 3) Default animated splash (`brand.logo.animated` + splash layout)

| Required filename | Purpose |
|-------------------|---------|
| `URL_BRAND_SPLASH_LAYOUT_v001_APPROVED.png` | Approved splash composition/layout (no buttons, no seasonal theme) |
| `URL_BRAND_SPLASH_CHARACTER_STILL_v001_APPROVED.png` | Individual character still matching approved face/body for splash (not a multi-character board) |
| `URL_BRAND_SPLASH_ANIMATION_SPEC_v001_APPROVED.md` | Owner-approved motion/lip-sync/sound brief: blink, eyes, mouth for “UniLive’s”, breath, hair/cloth, magical bed sound |
| `URL_BRAND_SPLASH_VOICE_SCRIPT_v001_APPROVED.txt` | Exact spoken line: `UniLive’s` only |

## What was NOT done

- No Meshy / Runway / Kling / OpenAI / ElevenLabs calls
- No inventing IDs or redesigns
- No marking assets production-approved
- No deploy / push / merge / publish
- No other asset categories started

## Next step (owner)

1. Add the missing `*_APPROVED` individual reference files listed above (exact filenames).  
2. Update `docs/unilives-assets/approved-reference-ledger.md` to classify them `approved-reference-only`.  
3. Re-run this pilot; then one lowest-cost paid generation per asset max, draft/preview only.
