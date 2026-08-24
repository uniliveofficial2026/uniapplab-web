# 12 — Change Log

All entries are Stage A documentation / verification unless noted. **uiUxChanged: false**

| When (UTC) | Change | Scope | uiUxChanged |
|---|---|---|---|
| 2026-08-23T06:49:55Z | Baseline backup created: `backups/production-hardening/baseline-20260823T064955Z` (tracked.diff, status, untracked list) | backup | false |
| 2026-08-23T06:49:57Z | Production-hardening workspace started (branch `fix/vercel-api-root-now` @ `54656e48f9358d5be5d4192529510f07a5bb2f3d`) | docs/workspace | false |
| 2026-08-23 | Docs scaffold created under `docs/production-hardening/` (`00`–`14` + reverify template) | docs only | false |
| 2026-08-23 | Typecheck started on api-server; known FAIL: DevAgentChatResult grounded fields | verify | false |

## 2026-08-23T09:46:00Z — Browser mount smoke matrix (Posts/Reels/Calls/Admin-embed + contracts)
- Added Playwright smokes (shared `PLAYWRIGHT_BROWSERS_PATH` / `visual-baseline-shared` launch pattern): `smoke:posts-feed-mount`, `smoke:reels-mount`, `smoke:calls-ui-mount`, `smoke:admin-embed-mount`.
- Results vs `http://127.0.0.1:5173` demo shell (`launch=main&as=u1&force_demo=1`):
  - Posts feed mount **PASS** (STORIES strip)
  - Reels mount + first `<video data-playback-scope=managed>` **PASS**
  - Calls UI outgoing **PASS** (`call.outgoing.v1` after DM Audio call)
  - Admin embed gift-preview **PASS** (`/admin-embed/gift-preview`)
  - PK invite browser E2E **CONTRACT_ONLY** (no authless route; Room-gated)
  - Workspace Admin Panel **CONTRACT_ONLY** (staff access-code gate; no secrets in smoke)
- Source contracts: `test/stage-a-mount-contracts.test.mjs` → **7/7 PASS** (PKInviteSheet, Team/1v1 PK, WorkspaceGate/AdminControlCenter, AppNativeVideo, outgoing call wiring).
- package.json scripts updated. uiUxChanged: false. Stage B locked. No production RTC cutover.

## 2026-08-23T09:32:00Z — Pixel visual baselines + Messages/Marketplace mount smokes
- Added Stage A pixel baseline infra under `artifacts/instacollab/test/visual-baselines/` (PNG + `manifest.json` + README).
- Shared helpers: `scripts/lib/visual-baseline-shared.mjs` (Playwright launch, ensure vite/preview or start briefly, auth-gate skip, sharp RGBA pixel diff; SHA-256 short-circuit).
- Capture: `scripts/capture-visual-baselines.mjs` + `pnpm visual:capture-baselines` → home-feed, messages, live-create-room, marketplace (**4 captured, 0 auth-skip**).
- Compare: `test/visual-pixel-baselines.test.mjs` + `pnpm test:visual-pixel` → **2/2 PASS** (create-room ~1.29% mismatch under 5% limit).
- Smokes: `smoke:messages-mount` (**PASS** `#messages-screen`), `smoke:marketplace-mount` (**PASS** `#marketplace-modal`).
- uiUxChanged: false. Stage B locked. Pixel baseline blocker cleared; full E2E matrix still open. No production RTC cutover.

## 2026-08-23T09:25:00Z — Notifications/push DEVICE↔PERSON hardening
- Audited registration / login reassignment / logout clear / multi-device / APNS-FCM token mapping vs PERSON identity.
- Added pure registry `src/lib/push/pushDeviceRegistry.ts` + lifecycle `pushDeviceLifecycle.ts` (DEVICE id ≠ PERSON; token uniqueness; multi-device).
- Fixed stale-person bugs: logout clears person binding (keeps stable `unilive_device_id`); account switch rebinds device to new person; notification realtime rejects rows when subscribed user ≠ current person; presence offline on surface stop + logout handoff.
- Identity-scoped storage prefix `unilive.push.person.` (device id intentionally NOT identity-scoped).
- Contract tests: `test/push-device-identity.test.mjs` → **8 PASS**.
- uiUxChanged: false. Stage B locked. No secrets / no production RTC cutover.

