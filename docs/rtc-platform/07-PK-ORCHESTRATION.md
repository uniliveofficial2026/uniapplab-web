# 07 — PK Orchestration

PK battles use `createPkOrchestrator()` with **authoritative gift scoring only**.

## Session model

`start({ pkId?, roomId, hostUserId, opponentUserId, durationSec })`:

- Indexes by `pkId` and `room:{roomId}`
- Tracks `localScore` (host side) and `opponentScore`
- `status`: `active` | `ended`
- Monotonic `sequence` for score updates

## Gift score application

`applyGiftScore({ roomId, recipientUserId, points, giftEventId })`:

1. PK must be `active`
2. `giftEventId` required — dedupe via `scoredEvents` set
3. Points floored to non-negative integer
4. Recipient must be host or opponent on the PK

Returns `{ applied, duplicate, localScore, opponentScore, sequence }`.

Stage A validated idempotent scoring across lifecycle rounds and reconnect.

## End

`end(roomId)` → `status: 'ended'`, sets `endedAt`.

## Product integration

- PK UI chrome unchanged (Stage A visual lock)
- Gift scheduler emits settled events → PK orchestrator (server-side or bus consumer)
- Remote PK end clears challenger overlay (Stage A fix)

## MCP

`simulate_pk` creates session for agent-driven regression.

## Topology

PK media may use separate LiveKit rooms or shared room with tile layout; orchestrator keys on `roomId` only. Topology clamp validated in Stage A.
