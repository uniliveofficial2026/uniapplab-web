# Final LiveKit Coupling Report (Stage B)

**Updated:** 2026-08-24 · **Baseline SHA:** `4786a68`

## Summary

Stage B **isolates** `livekit-client` to the adapter layer and a documented compatibility boundary. Direct static imports in `artifacts/instacollab/src` and `lib/` (excluding adapter) are **eliminated** as verified by CI scan.

| Metric | Stage A baseline | Stage B final |
|---|---|---|
| Direct `livekit-client` import files (app + lib) | ~22 | **1** (boundary only) |
| Adapter dynamic import | — | `@unilives/rtc-livekit` |
| `uiUxChanged` | false | **false** (unchanged) |

## Allowed import sites

| Path | Role |
|---|---|
| `artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts` | Documented re-export shim for attach/type paths during migration |
| `lib/unilives-rtc-livekit/index.mjs` | Production adapter — dynamic `import('livekit-client')` |

## CI enforcement

`scripts/test-stage-b.mjs` → `livekit_import_boundary_scan`:

```bash
rg -l "from ['\"]livekit-client['\"]" artifacts/instacollab/src lib \
  --glob '!**/node_modules/**'
```

**Current result:** 1 file (boundary only). **PASS.**

## Reference app coupling paths

### Migrated to UniLiveRTC provider

- `connectLiveKitRoom` in `liveKitInstant.ts` → `createLiveKitRTCProvider` from `@unilives/rtc-livekit`
- `createReferenceRtcProvider()` in `lib/unilive-rtc/index.ts`

### Still via compatibility boundary (interim)

These import **types and Room helpers** from `livekitCompatibilityBoundary.ts`, not `livekit-client` directly:

- `hostLiveKitRoom.ts` — host singleton still `new Room()` via boundary
- `liveRoomBus.ts`, `liveKitCallRuntime.ts`, publish helpers
- PK/live hooks and components (SoloLiveView, seat media, discovery preview)

**Target end-state:** delete boundary file when attach paths use `createUniLiveRTC().joinRoom()` exclusively.

## Server-side LiveKit

| Path | Coupling | Stage B note |
|---|---|---|
| `artifacts/api-server/src/lib/livekit.ts` | Token mint | Consumed by `@unilives/rtc-server` |
| `artifacts/api-server/src/routes/livekit.ts` | Legacy webhook | Parallel to `/v1/rtc/webhooks` normalize path |
| `lib/livekit/` | Workspace token helpers | Adapter-internal |

## Product API vs provider

- **Product RTC API:** UniLiveRTC (`GET /v1/health`)
- **Underlying media:** LiveKit (`productionMediaProvider: LiveKit`)
- **Cutover:** NOT_PERFORMED, NOT_REQUIRED_FOR_STAGE_B

## Cloudflare (non-production)

`lib/unilives-rtc-livekit/cloudflareQualification.mjs` — lab-only qualification probe; does not dual-publish or switch production SFU.

## Evidence

```bash
node scripts/test-stage-b.mjs
# livekit-client import sites: 1 (adapter+boundary only)
# livekit_import_boundary_scan PASS
```

See also `LIVEKIT-CLIENT-IMPORTS.txt` (inventory) and `PROVIDER-COUPLING-MANIFEST.md` (broader provider inventory including Firebase/Supabase).
