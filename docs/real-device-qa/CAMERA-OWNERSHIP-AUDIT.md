# Camera Ownership Audit

Base SHA: `9e8c44a587b00e217f7cc79aa97044ec664f3a00`  
Production: `https://app.uniapplab.com`  
`uiUxChanged`: false

## Verdict

| Gate | Status |
|---|---|
| cameraOwnership (live path) | PASS_WITH_NOTES |
| parallel GUM outside live | FAIL_PARTIAL — audio-only / karaoke / voice-changer open separate mic streams |
| liveKitBoundary | PASS_COMPAT — feature code uses `livekitCompatibilityBoundary`, not raw `livekit-client` except that bridge file |
| productionEndpointConfig | PASS — Capacitor `hostname: app.uniapplab.com`, optional `CAP_SERVER_URL` |
| apnsStatus | EXTERNAL_APNS_CREDENTIAL / CallKit FEATURE_ENABLED=false |
| giftAuthority | PASS — server settlement path (Stage A/D contracts) |

## Canonical live camera path (required)

```
physical camera
→ appCameraOwner / cameraAcquire / useCameraStream
→ beauty/effect processing (WebAR/DeepAR as configured)
→ local preview
→ prepareProcessedVideoTrackForLiveKit / updateLiveKitLocalVideoTrack
→ UniLiveRTC / LiveKitRTCProvider
→ LiveKit
```

Owner module: `artifacts/instacollab/src/lib/camera/appCameraOwner.ts`  
Acquire: `artifacts/instacollab/src/lib/camera/cameraAcquire.ts`  
Hook: `artifacts/instacollab/src/lib/camera/useCameraStream.ts`  
Policy: `artifacts/instacollab/src/lib/camera/cameraPipelinePolicy.ts` (beauty must not restart GUM)

## getUserMedia call sites (app source)

| File | Kind | Notes |
|---|---|---|
| `lib/camera/cameraAcquire.ts` | video(+audio) | Canonical |
| `lib/camera/appCameraOwner.ts` | audio-only fallback | Lease owner |
| `lib/camera/acquireLiveMedia.ts` | audio-only | Live media helper |
| `lib/chat/useChatCall.ts` | video via `acquireAppCamera`; audio-only GUM for audio calls | Video path OK |
| `lib/live/voiceChangerPipeline.ts` | mic | Parallel mic risk if live camera lease held |
| `lib/useVoice.ts` | mic | Voice features |
| `lib/deepar/useDeepAR.ts` | mic | DeepAR audio |
| `smule-rooms/hooks/useSingingSession.ts` | mic | Karaoke |
| `smule-rooms/hooks/useMicVoiceActivity.ts` | mic | VA meter |
| `smule-rooms/hooks/useRoomVoiceChanger.ts` | mic | Voice changer |
| `smule-rooms/hooks/useWatchTogetherGameCast.ts` | display | Screen share |
| `smule-rooms/hooks/useGameLiveKit.ts` | display | Screen share |
| `components/karaoke/RecordingStudio.tsx` | mic | Karaoke studio |

No `@capacitor/camera` usage — WebView `getUserMedia` only.

## LiveKit import boundary

- Only `lib/rtc/livekitCompatibilityBoundary.ts` imports `livekit-client` directly.
- Feature/UI imports Room/Track through that boundary (SoloLive, PK containers, multi-guest, discovery preview).
- Publish helpers: `lib/livekit/liveKitVideoPublish.ts` use boundary types + app-owned tracks.

## Device evidence status

| Device | State |
|---|---|
| iPhone 14 Pro Max (iPhone15,3) UDID 00008120-000A4D3C3AF8C01E | physical, paired, DDI available, booted |
| Wei's iPad | unavailable / offline |
| Android | none attached (`adb devices` empty) |

Second physical device required for two-party call/PK hardware PASS.
