# FINAL NATIVE

| Surface | Status | Notes |
|---|---|---|
| Capacitor iOS | PASS build/install/launch | `server.url=https://app.uniapplab.com`; bundle `com.uniapplab.unilive` |
| Capacitor Android | PASS assembleDebug | APK ready; no physical device attached |
| NSCameraUsageDescription | present | Info.plist |
| NSMicrophoneUsageDescription | present | Info.plist |
| UIBackgroundModes audio | present | media continuity |
| CallKit / PushKit | FEATURE_ENABLED=false | EXTERNAL_APNS_CREDENTIAL |
| Android FGS call | fail-closed | Stage A contract PASS |

Do not flip CallKit/FGS flags without real credentials + device QA.
