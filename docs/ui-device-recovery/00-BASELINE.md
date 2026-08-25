# UI / Device Recovery — Baseline

**Product:** UniLive's  
**Production:** https://app.uniapplab.com  
**Branch:** fix/restore-full-production-app  
**uiUxChanged:** false (responsive/keyboard/safe-area corrections only)

## Authoritative verdict (start of pass)

| Gate | Status |
|------|--------|
| fullRealApplication | **FAIL** |
| Auth (device-proven) | PASS |
| Presence durability | PASS |
| Profile → Home | PASS |
| Responsive / keyboard / camera / RTC UI | **FAIL** (owner physical finding) |

## Root causes targeted

1. Capacitor `KeyboardResize.Body` + visualViewport insets double-moved / failed to lift composers.
2. `--app-safe-bottom` incorrectly included keyboard height → bottom-nav min-height inflation.
3. No Cap plugin keyboard height SSOT wired into CSS variables.
4. WKWebView landmarks not inspectable in DEBUG for XCUITest/Appium.

## SSOT after this pass

- `lib/safeArea.ts` → CSS vars + snapshot subscribers
- `contexts/AppViewportContext.tsx` → React consumers
- Cap strategy: `KeyboardResize.None` + `keyboardWill/DidShow` height
- Tokens: `--app-safe-*`, `--app-vv-height`, `--app-keyboard-inset`, `--app-composer-bottom-inset`

## Inventory seed

- Screens in FULL-SCREEN-MANIFEST: **28**
- Routes in FULL-ROUTE-MANIFEST: **26**
