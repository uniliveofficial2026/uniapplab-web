# UniLive RTC Map

**Base SHA:** `9e8c44a`  
**Production contract:** UniLiveRTC → LiveKitRTCProvider → LiveKit  
**Declared in:** `workers/uniapplab-app`, `artifacts/api-server/src/routes/uniliveV1.ts` (`productionRtcApi: "UniLiveRTC"`)

---

## Stack

```
Feature UI / hooks
    → lib/unilive-rtc (app facade)
        → @unilives/rtc-client  createUniLiveRTC
        → @unilives/rtc-core    orchestrators (call/pk/live/seat/room)
        → @unilives/rtc-livekit createLiveKitRTCProvider  ← LiveKitRTCProvider boundary
            → livekit-client (Room / Track / LocalVideoTrack)
    → @unilives/rtc-server      createRtcGrant / mintProviderTokenFromGrant (API)
```

App entry: `artifacts/instacollab/src/lib/unilive-rtc/index.ts`  
`createReferenceRtcProvider()` → `createLiveKitRTCProvider` (or fake in tests).

---

## Grant / token path

| Step | Location |
|------|----------|
| Client requests token | `lib/platformApi.ts` `fetchLiveKitToken` (and chat/party variants) |
| API routes | `artifacts/api-server/src/routes/livekit.ts` — `/token`, `/party/token`, `/chat/token`, webhook |
| Grant mint | `@unilives/rtc-server` `createRtcGrant` + `mintProviderTokenFromGrant` |
| Join | Provider connects Room with token; identity should be PERSON / user id |

---

## LiveKit provider boundary

| Allowed to import `livekit-client` | Path |
|------------------------------------|------|
| Compatibility shim | `artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts` |
| Package implementation | `lib/unilives-rtc-livekit` |

**Target:** feature modules migrate to UniLiveRTC; compatibility file is transitional.

### Feature UI still importing the boundary (not raw `livekit-client`)

- `smule-rooms/components/SoloLiveView.tsx`
- `MultiGuestSeatMedia.tsx`
- `LiveSeatFullscreenOverlay.tsx`
- `components/live/TeamPkSessionContainer.tsx`
- `OneVsOnePkSessionContainer.tsx`
- `LiveDiscoveryVideoPreview.tsx`

**Finding:** No direct `from 'livekit-client'` under `components/` or `features/` — only via boundary or lib packages. PK session containers still use `Room`/`RoomEvent`/`Track` types/APIs through the boundary (migration debt for UniLiveRTC-only attach).

---

## Domain orchestrators

| Domain | Module | Core factory |
|--------|--------|--------------|
| Call | `lib/unilive-rtc/callDomain.ts` | `createCallOrchestrator` |
| PK | `lib/unilive-rtc/pkDomain.ts` | `createPkOrchestrator` |
| Events | `lib/unilive-rtc/eventLanes.ts` | gift/like envelopes |
| Instant connect | `lib/livekit/liveKitInstant.ts` | Stage B via `@unilives/rtc-livekit` |

---

## Media publish helpers (legacy-adjacent)

| File | Role |
|------|------|
| `lib/livekit/liveKitVideoPublish.ts` | `updateLiveKitLocalVideoTrack` |
| `lib/livekit/liveKitAudioPublish.ts` | Audio publish |
| `lib/livekit/liveKitCallRuntime.ts` | Call runtime lazy load |
| `lib/livekit/hostLiveKitRoom.ts` | Host live room |
| `lib/live/liveKitConnection.ts` | Go-live connect + publish |

---

## Room types (QA focus)

| Use | Room naming / token |
|-----|---------------------|
| Live / party | Party/stream tokens |
| Chat call | `ic-chat-call-*` + chat token |
| 1v1 PK | Live PK session + identity=`user_id` |

---

## Cleanup

Disconnect Room, stop tracks, release `appCameraOwner` lease, end orchestrator session (`endCall` / `endDomainPk` / `permanentlyEndHostLive`).