## 2026-08-23T09:10:00Z — Live room mount smoke + visual lock expansion
- Inventory: Playwright/e2e/smoke under `artifacts/instacollab` — `scripts/install-playwright-browsers.mjs`, `smoke-full-app.mjs`, `smoke-manage-tab.mjs`, `smoke-platform-runtime.mjs`, `smoke-camera-pipeline.mjs`, `smoke-greedy-tap.mjs`, capture/parity Playwright helpers; `pnpm playwright:install` / `smoke:*`.
- Installed Chromium via existing installer → `PLAYWRIGHT_BROWSERS_PATH=/Volumes/Wei2TB/MacData/tools/playwright-browsers` (PASS).
- Added `scripts/smoke-live-room-mount.mjs` + `smoke:live-room-mount`: demo shell → `instant-room-open` → `InstantRoomEntryHost` `/room/create` → Create Room heading (PASS against `http://127.0.0.1:5173`).
- Expanded `test/visual-regression-lock.test.mjs` structural fingerprints: Messages, Calls, Marketplace, Seller, Orders, PK (+ existing Live surfaces) → **22 PASS**.
- Live/PK contracts re-run: team-pk / one-vs-one-pk / pk-team-topology → **31 PASS**; no contract fixes required this slice.
- uiUxChanged: false. Stage B locked. Stage A acceptance still NOT PASSED (pixel baselines + full E2E matrix open). No production RTC cutover.

## 2026-08-23T08:55:00Z — Marketplace ledger separation + thermal perception cadence
- Ledger lanes: `lib/ledger/ledgerLanes.ts` — gift wallet vs commerce/seller storage keys; seller coin earnings → `commerce_host_coin_earnings` (not spendable `coins_balance`).
- Fixed cross-ledger contamination: local commerce coin settle no longer `creditUserCoins`; local gift receive credits `diamonds_balance` via `creditLocalGiftDiamonds`.
- Cloud commerce still uses `transferCoins` for buyer debit (platform gap until `commerce_settle` RPC); also records seller earnings on commerce lane.
- Thermal: `perceptionIntervalMs` / `perceptionOutputFps` wired into FaceAR face+BG segmentation, WebAR `getOutput` (attach-only), DeepAR `captureStream` — no beauty reset / gift restart.
- Tests: `marketplace-ledger-separation.test.mjs` (5), `thermal-perception-cadence.test.mjs` (5); wallet-authority still PASS.
- uiUxChanged: false. Stage B locked. No secrets / no production RTC cutover.

## 2026-08-23T08:50:00Z — Native call assessment + PK topology clamp
- Assessed Capacitor iOS/Android: CallKit/PushKit and Telecom/FGS **required** for store background incoming calls; **absent** today.
- Scaffolded fail-closed `nativeIncomingCallBridge` (feature flags default OFF; never fake success) + Android/Swift stubs + README.
- Wired probe into `chatCallNotifications` / `bootNativeShell` without UI redesign.
- Fixed PK team roster/layout mapping: prefer declared `teamSize`, clamp host/opponent ids to topology, legacy seat pad up to 6v6; kept LiveKit `track.attach()`.
- Tests: `native-incoming-call-readiness.test.mjs`, `pk-team-topology.test.mjs` (+ updated team PK UI source locks).
- uiUxChanged: false. Stage B locked. No production RTC cutover.

## 2026-08-23T08:45:00Z — Posts + Reels Stage A hardening
- Posts delete: client requires session `userId` + `author_id` filter (Supabase + Firebase ownership check).
- Create paths: logged-in `addPost` / `addReel` bind author to `currentUser` (no spoofed author).
- Comments: enrich + like actors forced to session id; engagement apply uses inbound helpers (fixed broken isSaved ternary).
- Reels thermal: `computeReelVideoPreload` uses `allowPrefetch` + `fxBudget >= 0.55` for offscreen metadata.
- Tests: `test/posts-reels-stage-a.test.mjs` (12) + `scripts/test-reels-playback.mjs` PASS.
- uiUxChanged: false. Stage A acceptance still NOT PASSED (browser E2E matrix open). Stage B locked.

## 2026-08-23T08:35:00Z — Autonomous Stage A continuation
- Gift: `GiftPlaybackScheduler` / `GiftComboAggregator` (FIFO, maxActiveFullGiftEffects=1, comboSessionId aggregation, quantity units, no restart on combo update, ACTIVE_FX expiry).
- Gift authority: settlement id required for paid FX/credit; local demo mints `local_settle_*`; Room + overlay gated.
- Likes: loss-tolerant LiveKit publish (`reliable: false`); thermal fxBudget caps particles.
- Room topology policy: removed global maxParticipants=50; LiveKit ensureRoom uses topology caps.
- Network QoE governor + capability-driven simulcast publish profile; telemetry feeds QoE.
- Identity: canonical PERSON/DEVICE/SESSION layers; logout clears identity-scoped storage prefixes.
- Supabase: applied revoke anon execute on `is_platform_admin`.
- CI: gift-scheduler, wallet, visual-lock, rtc-policy, gift settle tests.
- Visual structural lock tests for live gift/beauty/solo/multi surfaces.
- Media render graph + newest-frame-only gate contracts (no UI change).
- `pnpm --filter @workspace/instacollab run build` PASS; typecheck PASS.
- uiUxChanged: false. Stage A acceptance NOT PASSED. Stage B locked. No production RTC cutover.

