# 13-UNRESOLVED

Updated: 2026-08-24T04:17:30Z

## External / access
- Cloudflare Workers/R2: **ACCESSIBLE** — `uniapplab-media` = media R2 worker; `uniapplab-web` = stub; `empty-recipe-8fd7` unused; R2 `uniapplab-media` + `livestream-assets`.
- LiveKit CLI often absent — SDK/API/scripts used instead.
- Production deploy / RTC cutover: blocked until Stage A PASS + explicit Stage B auth.
- Leaked-password protection (Supabase Auth): WARN — dashboard product setting.
- `WORKSPACE_STAFF_CODE`: satisfied via gitignored `.local/workspace-staff.env` + ensure-live-api (remote unlock PASS).

## Native incoming calls

**Verdict: required for store background/killed incoming; fail-closed scaffolds; FEATURE_ENABLED=false.**

| Platform | Capability | Status | Notes |
|---|---|---|---|
| iOS | CallKit | LINKED, OFF | Devices paired but **Offline**; no VoIP cert found after env/Keychain exhaust |
| iOS | PushKit (VoIP) | NOT READY | Do not add `voip` UIBackgroundModes until PushKit is real |
| Android | Telecom / FGS | SCAFFOLD, OFF | No adb devices; flag false |

## Closed this slice (do not re-open without regression)
- PK lifecycle round1+round2+reconnect+**gift score idempotent**
- Dual-party calls + reconnect + stale accept
- Workspace remote unlock
- Push registry remote table + ownership/multi-device
- FCM topic provider healthcheck (Firebase MCP)
- Cloudflare media worker role mapping

## Still open (automatable)
- Marketplace/seller/orders deep browser E2E beyond mount
- Reels decoder budget long-scroll
- Network QoE / thermal / beauty preservation E2E deepen
- Games open/close resource assertions deepen
- LiveKit temporary room create/grant/cleanup deepen
- Full visual regression expansion beyond 22 locks
- CI gate wiring if gaps remain
- Production web build + iOS Simulator revalidate this tip

## Push APNS
- APNS key/cert: **not found** in authorized sources after exhaust → remains external until provisioned

## Do not start
- Stage B UniLive RTC packages until Stage A acceptance **PASS**
