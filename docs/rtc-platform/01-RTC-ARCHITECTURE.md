# 01 — RTC Architecture

UniLiveRTC separates **business domain** from **media transport**. Product code targets `@unilives/rtc-client` and orchestrators in `@unilives/rtc-core`; only `@unilives/rtc-livekit` talks to `livekit-client`.

## Layer diagram

```
┌─────────────────────────────────────────────────────────┐
│ Reference app (instacollab)                             │
│  lib/unilive-rtc/  ← public facade                      │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ @unilives/rtc-client  createUniLiveRTC()                │
│ @unilives/rtc-core    orchestrators + createRtcRuntime  │
│ @unilives/rtc-qoe     classifyQoe / publish profiles    │
└───────────────────────────┬─────────────────────────────┘
                            │ UniLivesRTCProvider
┌───────────────────────────▼─────────────────────────────┐
│ @unilives/rtc-livekit (production)  │ @unilives/rtc-fake │
└───────────────────────────┬─────────────────────────────┘
                            │
                    livekit-client / none
```

## Runtime composition

`createRtcRuntime({ provider })` wires:

| Component | Responsibility |
|---|---|
| `roomOrchestrator` | Room session + participant map |
| `callOrchestrator` | 1:1 / group call state machine |
| `pkOrchestrator` | PK session + idempotent gift scoring |
| `seatOrchestrator` | Multi-guest seat occupancy |
| `liveOrchestrator` | Host/viewer live lifecycle |
| `qoe` | Network/thermal-aware publish profile |

## Server boundary

`@unilives/rtc-server` handles:

- `createRtcGrant` — role → permissions (clients cannot self-elevate)
- `mintProviderTokenFromGrant` — grant → LiveKit JWT via `@workspace/livekit`
- `normalizeProviderWebhook` — provider events → UniLive envelopes

## API entry

`/v1/rtc/rooms`, `/v1/rtc/tokens`, `/v1/rtc/webhooks/normalize` in `uniliveV1.ts` expose provider-neutral contracts. Legacy LiveKit routes remain during migration.

## Event vs media

- **Media**: camera/mic tracks via provider adapter.
- **Business realtime**: likes/gifts/chat via `@unilives/realtime` lanes — not universal LiveKit `publishData`.

## Migration status

Direct `livekit-client` imports in `artifacts/instacollab/src` are being routed through `livekitCompatibilityBoundary.ts` or replaced with `createUniLiveRTC`. See `LIVEKIT-CLIENT-IMPORTS.txt` and `PROVIDER-COUPLING-MANIFEST.md`.
