# 15 — Provider Independence

Stage B goal: swap LiveKit for another WebRTC SFU without rewriting call/PK/seat/live logic.

## Independence layers

| Layer | Coupling |
|---|---|
| `@unilives/rtc-contracts` | Zero provider imports |
| `@unilives/rtc-core` | Zero provider imports |
| `@unilives/rtc-client` | Provider injected |
| `@unilives/rtc-server` | Token mint via adapter (`@workspace/livekit` today) |
| `@unilives/rtc-livekit` | **Only** livekit-client import site in lib/ |
| Reference app | **21 files** still import livekit-client outside boundary (in progress) |

## Registry

`createProviderRegistry()` defaults:

| Kind | Active provider | Adapter |
|---|---|---|
| rtc | livekit | `@unilives/rtc-livekit` |
| auth | supabase | `@unilives/auth` |
| database | supabase | `@unilives/database` |
| storage | cloudflare-r2 | `@unilives/storage` |
| realtime | supabase | `@unilives/realtime` |
| deployment | vercel | `@unilives/deploy` |
| git | github | `@unilives/git` |

## Compatibility boundary

`artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts` — documented temporary re-export. Target: delete when all attach paths use UniLiveRTC.

## Inventory

See `PROVIDER-COUPLING-MANIFEST.md` and `LIVEKIT-CLIENT-IMPORTS.txt` for classified coupling (IDENTITY, DATABASE, TOKEN_GRANTS, MEDIA_TRANSPORT).

## Fake provider

`@unilives/rtc-fake` proves business logic runs with zero cloud RTC — used in Stage B CI suite and MCP room tools.

## Qualification

New RTC provider must implement `UniLivesRTCProvider`, pass `18-TEST-MATRIX.md`, and provide webhook normalization mapping.
