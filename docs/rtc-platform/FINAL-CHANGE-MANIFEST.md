# Stage B Change Manifest

**Baseline SHA:** `4786a68` · **Branch:** `fix/vercel-api-root-now` · **Seal tip:** `2f3c18315ed6380a27b684275260d1300d12fcb7` · **Impl:** `a6b2e43faac6c137fd899e4b3f64120e196ef79b`

## New packages (`lib/unilives-*`)

| Path | Package name |
|---|---|
| `lib/unilives-rtc-contracts/` | `@unilives/rtc-contracts` |
| `lib/unilives-rtc-core/` | `@unilives/rtc-core` |
| `lib/unilives-rtc-client/` | `@unilives/rtc-client` |
| `lib/unilives-rtc-server/` | `@unilives/rtc-server` |
| `lib/unilives-rtc-livekit/` | `@unilives/rtc-livekit` |
| `lib/unilives-rtc-fake/` | `@unilives/rtc-fake` |
| `lib/unilives-rtc-qoe/` | `@unilives/rtc-qoe` |
| `lib/unilives-platform-core/` | `@unilives/platform-core` |
| `lib/unilives-sdk/` | `@unilives/sdk` |
| `lib/unilives-mcp/` | `@unilives/mcp` |
| `lib/unilives-cli/` | `@unilives/cli` |
| `lib/unilives-auth/` | `@unilives/auth` |
| `lib/unilives-database/` | `@unilives/database` |
| `lib/unilives-storage/` | `@unilives/storage` |
| `lib/unilives-realtime/` | `@unilives/realtime` |
| `lib/unilives-deploy/` | `@unilives/deploy` |
| `lib/unilives-git/` | `@unilives/git` |
| `lib/unilives-observe/` | `@unilives/observe` |
| `lib/unilives-ui/` | `@unilives/ui` |

## New / updated scripts

| Path | Purpose |
|---|---|
| `scripts/test-stage-b.mjs` | Stage B unit/integration suite (16 tests) |

## API server

| Path | Change |
|---|---|
| `artifacts/api-server/src/routes/uniliveV1.ts` | **New** — `/api/v1/*` platform routes |
| `artifacts/api-server/src/routes/index.ts` | Mount uniliveV1 router |
| `artifacts/api-server/package.json` | `@unilives/platform-core`, `@unilives/rtc-server` deps |

## Reference app (facade only — no UI redesign)

| Path | Change |
|---|---|
| `artifacts/instacollab/src/lib/unilive-rtc/index.ts` | UniLiveRTC facade + provider factory |
| `artifacts/instacollab/src/lib/unilive-rtc/callDomain.ts` | CallOrchestrator mirror |
| `artifacts/instacollab/src/lib/unilive-rtc/pkDomain.ts` | PkOrchestrator mirror |
| `artifacts/instacollab/src/lib/unilive-rtc/eventLanes.ts` | Event lane envelopes |
| `artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts` | **New** — sole static livekit-client import |
| `artifacts/instacollab/src/lib/livekit/liveKitInstant.ts` | `connectLiveKitRoom` → `createLiveKitRTCProvider` |
| `artifacts/instacollab/src/lib/chat/demoCallBus.ts` | Mirrors into CallOrchestrator |
| `artifacts/instacollab/package.json` | `@unilives/rtc-*` workspace deps |

## CI

| Path | Change |
|---|---|
| `.github/workflows/ci.yml` | `pnpm run test:stage-b` gate |
| `package.json` | `"test:stage-b": "node scripts/test-stage-b.mjs"` |

## Documentation (Stage B final set)

| Path |
|---|
| `docs/rtc-platform/FINAL-STAGE-B-REPORT.md` |
| `docs/rtc-platform/FINAL-STAGE-B-STATUS.json` |
| `docs/rtc-platform/FINAL-ARCHITECTURE.md` |
| `docs/rtc-platform/FINAL-LIVEKIT-COUPLING.md` |
| `docs/rtc-platform/FINAL-PROVIDER-CONTRACT.md` |
| `docs/rtc-platform/FINAL-USAGE-METERING.md` |
| `docs/rtc-platform/FINAL-PROVIDER-QUALIFICATION.md` |
| `docs/rtc-platform/FINAL-CHANGE-MANIFEST.md` (this file) |
| `docs/rtc-platform/20-FINAL-ACCEPTANCE.md` |
| `docs/rtc-platform/19-CHANGE-LOG.md` |
| `docs/rtc-platform/AUTONOMOUS-PROGRESS.json` |
| `docs/platform/*` (companion platform docs) |

## Production hardening cross-update

| Path | Change |
|---|---|
| `docs/production-hardening/FINAL-STATUS.json` | `stageBAcceptance: PASS`, `stageBStarted: true` |

## Explicitly unchanged

- Approved v15 live UI chrome, CSS, component layouts
- Visual baseline snapshot files
- `uiUxChanged: false`
- Production RTC cutover flag (NOT_PERFORMED)

## Cloudflare qualification (non-production)

| Path |
|---|
| `lib/unilives-rtc-livekit/cloudflareQualification.mjs` |

## Verification

```bash
node scripts/test-stage-b.mjs
git status --short lib/unilives-* scripts/test-stage-b.mjs docs/rtc-platform/
```
