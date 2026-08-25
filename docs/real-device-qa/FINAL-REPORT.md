# UniLive’s REAL-DEVICE QA — FINAL REPORT

## Production
https://app.uniapplab.com — LIVE

## Base SHA
`9e8c44a587b00e217f7cc79aa97044ec664f3a00`

## Branch
`qa/production-real-device`

## uiUxChanged
false (visual lock **22/22 PASS**)

## Devices

| Device | Result |
|---|---|
| iPhone 14 Pro Max (iPhone15,3) iOS 26.6 | Cap `com.uniapplab.unilive` **installed + launched** with `server.url=https://app.uniapplab.com`; deep-link `/go-live` launched |
| MacBook Air FaceTime HD + built-in mic | **Real** `getUserMedia` against production origin — frame + probe JSON under `evidence/` |
| iPad | Offline — EXTERNAL_DEVICE_REQUIRED |
| Android phone | Not attached — EXTERNAL_DEVICE_REQUIRED; `assembleDebug` APK built |

## Honest hardware verdict

| Area | Status |
|---|---|
| Desktop real camera/mic GUM on production origin | **PASS** |
| iOS Cap install/launch/production config | **PASS** |
| iOS Cap interactive camera/mic/live (TCC Allow sheet) | **EXTERNAL_INTERACTIVE_TCC** — cannot auto-tap system permission without WDA |
| 1:1 call / dual-host PK / multi-guest | **EXTERNAL_SECOND_DEVICE_REQUIRED** |
| APNS / CallKit | **EXTERNAL_APNS_CREDENTIAL** (FEATURE_ENABLED=false) |

Simulator / Playwright fake-device media were **not** used as PASS for device-dependent items.

## Proven (software + contracts)

- Function / dataflow / identity / RTC / native / provider maps
- Camera ownership audit (`appCameraOwner` canonical; karaoke/voice/DeepAR parallel mic noted)
- LiveKit boundary allowlist + CI mapping gate (`pnpm run test:real-device-mapping`)
- Production health: UniLiveRTC + LiveKit + greedy healthz
- Stage A security/mount, Stage B/C/D **PASS**
- Visual lock **22/22**
- Defect: production LocalGamePlayer must not probe `127.0.0.1` (DEV-gated)

## Remaining external only
1. Second physical device (iPad online or Android attached)
2. Interactive TCC Allow on Cap for Solo Live / beauty / mic routing proof
3. APNS credential + CallKit entitlements before native push PASS
