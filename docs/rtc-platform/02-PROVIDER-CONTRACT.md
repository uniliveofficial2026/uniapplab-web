# 02 — Provider Contract

The canonical media contract is `UniLivesRTCProvider` in `@unilives/rtc-contracts`.

## Interface summary

| Method | Purpose |
|---|---|
| `connect` / `disconnect` | Transport lifecycle |
| `joinRoom` / `leaveRoom` | Returns `RtcSession` with participants |
| `publishCamera` / `publishMicrophone` | Track publish → `RtcTrackRef` |
| `replaceVideoTrack` / `replaceAudioTrack` | Hot swap without rejoin |
| `unpublish` | Remove track by id |
| `setPublishProfile` | QoE-driven encoding tier |
| `setSubscriptionProfile` | Tile/layout subscription hint |
| `sendReliableData` | Control lane (reliable) |
| `sendLossTolerantData` | Likes/ephemeral lane |
| `getStats` | `RtcStats` for QoE |
| `getConnectionState` | `RtcConnectionState` |
| `on` | Event subscription (returns unsubscribe) |

## Rules

1. **No LiveKit types** on the public contract surface.
2. **Identity**: `canonicalUserId` in domain; `providerIdentity` is adapter-internal mapping (today often 1:1).
3. **Grants precede join**: server mints `RtcGrant`; client presents token to provider.
4. **Fake parity**: `@unilives/rtc-fake` implements the same interface for CI without cloud.

## LiveKit adapter specifics

`@unilives/rtc-livekit`:

- Creates `Room` with `adaptiveStream` + `dynacast`.
- Maps `RoomEvent.ConnectionStateChanged` → `RtcConnectionState`.
- Exposes `getNativeRoom()` as documented escape hatch for Stage A attach paths (to be removed post-migration).

## Token path

```
createRtcGrant(role, permissions)
  → mintProviderTokenFromGrant()
    → @workspace/livekit createLiveKitToken()
      → client joinRoom({ token, url, roomName })
```

## Provider selection

| Environment | Provider |
|---|---|
| Production media | `@unilives/rtc-livekit` |
| Unit / MCP / CLI probes | `@unilives/rtc-fake` |
| Provider unavailable | Business orchestrators continue; media join fails closed |

Reference helper: `createReferenceRtcProvider()` in `lib/unilive-rtc/index.ts` tries LiveKit, falls back to fake.
