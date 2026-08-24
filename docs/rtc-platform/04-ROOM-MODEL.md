# 04 — Room Model

## Room types (`UniLiveRoomType`)

| Type | Use |
|---|---|
| `LIVE` | Solo host broadcast |
| `SHOP_LIVE` | Commerce live |
| `AUDIO_LIVE` | Audio-only live |
| `MULTI_GUEST` | Seat-based guest layout |
| `PK` | PK battle overlay |
| `CALL_1_TO_1` | Direct call |
| `CALL_GROUP` | Group call |

## Domain objects

**Room record** (orchestrator in-memory / future DB):

- `roomId` — stable product id (often matches LiveKit room name during migration)
- `roomSessionId` — instance id minted at create (`rrs_*`)
- `roomType`, `hostUserId`, `state`, `participants`

**RtcSession** (provider view):

- `roomSessionId`, `roomId`, `roomType`, `connectionState`, `participants[]`

## Lifecycle

```
createRoom({ roomId, roomType, hostUserId })
  → join({ token, url, canonicalUserId, role })
  → publish tracks (via provider)
  → leave / end
```

`createLiveOrchestrator` wraps room orchestrator for host start + viewer join + end.

## API

- `POST /v1/rtc/rooms` — records room start in usage meter
- `POST /v1/rtc/tokens` — mints grant + provider token

## Grants

Each join requires `RtcGrant` with TTL (60s–6h, default 3600s). Permissions derived from role, not client request body alone.

## Usage metering

Room start/join/end events feed `createRtcUsageMeter()` for provider-independent billing truth.

## Reference app

Existing smule-rooms (`Room.tsx`, `SoloLiveView`, etc.) still use LiveKit room names directly; Stage B migrates these to `createUniLiveRTC().joinRoom()` without changing UI chrome.
