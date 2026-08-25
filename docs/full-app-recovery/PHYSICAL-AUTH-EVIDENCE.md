# Physical iPhone Auth Evidence

## Device
- Wei · iPhone 14 Pro Max
- UDID `04E86E0A-14A3-524B-919C-EB7C477083EE` (devicectl paired)
- Bundle `com.uniapplab.unilive`

## Root causes found
1. **Bundled Cap uses `capacitor://app.uniapplab.com`** — WKWebView cannot register `https` as a custom scheme, so `iosScheme: https` falls back. Supabase auth from that origin fails with opaque `Script error`.
2. **Remote Cap (`server.url=https://app.uniapplab.com`) is required** for production-origin auth (CORS + cookies/localStorage).
3. **HTTPS payload-url handoffs are ignored** by production `isNativeOAuthCallbackUrl` (custom-scheme only) — must use `com.uniapplab.unilive://auth/callback#access_token&refresh_token`.
4. **Cold-start deep link race** — launch URL can arrive before auth boot; queue + flush + inline `setSession`/`refreshSession` added.
5. **Production path bug** — `pathname || "/home"` treated `/` as truthy → `/#tokens` same-document hash change; fixed to always `/home` in recovery SPA.

## Proven PASS (2026-08-25)
- Cap Debug install with `server.url=https://app.uniapplab.com`
- QA handoff: `UNILIVE_HANDOFF_MODE=scheme` dual-token deep link
- Canonical person `2a7e55d4…` / `@qa_device` / `profile_setup_complete=true`
- `presence_ephemeral` row written from device (`backend: postgres`)
- `/api/presence/online` 200 for same actor

## Still open
- XCUITest target not yet wired into Xcode project (scaffold exists)
- Camera/Mic TCC not yet triggered
- Improved Cap auth SPA (`index-D1fRbQ0P.js`) in `deploy/spa-public` not yet live on Render (prod still `index-Dt5hB1ac.js`)

## Verdict
Physical **session auth** unblocked on iPhone via remote Cap + scheme handoff.
`fullRealApplication` remains **FAIL** until signed-in shell navigation + media are proven.