## Not in this log

- Pre-existing dirty tree (~602 porcelain entries) — not attributed to Stage A hardening docs.
- Stage B — NOT STARTED
- Production deploys — none (policy)

## 2026-08-23T07:16:38Z
- Fixed api-server admin-control-plane typecheck (`grounded` on DevAgentChatResult returns; listUsers typing; projectId nullability).
- Full workspace `pnpm run typecheck` → PASS.
- Reconfirmed gifts/wallet/livekit-auth unit tests PASS.
- uiUxChanged: false. No production deploy. Stage B not started.

## 2026-08-23T07:20:45Z
- Confirmed gift combo now accumulates **quantity units** (not event count).
- Confirmed liveRoomBus forces LiveKit participant identity over spoofed senderId.
- Confirmed hostLiveKitTelemetry uses bitrate delta (not raw bytesSent).
- Like path: local FX immediate + 120ms network batch with `count` (receive applies batchCount).
- Added invisible `thermalGovernor` and started it from `main.tsx` (no UI).
- uiUxChanged: false. Stage B still locked.

## 2026-08-23T07:24:24Z
- PK tiles: `PkUserCamera` now prefers LiveKit `attach()` (`liveKitTrack`) so adaptiveStream/dynacast remain active; OneVsOne + Team containers updated. No UI redesign.
- Full `pnpm run typecheck` PASS after PK wiring.
- uiUxChanged: false. No production deploy. Stage B locked.

## 2026-08-23T09:15:00Z — Commerce settle RPC + Live smoke
- settle_commerce_coin_sale applied (commerce_coin_earnings lane).
- Playwright live-room mount smoke PASS; visual-lock 22 PASS.
- uiUxChanged: false. Stage A NOT PASSED. Stage B locked.

## 2026-08-23T09:52 — Final docs checkpoint
- Revalidated unit/mount battery (exit 0): gift-scheduler, wallet, visual-lock, posts-reels, push, stage-a-mount-contracts
- Wrote FINAL-STATUS.json, FINAL-PRODUCTION-REPORT.md, FINAL-VALIDATION-MATRIX.md, FINAL-FILE-CHANGE-MANIFEST.md, RTC-ARCHITECTURE-FINAL.md, RTC-USAGE-METERING-FINAL.md, PROVIDER-INDEPENDENCE-FINAL.md
- Stage A acceptance still NOT_PASSED; Stage B locked; production RTC cutover not performed
- uiUxChanged: false

## 2026-08-24T00:20 — Stage A continuation (auth push native stress)
- Applied Supabase: revoke authenticated/anon execute on is_platform_admin; create push_devices + RLS deny client
- API: POST /api/push/register, /clear-person, GET /devices (person from auth only)
- FaceAR: NewestFrameOnlyGate + publishSharedVisionState (camera never waits on AI)
- Android CallForegroundService + FGS permissions (FEATURE_ENABLED=false)
- iOS IncomingCallKitManager (FEATURE_ENABLED=false; no PushKit/voip mode)
- Fixed accountSwitchFast import breakage
- Tests: gift-storm, identity-foundation, social-graph, media-games, pk-seat, messages-outbox; CI extended
- LiveKit check PASS; Cloudflare wrangler EXTERNAL_AUTH_BLOCKED; Vercel deployments inspected
- uiUxChanged: false; Stage A NOT_PASSED; Stage B locked; no production RTC cutover

## 2026-08-24T00:35 — Native builds + CallKit linked
- Android `./gradlew :app:assembleDebug` BUILD SUCCESSFUL
- iOS simulator build (iPhone 17 / OS 26.4) BUILD SUCCEEDED with IncomingCallKitManager.swift + CallKit.framework linked (FEATURE_ENABLED=false)
- Live gift panel deep smoke: soft-SKIP go_live_requires_stable_host_session (create host flake; not claimed PASS)
- Cloudflare still EXTERNAL_AUTH_BLOCKED
- Stage A acceptance still NOT_PASSED; Stage B locked

## 2026-08-24T00:59:30Z — Live gift panel smoke PASS
- Fixed InstantRoomEntryHost teardown on full-embed back routes
- `smoke:live-gift-panel` PASS (liveRoom + giftPanel)
- Stage A still NOT_PASSED overall; Stage B locked
