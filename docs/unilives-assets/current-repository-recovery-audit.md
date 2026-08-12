# UniLive’s current repository recovery audit

Generated: 2026-07-30 (local single-source repair)  
Repository: `/Volumes/Wei2TB/Universal-Fixer`  
Branch (at audit): `fix/vercel-api-root-now`  
Scope: honest disk inventory — no invented Phase 12 PASS results, no fake production binaries.

## Classification legend

| Label | Meaning |
|-------|---------|
| physically present | File exists on disk in this repository |
| referenced but missing | Declared in seed/manifests but file not on disk |
| reported previously but not present | Mentioned in older Phase 12 docs/exports but not in live tree as claimed production media |
| duplicated | Same logical content or overlapping IDs/paths |
| legacy fallback | Pre-migration public media still used at runtime |
| approved reference only | Design/spec reference — not runtime production |
| approved individual production asset | Individual file exists **and** was explicitly production-approved |
| unknown | Insufficient evidence |

## Executive findings

1. **Phase 12 documentation is physically present** under `docs/unilives-assets/` (~70 markdown files). It was **not** missing from this repository.
2. **Runtime asset system is present**: `artifacts/instacollab/src/lib/unilives-assets/` (resolver, registry, seed v10, 259 assets) + `public/unilives-assets/` category trees + category manifests.
3. **All 259 seed assets remain `status: "missing"`** — no UniLive’s production binaries installed for registry IDs.
4. **`production/unilives-assets/`** scaffold restored during this repair (masters/previews/audio/models/textures/animations/references + category folders). Contains **no** production media (gitkeep only).
5. **Approved individual production assets: 0.** Physically present media under `/unilives-assets/` is preview/scaffold only and is **not** labeled production-approved.
6. Legacy fallbacks remain the safe runtime path (`/brand/app-logo.png`, `/live-gifts/*.svga`).
7. `.env.local` is present and gitignored; provider keys are configured by name only (values not recorded here). No secrets behind new `VITE_` prefixes were introduced by this repair.

## Physically present

### Phase 12 / docs
- `docs/unilives-assets/` — Phase 1–12 reports, final-* audits, inventories, blockers, rollback plan

### Resolver / registry
- `artifacts/instacollab/src/lib/unilives-assets/*.ts`
- `artifacts/instacollab/src/lib/unilives-assets/seed.json` (version 10, 259 assets, 159 replacement mappings)

### Public runtime tree (non-media + scarce media)
- `README.md`
- `characters/README.md`
- `characters/audio/mascot-ambient.mp3`
- `characters/review/unilives-unicorn-meshy-review-v1.glb`
- `characters/unilives-mascot.glb`
- `manifests/auth.manifest.json`
- `manifests/badges.manifest.json`
- `manifests/brand.manifest.json`
- `manifests/discovery.manifest.json`
- `manifests/frames.manifest.json`
- `manifests/gifts.manifest.json`
- `manifests/index.manifest.json`
- `manifests/interactions.manifest.json`
- `manifests/legal.manifest.json`
- `manifests/onboarding.manifest.json`
- `manifests/profile-setup.manifest.json`
- `manifests/replacement-map.json`
- `manifests/rings.manifest.json`
- `manifests/rooms.manifest.json`
- `manifests/sharing.manifest.json`
- `manifests/stickers.manifest.json`

### Legacy fallbacks (working)
- `/brand/app-logo.png`
- `/live-gifts/mic.svga`
- `/live-gifts/star.svga`
- `/live-gifts/crown.svga`
- `/live-gifts/rocket.svga`

### Design references / models (not runtime production)
- `unilives_master_source/references/` — 22 files
- `unilives_master_source/models/` — 86 files (Meshy review / draft models)
- `assets-source/unilives-character/` — source pipeline stubs
- `exports/unilives-migration-phase12-chatgpt-agent-20260723-072913/` — prior export package (historical; not authoritative for current PASS)

### Production scaffold (this repair)
- `production/unilives-assets/{masters,previews,audio,models,textures,animations,references}/` + category folders

## Referenced but missing

All seed `formats.*` paths under `/unilives-assets/...` for the **259** registry IDs are missing as production binaries.

Category counts in seed:

| Category | Count |
|----------|------:|
| gift | 70 |
| discovery | 43 |
| auth | 20 |
| profile-setup | 20 |
| sharing | 17 |
| badge | 16 |
| onboarding | 15 |
| brand | 13 |
| legal | 13 |
| sticker | 12 |
| seat-interaction | 10 |
| avatar-ring | 6 |
| frame | 4 |

Replacement map statuses: {'wired-with-fallback': 146, 'blocked-missing-asset': 5, 'not-in-phase': 8}

## Reported previously but not present

Prior Phase 12 reports (2026-07-23) claim typecheck baseline / build PASS / registry PASS with 259 missing. Those **command results are not re-copied as truth** in this recovery. They must be re-run (see verification section of the stop-for-review report).

No prior report’s claim of installed production UniLive’s gift/sticker/ring/frame/splash binaries is backed by files in `public/unilives-assets/` today.

## Duplicated

- Docs duplicated between live `docs/unilives-assets/` and `exports/unilives-migration-phase12-chatgpt-agent-*/docs/unilives-assets/`.
- Multiple Sun Baby Boy turnaround PNGs under references (`approved/`, `SUN_BABY_BOY/`, `meshy-input*`) — **reference duplicates**, not runtime IDs.
- Seed IDs: duplicate canonical ID check is enforced by registry (`rejectDuplicateIds`); recovery validation scripts re-check.

## Legacy fallback

- Brand: `/brand/app-logo.png`
- Gifts: `/live-gifts/{mic,star,crown,rocket}.svga` + legacy manifest
- PWA/icons listed in `LEGACY_PUBLIC_ASSETS` inside `fallbacks.ts`

## Approved reference only

See `approved-reference-ledger.md`. Boards/turnarounds are **never** runtime assets.

Notable:
- `unilives_master_source/references/character-master/approved/sun-baby-boy-360-turnaround-v1.png`
- `.../sun-baby-boy-360-turnaround-OWNER-MASTER.png`
- `.../SUN_BABY_BOY/01_References/URL_SUN_BABY_BOY_TURNAROUND_MASTER_v001_APPROVED.png`
- Spec docs under `unilives_master_source/docs/`

## Approved individual production asset

**None.** No registry ID has `approvalStatus: production-approved` with an existing individual runtime file.

## Unknown

- Whether historical Meshy GLBs under `unilives_master_source/models/` match a future approved kingdom SKU (not production-bound here).
- Whether `characters/unilives-mascot.glb` corresponds to any approved kingdom character (treated as preview-only).

## Env key presence (names only)

Configured in `.env.local` (values not disclosed): OPENAI_API_KEY, MESHY_API_KEY, ELEVENLABS_API_KEY, RUNWAY_API_KEY, KLING_API_KEY / KLING_ACCESS_KEY / KLING_SECRET_KEY, plus app/infra keys.  
`.env.local` remains gitignored.

## Confirmation

No deploy, push, merge, publish, or production upload performed during this audit generation.
