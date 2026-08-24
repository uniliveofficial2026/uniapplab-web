# Final Provider Contract (Stage B)

**Package:** `@unilives/rtc-contracts` · **Status:** PASS · **Evidence:** `scripts/test-stage-b.mjs`

## Canonical interface: `UniLivesRTCProvider`

Provider-neutral media contract — **no LiveKit types** on the public surface.

| Method | Purpose |
|---|---|
| `connect` / `disconnect` | Transport lifecycle |
| `joinRoom` / `leaveRoom` | Returns `RtcSession` with connection state |
| `publishCamera` / `publishMicrophone` | Track publish → `RtcTrackRef` |
| `replaceVideoTrack` / `replaceAudioTrack` | Hot swap without rejoin |
| `unpublish` | Remove track by id |
| `setPublishProfile` | QoE-driven encoding tier |
| `setSubscriptionProfile` | Tile/layout subscription hint |
| `sendReliableData` | Control lane |
| `sendLossTolerantData` | Likes/ephemeral lane |
| `getStats` | `RtcStats` for QoE governor |
| `getConnectionState` | `RtcConnectionState` |
| `on` | Event subscription (returns unsubscribe) |

## Identity model

| Field | Scope |
|---|---|
| `canonicalUserId` | Domain identity (person_* prefix in auth) |
| `providerIdentity` | Adapter-internal mapping to SFU identity |
| `roomId` / `roomName` | Business room vs provider room name |

## Grants precede join

```
createRtcGrant({ canonicalUserId, roomId, role })
  → permissionsForRole(role)
  → mintProviderTokenFromGrant()  [@unilives/rtc-server]
    → LiveKit token [lib/livekit workspace helper]
      → client joinRoom({ token, url, roomName })
```

**Invariant:** viewer role cannot self-promote to publish video (`rtc_grant_permissions` test).

## Implementations

| Provider | Package | Environment |
|---|---|---|
| LiveKit | `@unilives/rtc-livekit` | Production media default |
| Fake | `@unilives/rtc-fake` | CI, MCP probes, offline dev |
| Cloudflare Realtime | `cloudflareQualification.mjs` | Non-production lab only |

## Provider unavailable behavior

When provider join fails, **business orchestrators retain state** (`provider_unavailable_does_not_destroy_business_state` test). Media fails closed; call/PK/seat domain state is not destroyed.

## Server webhook contract

`normalizeProviderWebhook()` maps provider events → canonical envelopes:

```javascript
// livekit participant_joined → RTCParticipantJoined
{ eventId: 'livekit:evt-9', eventType: 'RTCParticipantJoined', ... }
```

Idempotent by `eventId` prefix `{provider}:{providerEventId}`.

## Registry

`createProviderRegistry().resolve('rtc')` → `{ provider: 'livekit', status: 'default' }`

## Reference entry points

| Consumer | Factory |
|---|---|
| Reference app | `createReferenceRtcProvider()` in `lib/unilive-rtc/index.ts` |
| SDK | `createUniLive({ provider })` |
| CLI doctor | `createFakeRTCProvider` probe |
| MCP | `create_rtc_room` tool |

## Rules (Stage B)

1. No `livekit-client` imports outside adapter + boundary
2. Orchestrators depend only on `@unilives/rtc-contracts` + `@unilives/rtc-core`
3. Fake provider must pass the same test matrix as LiveKit adapter for domain logic

## Evidence

```bash
node scripts/test-stage-b.mjs
# PASS rtc_grant_permissions
# PASS webhook_normalization_idempotent_id
# PASS fake_provider_join_publish
# PASS provider_unavailable_does_not_destroy_business_state
```
