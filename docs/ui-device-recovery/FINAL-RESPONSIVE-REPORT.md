# FINAL-RESPONSIVE-REPORT

## Verdict

`fullRealApplication`: **FAIL**

Physical authority: Wei · iPhone 14 Pro Max was **offline** during this pass (`xctrace`: Devices Offline). Prior owner finding (keyboard covering inputs / layouts not fitting) remains authoritative until reconnect + retest.

## What landed (uiUxChanged=false)

1. **Keyboard strategy SSOT:** Capacitor `KeyboardResize.None` + plugin `keyboardHeight` → `--app-keyboard-inset` / `--app-composer-bottom-inset`.
2. **Safe-area SSOT:** `--app-safe-bottom` is static only (no longer inflated by keyboard).
3. **Viewport SSOT:** `lib/safeArea.ts` + `AppViewportProvider`; shell continues to use `h-vv`.
4. **Composers:** Messages, Solo Live footer, Multi-Guest chat, Call overlay use composer bottom inset; Messages/Live landmarks; 16px inputs to avoid iOS zoom.
5. **Bottom nav:** hidden while `html[data-keyboard-open=1]`.
6. **DEBUG:** `WKWebView.isInspectable` under `#if DEBUG`.
7. **Docs/gates:** `docs/ui-device-recovery/*`, `pnpm run test:ui-device-recovery` (static PASS).

## Commit / deploy

- Recovery SHA: `c52b7e88823ac736ea3c7543026e1a6837f43894`
- Pushed: `fix/restore-full-production-app` and `release/app-uniapplab-production`
- Production SPA at check time still served `index-BgQEkme3.js` (prior build) — await Render rollforward, then verify new hash.

## Remaining to PASS

1. iPhone reconnect
2. Confirm production SPA hash includes this commit
3. Physical Messages + Live keyboard matrix
4. Full panel/modal matrix
5. WKWebView WEBVIEW automation
6. Camera/Mic + iPhone↔Mac RTC
