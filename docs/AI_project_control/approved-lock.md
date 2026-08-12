# Approved lock

Items below are locked. Do not redesign or silently change.

## Brand

- Spelling: **UniLive’s** (curly apostrophe)
- Legacy known-good mark path: `/brand/app-logo.png` (fallback until production logo is approved)
- Canonical IDs (existing): `brand.logo.primary`, `brand.logo.icon`, `brand.logo.animated`, `brand.splash.main`

## Character / kingdom rules

- Eight kingdoms: Sun, Ice, Forest, Fire, Ocean, Moon, Storm, Celestial
- Roles per kingdom: King, Queen, Prince, Princess, Baby Boy, Baby Girl
- Approved character references must not drift (face, body, outfit, horn, crown, hair, eyes, colors, proportions)
- Character turnaround boards are **reference-only**, never runtime assets

## Approved reference files currently on disk (character)

| Path | Lock |
|------|------|
| `unilives_master_source/references/character-master/approved/sun-baby-boy-360-turnaround-v1.png` | approved-reference-only |
| `unilives_master_source/references/character-master/approved/sun-baby-boy-360-turnaround-OWNER-MASTER.png` | approved-reference-only |
| `unilives_master_source/references/SUN_BABY_BOY/01_References/URL_SUN_BABY_BOY_TURNAROUND_MASTER_v001_APPROVED.png` | approved-reference-only |

## Product / runtime locks

- Do not change gift business IDs, prices, wallet, auth, routes, schemas, LiveKit/Supabase meaning, or legal copy unless explicitly requested
- Central resolver: `artifacts/instacollab/src/lib/unilives-assets/`
- Authoritative runtime manifest: `artifacts/instacollab/public/unilives-assets/manifest.json`

## Asset Studio safety locks

- `ASSET_STUDIO_DRY_RUN=true` by default
- `ASSET_STUDIO_MAX_PAID_CALLS=1`
- `ASSET_STUDIO_AUTO_RETRY=false`
- `ASSET_STUDIO_REQUIRE_APPROVAL=true`
- Never auto-mark `production-approved` / `installed`
