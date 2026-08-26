# Live host state-machine — root cause (2026-08-25)

## Verdict
`fullRealApplication = FAIL` (unchanged)

## Failed state (physical)
Not a keyboard/AX timeout on `live-chat-input`.

Exact stuck state: **CreateRoom Solo setup never enters `live-countdown` / SoloLiveView**.

Evidence on device (prior runs on `index-BnupXPI0` / `index-5Q--sHwi` / `index-Dpejr59h` / `index-Cd3jFonH`):
- CreateRoom reached with Solo camera preview, caption seeded, Solo mode selected
- `live-go-live-launch` found and tapped (including coordinate taps)
- `handleCreate` never advanced (no countdown / no `live-launch-blocked-*`)
- Latest tip `index-LFsYfl3D.js` / live-version `09927f00b9cc` deployed; physical retest blocked by **automation mode timeout** (`AX_ATTACH_FAILED`)

## Root cause chain
1. CreateRoom defaulted to Chat → SoloLiveView never mounts without Solo-Live seed
2. Keep-alive CreateRoom ignored new Go Live hints → fixed via `uni:create-room-hint`
3. Caption required for launch → seed `Live`
4. WKWebView/XCUITest taps on Go Live do not invoke React handlers reliably
5. Auto-launch from discovery Go Live hint + retry until Solo+caption ready (`5b9ae84`)

## Fixes shipped (recovery → release)
| Commit | Change |
|--------|--------|
| d94243b+ | Solo seed + hint event |
| 87a2856 | launch landmarks / block reasons |
| e3d8d42 | CTA above home indicator + safe-area |
| 49f4329 | aria-disabled / Enter path |
| 9e8cbc5 | autoLaunch from Go Live |
| 5b9ae84 | autoLaunch retry via mode/name refs |

## Chat visibility (once SoloLiveView mounts)
`chatComposerOpen` defaults true; toggle Show/Hide chat — do not permanently force composer.

## Camera/Mic
Not deferred. TCC monitors present; pending state = `live-permission-camera-pending`.

## N-user (parallel)
A/B auth + wallet isolation + late HTTP race: PASS  
C/D: `BLOCKED_EXTERNAL` (fixtures missing)

## Next physical step
Unlock/trust iPhone automation mode, then re-run `testLiveChatComposerLandmark` on `index-LFsYfl3D.js`. Expect countdown within ~3s of Go Live entry if autoLaunch works.
