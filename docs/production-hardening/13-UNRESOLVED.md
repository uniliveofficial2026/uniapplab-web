# 13-UNRESOLVED

Updated: 2026-08-24T03:22:00Z

## External / access
- Cloudflare Workers/R2 inventory via MCP: **ACCESSIBLE** (workers: empty-recipe-8fd7, uniapplab-media, uniapplab-web; R2: livestream-assets, uniapplab-media). Further repair/observability may still need account-scoped auth for mutating ops.
- LiveKit CLI / wrangler often absent — SDK/API/scripts used instead
- Production deploy / RTC cutover: intentionally blocked until gates pass
- Leaked-password protection (Supabase Auth): WARN — enable in dashboard (external product setting)
- `WORKSPACE_STAFF_CODE` unset on api-server → `/api/workspace/unlock` returns 503; UI E2E uses DEV local fallback (never print code)

## Native incoming calls (assessed 2026-08-24)

**Verdict: required for production store background/killed incoming calls; fail-closed scaffolds present; FEATURE_ENABLED=false.**

| Platform | Capability | Status | Notes |
|---|---|---|---|
| iOS | CallKit | LINKED, OFF | `IncomingCallKitManager.FEATURE_ENABLED = false` until VoIP cert + device QA |
| iOS | PushKit (VoIP) | NOT READY | Do **not** add `voip` UIBackgroundModes until PushKit is real |
| Android | Telecom / ConnectionService | STUB | `IncomingCallBridgeStub.FEATURE_ENABLED = false` |
| Android | mic/camera FGS | SCAFFOLD, OFF | FGS class present; flag false until Play policy + device QA |

**True external blockers:** Apple VoIP push certificate + PushKit entitlement; physical iOS/Android device QA.

## PK topology / invite E2E (remaining)

- **PASS (invite path):** `smoke:live-pk-invite-stage`
- **PASS (lifecycle round1):** `smoke:live-pk-lifecycle` invite→accept→active→timer sync→host end→both clear
- **OPEN:** round2 rediscovery / leak-free repeat; gift-score delta during active PK in same smoke; reconnect mid-PK
- Structural visual lock + topology contracts remain PASS

## Calls deeper E2E

- Unit lifecycle mapping PASS (busy/cancel/missed/timeout/etc.)
- Outgoing UI smoke PASS
- Dual-context ring→accept→connected→hangup / decline / busy / timeout Playwright still open

## Push

- Registry + PERSON-from-auth + clear-person contracts PASS
- APNS/FCM provider send: **BLOCKED_EXTERNAL** (credentials)
- Instant-room open race fixed: module buffer + `useLayoutEffect` on `InstantRoomEntryHost`

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
- PK invite accept + dual-room live-session browser E2E
- Workspace Admin Panel E2E (blocked on access-code secret policy)
- Native CallKit / Android call FGS (**assessed + scaffolded; implementation blocked on certs/devices**)
- Remote push provider (APNS/FCM send)
- Marketplace UI open reliability under load (ledger contracts PASS; mount soft-skip paths)
- Long-run thermal→memory stress suites
- Games open/close resource cleanup audit — **contracts PASS** for GameLivePanel / useGameLiveKit / LocalGamePlayer
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
