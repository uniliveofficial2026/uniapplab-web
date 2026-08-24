# 08 — Seat Orchestration

Multi-guest live uses `createSeatOrchestrator({ maxSeats })` for server-authorized seat occupancy (default 6 seats).

## Seat states

| State | Meaning |
|---|---|
| `empty` | Available |
| `requested` | Guest pending host approval |
| `occupied` | Guest publishing |

## API

| Method | Effect |
|---|---|
| `requestJoin({ roomId, userId, seatIndex })` | Sets `pendingUserId`, state `requested` |
| `accept({ roomId, seatIndex, actorUserId })` | Promotes pending → `occupantUserId`, assigns `guest` permissions |
| `remove({ roomId, seatIndex })` | Clears seat |

Errors: `INVALID_SEAT`, `SEAT_TAKEN`, `NO_PENDING`.

## Permissions

On accept, seat receives `permissionsForRole('guest')` — audio/video publish allowed, no admin.

## Reference app

Existing seat UI in smule-rooms (`roomSeats.ts`, `LiveSeatFullscreenOverlay`, `useMultiGuestLiveKit`) still uses LiveKit directly during migration. Target: seat orchestrator as authority, provider join after accept.

## Future persistence

Current implementation is in-memory foundation. Production path: persist seat map in Postgres + reconcile with RTC participant join/leave webhooks.
