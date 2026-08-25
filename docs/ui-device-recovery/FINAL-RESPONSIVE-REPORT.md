# FINAL-RESPONSIVE-REPORT

## Verdict

`fullRealApplication`: **FAIL** (83-surface + Live/camera/RTC matrix incomplete)

`productionSpaRolledForward`: **PASS**

## Production identity (2026-08-25)

| Field | Value |
|-------|-------|
| Entry JS | `assets/index-D5djAASz.js` |
| Entry CSS | `assets/index-CfgA_FXS.css` |
| build-identity.json | live at `/build-identity.json` |
| Keyboard SSOT bundle | contains `KeyboardResize`, `app-composer-bottom-inset` |
| Messages chunk | `MessagesScreen-BZo-atFW.js` with `aria-label="chat-input"` |

## Physical iPhone (Wei · 14 Pro Max)

| Test | Result |
|------|--------|
| XCUITest signed-in-shell | **PASS** |
| XCUITest Messages → thread → chat-input focus | **PASS** |
| Live chat keyboard | NOT_TESTED |
| Camera/Mic | NOT_TESTED |
| iPhone↔Mac call/live | NOT_TESTED |

## Root cause fixed (WKWebView automation)

XCUITest queries by identifier failed; WKWebView exposes **aria-label** (e.g. `signed-in-shell, main`). UITests now match `label CONTAINS` tokens.

## Remaining to full PASS

Live composer, marketplace/seller forms, 83-surface matrix, camera/mic TCC, RTC cross-device, account switch isolation.

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
