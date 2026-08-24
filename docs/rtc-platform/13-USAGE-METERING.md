# 13 — Usage Metering

Provider-independent RTC usage truth lives in `createRtcUsageMeter()` (`@unilives/platform-core`).

## Event types

| Event | Effect |
|---|---|
| `room_started` | Opens room session row |
| `room_ended` | Sets `endedAt` |
| `participant_joined` | Participant session + peak count |
| `participant_left` | Sets participant `leftAt` |
| `track_published` | Track session start |
| `track_unpublished` | Track end + byte rollup |

## Idempotency

`apply({ eventId, ... })` — duplicate `eventId` returns `{ duplicate: true }`.

Event ids:

- Webhooks: `{provider}:{providerEventId}` via normalization
- API: `api-room-{roomId}-{timestamp}`

## Rollup

`rollup()` returns `{ rooms, participants, tracks, metrics }` with counts suitable for billing dashboards.

## API exposure

- `GET /v1/metrics` — RTC rollup + provider registry
- MCP `get_metrics` — same meter + control plane usage list

## Separation from product ledger

Gift/commerce metering uses separate marketplace ledger (Stage A). RTC meter measures **media session minutes**, not virtual currency.

## Webhook path

`POST /v1/rtc/webhooks/normalize` applies normalized events to meter before returning envelope to caller.
