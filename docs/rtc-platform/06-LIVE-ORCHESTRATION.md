# 06 — Live Orchestration

Live sessions use `createLiveOrchestrator({ roomOrchestrator })` — a thin domain wrapper over room lifecycle without React authority.

## Operations

| Method | Behavior |
|---|---|
| `start({ roomId, hostUserId, roomType, token, url })` | Creates room + host join as `host` role |
| `joinAsViewer({ roomId, userId, token, url })` | Viewer join (no publish permissions) |
| `end({ roomId })` | Removes room + provider leave |

## Client entry

```typescript
const rtc = createUniLiveRTC({ provider, roomType: 'LIVE' });
const room = await rtc.joinRoom({ roomId, token, url, canonicalUserId, role: 'host' });
await room.enableCamera(track);
await room.enableMicrophone(track);
const network = await room.getNetwork(); // QoE update
await room.leave();
```

## Realtime lanes (non-media)

Likes and gifts use `@unilives/realtime` via `lib/unilive-rtc/eventLanes.ts`:

- `publishLikesBatch` → `LOSS_TOLERANT` / `EPHEMERAL_EVENT`
- `publishAuthoritativeGift` → `SERVER_AUTHORITATIVE` / `AUTHORITATIVE_EVENT`

LiveKit `publishData` is not the universal business bus.

## Room types in product

| Surface | roomType |
|---|---|
| Solo live | `LIVE` |
| Shop live | `SHOP_LIVE` |
| Audio live | `AUDIO_LIVE` |
| Multi-guest | `MULTI_GUEST` |

## QoE integration

`room.getNetwork()` calls provider stats → `createQoeGovernor().update()` → publish profile recommendation.

## Migration note

Host publish paths in `lib/livekit/*` still attach via compatibility boundary; target is provider methods on joined room handle.
