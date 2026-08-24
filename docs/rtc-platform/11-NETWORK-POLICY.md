# 11 — Network Policy

Stage B codifies Stage A network semantics into provider-neutral QoE + subscription hints.

## Connection states

`RtcConnectionState`: `CONNECTED | DEGRADED | RECONNECTING | RECOVERED | FAILED`

LiveKit adapter maps `ConnectionStateChanged` events; fake provider allows `_setConnectionState` for tests.

## Subscription profiles

Used for tile/layout prioritization (not yet fully wired in LiveKit adapter):

| Profile | Typical use |
|---|---|
| `FULLSCREEN_HOST` | Solo live host |
| `PK_LARGE_TILE` | PK primary tile |
| `PK_SMALL_TILE` | PK secondary |
| `MULTIGUEST_TILE` | Seat grid |
| `AUDIO_ONLY` | Background audio |
| `BACKGROUND` | Minimized |

## Simulcast / room policy (Stage A)

Stage A validated simulcast room policy and network QoE under PK and multi-guest topologies. Product encoding tables remain in `liveKitPublishProfile.ts` until migrated to `setPublishProfile`.

## Reconnect behavior

- Call orchestrator: explicit `reconnect` / `recovered` signals
- Provider: LiveKit auto-reconnect; maps to RECONNECTING/CONNECTED
- Business state must not resurrect on stale accept during reconnect windows

## Data lane selection

High-frequency likes → `LOSS_TOLERANT`. Control → `RELIABLE_CONTROL`. Do not mix authoritative gift settlement on lossy lanes.

## Fake provider stats

Test provider returns deterministic stats by profile for QoE unit tests without network.
