# Accessibility / Automation

## Landmarks added/confirmed

- `signed-in-shell` (prior)
- `home-nav` (bottom nav)
- `chat-input` / `chat-send`
- `live-chat-input`

## DEBUG inspection

`AppDelegate` sets `WKWebView.isInspectable = true` under `#if DEBUG` (iOS 16.4+).

## XCUITest

Prior FAIL: Cap remote WKWebView landmarks invisible to XCUITest without WEBVIEW context.

Next: Appium/WDA `NATIVE_APP` → `WEBVIEW` after inspectable DEBUG builds — no fake QA buttons.
