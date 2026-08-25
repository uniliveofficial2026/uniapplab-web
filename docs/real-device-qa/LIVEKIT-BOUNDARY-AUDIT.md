# LiveKit Boundary Audit

Base SHA: `9e8c44a587b00e217f7cc79aa97044ec664f3a00`

## Rule

Feature/business/UI code must not own LiveKit media directly. Allowed:

- `@unilives/rtc-livekit`
- `artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts`
- provider-specific tests

## Findings

| Area | Status |
|---|---|
| Raw `livekit-client` in `components/` / `features/` | PASS — none found |
| Compatibility boundary usage in live/PK/multi-guest | PASS_COMPAT (intentional bridge) |
| Video publish uses app-owned processed track | PASS (`updateLiveKitLocalVideoTrack`) |
| Production RTC stamp | UniLiveRTC → LiveKit |

## Bridge consumers (documented)

- `smule-rooms/hooks/useMultiGuestLiveKit.ts`
- `smule-rooms/hooks/usePartyRoomLiveKit.ts`
- `smule-rooms/hooks/useGameLiveKit.ts`
- `components/live/OneVsOnePkSessionContainer.tsx`
- `components/live/TeamPkSessionContainer.tsx`
- `smule-rooms/components/SoloLiveView.tsx`
- `lib/livekit/*` publish/telemetry helpers

## Production health evidence

`GET https://app.uniapplab.com/api/v1/health` returns:

```json
{"ok":true,"productionRtcApi":"UniLiveRTC","productionMediaProvider":"LiveKit"}
```
