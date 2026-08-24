# Usage Metering (Platform)

Platform-level usage spans RTC session metering and control-plane usage records.

## RTC meter

`createRtcUsageMeter()` — see also `docs/rtc-platform/13-USAGE-METERING.md`.

Tracks:

- Room session duration (start/end)
- Participant sessions (join/leave, peak count)
- Track sessions (publish/unpublish, bytes)

Idempotent on `eventId`.

## Control plane usage

`controlPlane.recordUsage({ kind, ... })` — generic platform events:

- `rtc_room_create` — from API room POST
- `rtc_room` — from MCP room create
- Future: `deployment`, `storage_upload`, `api_call`

## Feeds

| Consumer | API |
|---|---|
| Billing (future) | Rollup export from Postgres |
| MCP agents | `get_metrics` |
| SDK | `observe.getMetrics()` |
| Operators | `GET /v1/metrics` |

## Separation of concerns

| Meter | Measures |
|---|---|
| RTC usage meter | Media minutes, participants, tracks |
| Marketplace ledger | Virtual currency, gifts, commerce (Stage A) |
| Control plane usage | Platform operation counts |

Do not conflate gift spend with RTC participant minutes.

## Webhook + API ingestion

Both paths call `usageMeter.apply()` with dedupe keys before side effects.

## Persistence

In-memory in Stage B foundation. Production billing requires flush to Postgres warehouse tables.

## Provider independence

Meter events use UniLive normalized types — provider name stored as metadata only.
