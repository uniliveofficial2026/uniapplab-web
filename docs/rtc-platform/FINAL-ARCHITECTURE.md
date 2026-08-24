# Final Architecture — UniLiveRTC + Platform (Stage B)

**Baseline:** `4786a68` · **UI lock:** `uiUxChanged: false` · **Cutover:** NOT_PERFORMED

## Layer diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Reference app (artifacts/instacollab) — UI unchanged           │
│  livekitCompatibilityBoundary.ts  │  lib/unilive-rtc/ facade     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  @unilives/rtc-client  createUniLiveRTC()                       │
│  @unilives/rtc-core    Call / Live / Seat / PK orchestrators    │
│  @unilives/rtc-qoe     QoE governor + publish profiles          │
└────────────────────────────┬────────────────────────────────────┘
                             │ UniLivesRTCProvider (contracts)
┌────────────────────────────▼────────────────────────────────────┐
│  @unilives/rtc-livekit   createLiveKitRTCProvider (production)  │
│  @unilives/rtc-fake      createFakeRTCProvider (CI/MCP)         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  LiveKit Cloud / self-host SFU (underlying media — unchanged)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  @unilives/platform-core  control plane · registry · metering   │
│  @unilives/sdk / mcp / cli                                        │
│  /api/v1/*  (uniliveV1.ts)                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Package map

| Layer | Packages |
|---|---|
| Contracts | `@unilives/rtc-contracts` |
| Domain | `@unilives/rtc-core` (orchestrators, event envelopes, runtime) |
| Client | `@unilives/rtc-client` |
| Server | `@unilives/rtc-server` (grants, webhook normalize, token mint) |
| Providers | `@unilives/rtc-livekit`, `@unilives/rtc-fake` |
| QoE | `@unilives/rtc-qoe` |
| Platform | `@unilives/platform-core`, `@unilives/sdk`, `@unilives/mcp`, `@unilives/cli` |
| Boundaries | `@unilives/auth`, `database`, `storage`, `realtime`, `deploy`, `git`, `observe`, `ui` |

## Orchestrator responsibilities

| Orchestrator | Domain | Key invariants |
|---|---|---|
| Room | Session identity, room type | Provider join is separate from business state |
| Call | 1:1 call lifecycle | Stale accept ignored; signal dedupe by `signalId` |
| Live | Host start/end | `liveOrchestrator.start/end` in runtime |
| Seat | Multi-guest seats | Host accept grants publish permissions |
| PK | Gift score | Idempotent by `giftEventId` |

## Event lanes

| Lane | Use | Reference mirror |
|---|---|---|
| `SERVER_AUTHORITATIVE` | Gifts, PK settle, grants | `eventLanes.ts`, API lifecycle-settle |
| `LOSS_TOLERANT` | Likes, ephemeral | `@unilives/realtime` publish/subscribe |
| `RELIABLE_CONTROL` | Call signals | `demoCallBus` → `callDomain` |

## API surface

`artifacts/api-server/src/routes/uniliveV1.ts`:

- `GET /v1/health` — declares UniLiveRTC + LiveKit
- Projects, environments, RTC rooms/tokens, webhooks, usage rollup
- Does not expose raw provider IDs as product truth

## Reference app facade

`artifacts/instacollab/src/lib/unilive-rtc/`:

- `index.ts` — provider factory, orchestrator re-exports
- `callDomain.ts` — CallOrchestrator mirror for demo bus
- `pkDomain.ts` — PkOrchestrator mirror for gift settle
- `eventLanes.ts` — lane envelopes for likes/gifts

## Production posture

| Field | Value |
|---|---|
| `productionRtcApi` | UniLiveRTC |
| `productionMediaProvider` | LiveKit |
| `productionRtcCutover` | NOT_PERFORMED |
| `productionMediaProviderCutover` | NOT_REQUIRED_FOR_STAGE_B |

## FOUNDATION_READY areas

- **Local full stack:** CLI `start` handler documents orchestration; not production-grade compose
- **Builder/Studio:** `ProjectGraph` in platform-core; visual editor not shipped
- **UI kit commerce surfaces:** Checkout/Orders/Seller registered as foundation-only
- **Persistence:** control plane in-memory for Stage B

## Evidence

- `node scripts/test-stage-b.mjs` — 16/16 PASS
- Stage A regressions — see `FINAL-STAGE-B-REPORT.md`
