# 05 — Call Orchestration

Call domain logic lives in `createCallOrchestrator()` (`@unilives/rtc-core`). The reference app facade re-exports via `lib/unilive-rtc/callDomain.ts`.

## State machine

States (`CallDomainState`):

`CREATED → RINGING → ACCEPTED → CONNECTING → CONNECTED ↔ RECONNECTING → terminal`

Terminal: `ENDED`, `DECLINED`, `CANCELLED`, `BUSY`, `TIMED_OUT`, `MISSED`, `FAILED`

Creation immediately transitions to `RINGING`.

## Signal API

`applySignal({ callSessionId, signalId, type })`:

| Signal | Transition |
|---|---|
| `accept` | RINGING → ACCEPTED (stale if already cancelled/ended) |
| `connecting` | CONNECTING |
| `connected` | CONNECTED |
| `reconnect` | RECONNECTING (from CONNECTED/RECONNECTING) |
| `recovered` | CONNECTED |
| `decline` | DECLINED |
| `cancel` | CANCELLED |
| `busy` | BUSY |
| `timeout` | TIMED_OUT |
| `missed` | MISSED |
| `hangup` / `end` | ENDED |
| `fail` | FAILED |

## Idempotency

- Duplicate `signalId` per call → `{ duplicate: true }`
- **Stale accept guard**: accept after cancel/end/timeout/missed/failed → `{ ignored: true, reason: 'stale_accept' }`

Stage A smoke tests validated dual-party reconnect and stale-accept paths.

## Media separation

Orchestrator owns **signaling state** only. Media join uses `UniLivesRTCProvider` with room type `CALL_1_TO_1` or `CALL_GROUP`. Provider failure does not destroy call row (see `provider_unavailable_does_not_destroy_business_state` test).

## Native integration (Stage A scaffold)

iOS CallKit / Android FGS scaffolds exist; `FEATURE_ENABLED=false` until VoIP cert + device QA. Business state machine is ready for native bridge hooks.

## MCP simulation

`simulate_call` tool creates orchestrator row for regression without LiveKit.
