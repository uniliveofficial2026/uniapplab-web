# UniLive’s production asset system

Official product name: **UniLive’s** (exact spelling).

Code / filesystem identifiers may use `unilives` only when required by JavaScript or path conventions.

## Rules

1. **Never hardcode** `/unilives-assets/...` paths inside screens or reusable UI.
   Use `resolveAsset(id)` / `getAssetUrl(id)` from `@/lib/unilives-assets`.
2. Every asset has one deterministic canonical ID (e.g. `gift.legendary.phoenix`).
3. Duplicate IDs are rejected in development and CI.
4. Missing production files are marked `status: "missing"` — **do not invent** SVGA/WebM/PNG/audio.
5. Concept-board images are references only — not production assets.
6. Prefer format order for gifts: SVGA → WebM → JSON → animated WebP → static WebP → PNG.
7. Preserve existing business IDs (wallet, history, rankings, realtime, admin gifts, DB).
8. Replace visuals through `manifests/replacement-map.json`, not destructive renames.
9. Remove emoji artwork only after the UniLive’s production asset is validated.
10. Keep legacy files (e.g. `/live-gifts/`, `/brand/`) until validation gates pass.

## Layout

See the directory tree under this folder. Manifests live in `manifests/`.

## Resolver API

```ts
import {
  resolveAsset,
  getAssetUrl,
  getAssetFallback,
  preloadAsset,
  validateAssetRegistry,
  listMissingAssets,
} from '@/lib/unilives-assets';
```

## Local safety

Do not deploy, push, merge, delete old assets, or replace screens until human approval.
