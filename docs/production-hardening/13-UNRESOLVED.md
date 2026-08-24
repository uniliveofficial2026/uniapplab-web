# 13-UNRESOLVED

Updated: 2026-08-24T00:20:00Z

## External / access
- Cloudflare MCP: needsAuth (optional inspection) — not blocking independent work
- LiveKit CLI / wrangler often absent — SDK/API/scripts used instead
- Production deploy / RTC cutover: intentionally blocked until gates pass
- Leaked-password protection (Supabase Auth): WARN — enable in dashboard (external product setting)

## Native incoming calls (assessed 2026-08-23)

**Verdict: required for production store background/killed incoming calls; not ready.**

| Platform | Capability | Capacitor status | Notes |
|---|---|---|---|
| iOS | CallKit | NOT PRESENT | `AppDelegate.swift` has no CXProvider; `chatCallKit` is web-style naming only |
| iOS | PushKit (VoIP) | NOT PRESENT | `Info.plist` `UIBackgroundModes` = `audio` only — do **not** add `voip` until PushKit is real |
| Android | Telecom / ConnectionService | NOT PRESENT | No Telecom entries in `AndroidManifest.xml` |
| Android | mic/camera FGS | NOT PRESENT | Permissions for CAMERA/RECORD_AUDIO exist; no `FOREGROUND_SERVICE*` |

**Live path today:** in-app ring + browser `Notification` via `chatCallNotifications.ts` (foreground / granted notification permission only).

**Scaffolding (flags default OFF, no fake success):**
- `src/lib/chat/nativeIncomingCallBridge.ts` — readiness probe + `tryPresentNativeIncomingCall` always fails closed until plugin + flags ready
- `native-scaffolds/incoming-call/` — README + Swift stub (not linked into Xcode target)
- `android/.../call/IncomingCallBridgeStub.kt` — returns false; not registered as ConnectionService/FGS

**True external blockers:**
- Apple VoIP push certificate + PushKit entitlement
- Physical iOS device CallKit verification
- Android 14+ FGS type declarations (`microphone`, `camera`) + Play policy
- Physical Android device Telecom + FGS verification

## PK topology / invite E2E (remaining)

- **No authless public route** for `PKInviteSheet` — only opens inside live `Room` after host action
- Browser/native E2E for invite accept + 1v1–6v6 dual-room stress still open
- Structural visual lock + topology + `stage-a-mount-contracts` cover Team/1v1 PK + invite sheet source (PASS)

## Admin panel

- `/workspace` **Admin Panel** requires staff access code every visit — secretless Playwright E2E intentionally skipped
- Secretless admin surface covered: `smoke:admin-embed-mount` → `/admin-embed/gift-preview` **PASS**
- `AdminControlCenter` + `WorkspaceGate` source contracts **PASS**

## Marketplace / ledger (partial)

**Still open:**
- Marketplace/seller/orders full browser E2E beyond mount smoke
- Creator Marketplace modal buy still non-charging (Shell demo)

**Closed:** Shop-live commerce uses `settle_commerce_coin_sale` / `/api/wallet/commerce-settle` (not gift `transfer_coins`). Marketplace modal mount smoke + pixel baseline PNG. Server `push_devices` table + `/api/push/*`.

## Thermal / beauty (partial)

**Still open:**
- Mid-session WebAR FPS rebind without stream restart (intentionally not done to avoid beauty/gift disruption)
- Shared vision graph adoption by all WebAR/DeepAR pipelines (contracts exist; full adoption pending)
- Long-run thermal→memory stress suites

## Notifications / push (Stage A partial — 2026-08-23)

**Local DEVICE↔PERSON binding: hardened.**

**Still external / not done:**
- Remote APNS/FCM provider send path + server-side device token table (certs / provider credentials)
- End-to-end push delivery on physical iOS/Android devices
- VoIP PushKit path remains absent (see native incoming calls)

## Visual baselines (Stage A — closed prior slice)

**PASS:** `pnpm visual:capture-baselines` + `pnpm test:visual-pixel` for home-feed, messages, live-create-room, marketplace.

## Stage A still open (continue)
- PK invite live-session browser E2E (blocked on authless route / live host session)
- Workspace Admin Panel E2E (blocked on access-code secret policy)
- Native CallKit / Android call FGS (**assessed + scaffolded; implementation blocked on certs/devices**)
- Games open/close resource cleanup audit
- Remote push provider (APNS/FCM send + server device registry)
- Marketplace/seller/orders full E2E + `commerce_settle` RPC
- Long-run stress memory suites

## Closed this slice
- `smoke:posts-feed-mount` **PASS**
- `smoke:reels-mount` **PASS** (mount + first video element)
- `smoke:calls-ui-mount` **PASS** (outgoing call chrome)
- `smoke:admin-embed-mount` **PASS**
- `test:stage-a-mount-contracts` **7/7 PASS** (PK + Workspace Admin + reel video wiring + calls)

## Do not start
- Stage B UniLive RTC packages until Stage A acceptance matrix PASS
