# Live host state-machine — root cause (2026-08-25)

## Verdict
`fullRealApplication = FAIL` (unchanged until SoloLiveView + live-chat-input proven)

## Physical evidence (prior)
- `live-chat-input` FAIL after 284s on `index-B6fNt2f1.js`
- Navigation reached Live → Go Live

## Root cause chain (application state, not keyboard/AX)

### 1) Mode never Solo
`CreateRoom` defaults `mode` to **`Chat`**. `SoloLiveView` / `live-chat-input` only mount when `roomMode === 'SoloLive'` (`Solo-Live` settings).

### 2) Hint not reapplied on keep-alive CreateRoom
CreateRoom can stay mounted; `uni:create-room-hint` must re-apply Solo + caption.

### 3) Launch CTA not receiving WebView clicks (current physical)
On `index-BnupXPI0.js`: Solo seeded, caption `Live`, `live-go-live-launch` found and tapped twice (including coordinate tap), but `handleCreate` never ran (no countdown / no `live-launch-blocked-*`).

AX showed mode chips at y≈796 on a 932pt screen — Go Live sat under/near the home indicator. XCUITest “taps” the AX node; WKWebView never gets `onClick`.

## Fixes
1. `openGoLiveCreateRoom({ mode: 'Solo-Live', roomName: 'Live' })` + `uni:create-room-hint`
2. CreateRoom retains / re-applies hint; exposes `live-go-live-launch`, `live-launch-blocked-*`, countdown/creating landmarks
3. Go Live CTA ordered **above** mode chips + `safe-area-inset-bottom` padding
4. XCUITest asserts each transition; fails early with:
   `NAVIGATION_FAILED` | `PERMISSION_BLOCKED` | `APPLICATION_STATE_FAILED` | `LANDMARK_NOT_FOUND`
5. Never joins an existing live card for this host test (viewer path ≠ Solo host)

## Camera / Mic
TCC monitors run during host launch. `live-permission-camera-pending` is asserted — not deferred behind chat PASS.

## Production tip (verify after each push)
Public HTML `assets/index-*.js` must return HTTP 200 (watch for Cloudflare poisoned 404 on new hashes).
