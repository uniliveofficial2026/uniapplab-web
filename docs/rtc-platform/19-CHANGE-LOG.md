# 19 — Change Log

## Stage B final (2026-08-24)

| Date | Change |
|---|---|
| 2026-08-24 | Stage B **PASS** — foundation gates documented in `FINAL-STAGE-B-REPORT.md` |
| 2026-08-24 | `@unilives/rtc-contracts` — provider-neutral types + `UniLivesRTCProvider` |
| 2026-08-24 | `@unilives/rtc-core` — room/call/PK/seat/live orchestrators + runtime |
| 2026-08-24 | `@unilives/rtc-client` — `createUniLiveRTC` public client |
| 2026-08-24 | `@unilives/rtc-server` — grants, token mint, webhook normalization |
| 2026-08-24 | `@unilives/rtc-livekit` — isolated livekit-client adapter + Cloudflare lab probe |
| 2026-08-24 | `@unilives/rtc-fake` — test provider |
| 2026-08-24 | `@unilives/rtc-qoe` — QoE governor (Stage A semantics) |
| 2026-08-24 | `@unilives/platform-core` — control plane, registry, usage meter, project graph |
| 2026-08-24 | `@unilives/sdk`, `mcp`, `cli`, `auth`, `database`, `storage`, `realtime`, `deploy`, `git`, `observe`, `ui` |
| 2026-08-24 | `/api/v1/*` routes in `uniliveV1.ts` — health declares UniLiveRTC + LiveKit |
| 2026-08-24 | Reference facade `lib/unilive-rtc/` — call/PK/event lane mirrors |
| 2026-08-24 | `livekitCompatibilityBoundary.ts` — sole static livekit-client import in app |
| 2026-08-24 | `connectLiveKitRoom` → `createLiveKitRTCProvider` |
| 2026-08-24 | `demoCallBus` → CallOrchestrator mirror |
| 2026-08-24 | Gift lifecycle-settle → PkOrchestrator mirror |
| 2026-08-24 | `scripts/test-stage-b.mjs` — **16/16 PASS**; CI gate in `.github/workflows/ci.yml` |
| 2026-08-24 | LiveKit import boundary: **1 site** (boundary file) + adapter dynamic import |
| 2026-08-24 | Stage A regression re-run: gift 13/13, visual 22/22, call 4/4, PK topology 6/6, PK seat 6/6, wallet 7/7, pk-challenge 16/16 |
| 2026-08-24 | Final docs: `FINAL-*` set + `AUTONOMOUS-PROGRESS.json` |
| 2026-08-24 | `docs/production-hardening/FINAL-STATUS.json` — `stageBAcceptance: PASS` |

## Stage A (4786a68 baseline — frozen)

- Visual lock 22/22, `uiUxChanged: false`
- Call lifecycle matrix, PK gift idempotency, reconnect smokes
- LiveKit room create/grant/delete PASS
- Native CallKit/PushKit scaffold; device QA accepted external blocker
- Production RTC cutover NOT performed

## Explicitly not changed in Stage B

- Approved UI/UX surfaces and CSS (`uiUxChanged: false`)
- Production RTC cutover (`NOT_PERFORMED`)
- Production media provider swap (`NOT_REQUIRED_FOR_STAGE_B`)

## Deferred post–Stage B

- Delete `livekitCompatibilityBoundary.ts` after full UniLiveRTC attach migration
- Persist control plane to Postgres
- Production billing warehouse for usage meter
- Full `unilive start` docker compose stack
- Visual Builder/Studio WYSIWYG editor


## Seal
- Stage B sealed at  on fix/vercel-api-root-now
- UI unchanged; LiveKit remains production media provider


## Seal
- Stage B sealed tip `7ac8e642b7abff9b7192db66fe9644f976f77888` (impl `a6b2e43`) on fix/vercel-api-root-now
- UI unchanged; LiveKit remains production media provider; SFU cutover NOT_PERFORMED
