# Live host state-machine — root cause (2026-08-25)

## Verdict
`fullRealApplication = FAIL` (unchanged)

## Physical evidence (prior)
- `live-chat-input` FAIL after 284s on `index-B6fNt2f1.js`
- Navigation reached Live → Go Live

## Root cause (application state, not keyboard/AX)
`CreateRoom` defaults `mode` to **`Chat`**.

`SoloLiveView` (and therefore `live-chat-input`) only mounts when `Room.tsx` has `roomMode === 'SoloLive'`, which requires settings `roomMode` of **`Solo-Live`**.

Go Live from Live discovery previously opened `/room/create` **without** seeding Solo-Live. If XCUITest failed to tap the tiny "Solo" mode chip (or cloud hydrate overwrote mode back to Chat), launch entered a **Chat/Party room** — a state where `live-chat-input` can never mount. Waiting longer cannot surface it.

Chat visibility once SoloLiveView mounts: `chatComposerOpen` defaults to `true`; toggle is "Show chat" / "Hide chat".

## Fixes
1. `openGoLiveCreateRoom({ mode: 'Solo-Live' })` writes `uni.createRoom.hint`
2. CreateRoom retains Go Live hint across async cloud hydrate
3. Deterministic `data-live-qa-state` / aria landmarks for each host state
4. XCUITest asserts each transition and fails early with classified codes:
   `NAVIGATION_FAILED` | `PERMISSION_BLOCKED` | `APPLICATION_STATE_FAILED` | `LANDMARK_NOT_FOUND`

## Camera / Mic
TCC interruption monitors run during host launch. Permission pending is exposed as `live-permission-camera-pending` — not deferred behind chat PASS.

## Bundle after fix
`assets/index-BMgZgBS_.js` (pending production deploy)
