# FINAL DEVICE MATRIX

| Device | OS | App build | Feature | Network | Camera | Mic | Result |
|---|---|---|---|---|---|---|---|
| iPhone 14 Pro Max | iOS 26.6 | Cap Debug `com.uniapplab.unilive` @ prod URL | Install/Launch | Wi-Fi | n/a | n/a | PASS |
| iPhone 14 Pro Max | iOS 26.6 | Cap @ `/go-live` deep-link | Solo Live start | Wi-Fi | interactive TCC | interactive TCC | EXTERNAL_INTERACTIVE_TCC |
| MacBook Air | macOS | Chrome Playwright real GUM | Production origin GUM | Wi-Fi | FaceTime HD | Built-in | PASS |
| iPad | — | — | — | — | — | — | EXTERNAL_DEVICE (offline) |
| Android | — | `app-debug.apk` built | Install | — | — | — | EXTERNAL_DEVICE (none attached) |
| Two-device call/PK | — | — | Audio/Video/PK | — | — | — | EXTERNAL_SECOND_DEVICE |

APK path: `artifacts/instacollab/android/app/build/outputs/apk/debug/app-debug.apk`
iOS app: `/tmp/unilive-ios-dd/Build/Products/Debug-iphoneos/App.app`
