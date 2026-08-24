# 14 — Realtime Boundary (`@unilives/realtime`)

Topic-based realtime messaging with event lane semantics.

## Package

- Path: `lib/unilives-realtime`
- Name: `@unilives/realtime` v0.1.0

## Event lanes

| Lane | Use | Reference mirror |
|---|---|---|
| `SERVER_AUTHORITATIVE` | Gifts, PK settle, grants | `eventLanes.ts`, API lifecycle-settle |
| `LOSS_TOLERANT` | Likes, ephemeral | `@unilives/realtime` publish/subscribe |
| `RELIABLE_CONTROL` | Call signals | `demoCallBus` → `callDomain` |

## API

`createUniLiveRealtime({ adapter })` — memory adapter for tests; Supabase Realtime adapter foundation.

## Stage B status

**IMPLEMENTED** — tested in Stage B suite alongside auth memory adapter.

## SDK integration

SDK `realtime` namespace throws `REALTIME_ADAPTER_REQUIRED` until wired.

## Reference app

`artifacts/instacollab/src/lib/unilive-rtc/eventLanes.ts` routes likes/gifts through lane envelopes. UI FX unchanged.

## Stage C work

- [ ] Complete Supabase Realtime adapter
- [ ] Wire SDK from registry
- [ ] Document topic naming conventions
- [ ] Self-host WebSocket option (foundation)

## Classification

**IMPLEMENTED** + **NEEDS_PRODUCTIZATION**

## Evidence

`scripts/test-stage-b.mjs` → `auth_memory_and_realtime_lanes`
