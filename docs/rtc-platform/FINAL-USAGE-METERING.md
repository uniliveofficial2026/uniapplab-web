# Final Usage Metering (Stage B)

**Package:** `@unilives/platform-core` → `createRtcUsageMeter()`  
**Status:** PASS (foundation) · **Evidence:** `usage_meter_idempotent` in `test-stage-b.mjs`

## Purpose

Provider-neutral RTC usage rollup for billing observability. Consumes normalized webhook/API events, not raw LiveKit payloads.

## Event types (foundation)

| Type | Source | Fields |
|---|---|---|
| `room_started` | API `POST /v1/rtc/rooms`, webhooks | `roomId`, `roomType` |
| `room_ended` | Webhook normalize, orchestrator end | `roomId`, duration hints |
| `participant_joined` | Normalized webhook | `roomId`, `canonicalUserId` |

## Idempotency

```javascript
m.apply({ eventId: '1', type: 'room_started', roomId: 'r', roomType: 'LIVE' });
const dup = m.apply({ eventId: '1', ... });
// dup.duplicate === true
// m.rollup().metrics.roomCount === 1
```

**Rule:** same `eventId` never double-counts.

## Integration points

| Path | Role |
|---|---|
| `artifacts/api-server/src/routes/uniliveV1.ts` | Applies meter on room create; exposes rollup |
| `@unilives/rtc-server` `normalizeProviderWebhook` | Feeds canonical events |
| Legacy `artifacts/api-server/src/routes/livekit.ts` | Stage A webhook — parallel path |

## API exposure

`GET /v1/usage/rollup` (via uniliveV1 router) returns in-memory metrics for dev/MCP.

## Reference app gift metering

Gift **wallet** settlement remains authoritative in Stage A ledger routes. PK **score** consumption mirrors through:

- `POST /api/live/rooms/:roomId/gifts/lifecycle-settle`
- `pkDomain.ts` → `PkOrchestrator.applyGiftScore({ giftEventId })`

Usage meter tracks room/participant lifecycle; gift coin ledger is separate domain.

## FOUNDATION_READY limits

| Limit | Stage B reality |
|---|---|
| Persistence | In-memory only — no Postgres warehouse flush |
| Billing export | No Stripe/invoice integration |
| Cross-region aggregation | Single process store |

Production billing requires persistent warehouse tables (deferred post–Stage B).

## Production posture

| Field | Value |
|---|---|
| `productionRtcApi` | UniLiveRTC |
| `productionMediaProvider` | LiveKit |
| `productionMediaProviderCutover` | NOT_REQUIRED_FOR_STAGE_B |

Metering hooks exist; production cutover of media provider is not required to accept Stage B foundation.

## Evidence

```bash
node scripts/test-stage-b.mjs
# PASS usage_meter_idempotent
```
