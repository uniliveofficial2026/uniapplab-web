# UniLive Native Map (Capacitor / iOS / Android)

**Base SHA:** `9e8c44a`  
**App id:** `com.uniapplab.unilive`  
**Config:** `artifacts/instacollab/capacitor.config.ts`  
**Shells:** `artifacts/instacollab/ios`, `artifacts/instacollab/android`  
**Live load:** `CAP_SERVER_URL=https://app.uniapplab.com` → WebView loads production SPA

---

## Capacitor WebView model

- Native shell wraps the same web/PWA build (`webDir: dist/public`) or live URL.
- `server.hostname`: `app.uniapplab.com`; schemes `https` on iOS/Android.
- Camera/mic for live/calls: **browser `getUserMedia` inside WebView**, not Capacitor Camera plugin.
- **No `@capacitor/camera` dependency** in app package.

---

## Camera / microphone paths

### Permissions

| Platform | Declared |
|----------|----------|
| iOS | `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, photo library (+ add) in `ios/App/App/Info.plist` |
| Android | `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, FGS mic/camera in `AndroidManifest.xml` |

### Acquisition (JS)

| Path | Role |
|------|------|
| `lib/camera/cameraAcquire.ts` | Canonical `getUserMedia` |
| `lib/camera/appCameraOwner.ts` | Single-owner lease (+ audio-only fallback GUM) |
| `lib/camera/useCameraStream.ts` | React acquisition |
| `lib/chat/useChatCall.ts` | Call preview GUM (parallel path — QA contention risk) |
| Karaoke / voice / DeepAR | Additional mic/camera GUM sites (see FUNCTION-MAP audit) |

### LiveKit publish

`lib/livekit/liveKitVideoPublish.ts` — replace/publish `LocalVideoTrack` from processed `MediaStreamTrack`.

---

## Camera ownership audit (native QA focus)

Duplicate / contention risks on device:

1. **Canonical lease** (`appCameraOwner`) vs **call path** (`useChatCall` direct GUM)
2. **Voice changer / karaoke / singing** mic GUM while live camera lease held
3. **DeepAR** audio GUM alongside beauty pipeline
4. Switching tabs mid-call / mid-live without cleanup → black preview / permission stuck

Expected cleanup: `releaseAppCamera` + stop tracks on leave live / end call.

---

## Push (FCM / APNS)

| Layer | Path |
|-------|------|
| Client registry | `lib/push/pushDeviceRegistry.ts`, `pushDeviceLifecycle.ts` |
| API | `artifacts/api-server/src/routes/push.ts` |
| DB | `push_devices` (platforms: `apns` \| `fcm` \| `web_push`) |

**APNS readiness:** registration model exists; **VoIP / PushKit not enabled**. iOS `UIBackgroundModes` = **`audio` only** (no `voip`, no remote-notification entitlement path wired for CallKit wake).

---

## CallKit / Telecom

| Piece | Status |
|-------|--------|
| JS bridge | `lib/chat/nativeIncomingCallBridge.ts` — flags default **false**; never fakes ready |
| iOS CallKit manager | `ios/App/App/IncomingCallKitManager.swift` — `FEATURE_ENABLED = false`; no PushKit |
| Android FGS | `CallForegroundService` declared (`microphone\|camera`) — starts only when bridge stub enabled |
| Production path today | In-app + browser notifications only |

Blockers documented in bridge: Apple VoIP cert, physical CallKit QA, Android FGS declarations, Capacitor plugin `UniLiveIncomingCall` absent/not ready.

---

## OAuth / deep links

- iOS URL scheme: `com.uniapplab.unilive`
- Android intent filters: `com.uniapplab.unilive` / `auth/callback`
- Must return to product origin, not localhost (`lib/auth/nativeOAuth.ts`, `redirectUrl.ts`)

---

## Boot

`lib/bootNativeShell.ts` — probes native incoming-call readiness (expects not-ready until flags + native land).
