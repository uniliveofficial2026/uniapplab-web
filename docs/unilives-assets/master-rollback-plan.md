# Master rollback plan (recovery 2026-07-30)

## Runtime visual rollback

1. Keep feature components on centralized resolvers (`src/lib/unilives-assets/*`).
2. If new media misbehaves, set asset `productionStatus` back to `missing` / remove formats so resolvers use `fallback` (legacy `/brand/app-logo.png` and `/live-gifts/*.svga`).
3. Do not change business IDs, gift prices, permissions, or legal meaning during rollback.

## Structure rollback

- `production/unilives-assets/` may be emptied of media; keep folder scaffold.
- `public/unilives-assets/manifest.json` can be regenerated from `seed.json`.
- Prior export under `exports/unilives-migration-phase12-*` is historical reference only.

## Forbidden during rollback

- Deploying partial fake production files
- Registering whole boards as runtime assets
- Granting entitlements via media presence
