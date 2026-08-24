# 09 — Event Lanes

UniLive classifies realtime traffic into **lanes** and **event classes** to avoid treating all LiveKit data messages as durable truth.

## Lanes (`EventLane`)

| Lane | Transport | Examples |
|---|---|---|
| `RELIABLE_CONTROL` | Ordered/reliable | Seat accept, PK control, call signals |
| `LOSS_TOLERANT` | Best-effort | Like batches, ephemeral FX |
| `SERVER_AUTHORITATIVE` | Server-originated | Gift settled, ledger, moderation |

## Event classes (`EventClass`)

| Class | Durability |
|---|---|
| `DURABLE_STATE` | Persisted product state |
| `REALTIME_STATE` | Ephemeral but ordered |
| `AUTHORITATIVE_EVENT` | Server truth (replay rules apply) |
| `EPHEMERAL_EVENT` | Fire-and-forget |
| `ACTIVE_FX` | Visual-only, no business effect |

## Envelope

`createEventEnvelope()` in rtc-core mints:

```
eventId, eventType, schemaVersion, occurredAt, lane, eventClass,
canonicalUserId?, roomId?, sequence?, replayPolicy?, properties
```

Default `replayPolicy`: `once`.

## Realtime bus

`@unilives/realtime` (`createUniLiveRealtime`):

- Memory driver for tests
- Optional external driver hook for Supabase/WS later
- Topics: `likes`, `gifts`, etc.

Reference: `artifacts/instacollab/src/lib/unilive-rtc/eventLanes.ts`.

## Provider data channels

LiveKit adapter maps:

- `sendReliableData` → `publishData({ reliable: true })`
- `sendLossTolerantData` → `publishData({ reliable: false })`

Prefer `@unilives/realtime` for cross-feature bus; use provider data only for media-adjacent control when needed.

## Webhook lane

Normalized provider webhooks always land in `SERVER_AUTHORITATIVE` + `AUTHORITATIVE_EVENT`.
