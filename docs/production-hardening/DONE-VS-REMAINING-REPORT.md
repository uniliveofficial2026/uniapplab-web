# UniLive’s Production Hardening — DONE vs STILL NEEDED

**Report date (UTC):** 2026-08-24T00:42:57Z  
**Branch:** `fix/vercel-api-root-now`  
**HEAD:** `374d9e8+` (Stage A continuation pushed)  
**uiUxChanged:** `false`  
**Stage B (own RTC):** **NOT STARTED**  
**Production deploy / RTC cutover:** **NOT PERFORMED**  
**Stage A acceptance:** **NOT PASSED**

Authoritative machine progress: `AUTONOMOUS-PROGRESS.json`

## Newly completed this continuation (2026-08-24)
- Supabase: revoke authenticated `is_platform_admin` execute; `push_devices` table + `/api/push/*`
- FaceAR newest-frame SharedVision gate
- Android CallForegroundService + FGS perms; iOS CallKit manager linked (flags OFF)
- Native builds: Android assembleDebug PASS; iOS iPhone 17 sim BUILD SUCCEEDED
- Tests: gift-storm, identity, social-graph, media-games, pk-seat, messages-outbox, reels thermal preload
- Playwright mount smokes PASS; live gift deep smoke soft-SKIP (go-live host session unstable)

## Still required before Stage A PASS
- Stable go-live → gift panel browser E2E
- PK invite live-session E2E; multi-guest load; multi-device
- Remote APNS/FCM send
- Cloudflare auth (EXTERNAL_AUTH_BLOCKED)
- CallKit/PushKit/Android FGS FEATURE_ENABLED + device QA

## Stage B
LOCKED until Stage A acceptance PASS
