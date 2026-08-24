# FINAL-FILE-CHANGE-MANIFEST (Stage A continuation highlights)

Primary new/modified modules (non-exhaustive; large dirty tree also contains pre-existing work):

## Gifts / realtime
- `artifacts/instacollab/src/lib/live/giftPlaybackScheduler.ts`
- `artifacts/instacollab/src/lib/live/giftAuthority.ts`
- `artifacts/instacollab/src/smule-rooms/components/GiftPlayOverlay.tsx`
- `artifacts/instacollab/src/lib/livekit/liveRoomBus.ts`
- `artifacts/instacollab/src/smule-rooms/hooks/useLiveRoomBus.ts`
- `artifacts/instacollab/src/smule-rooms/pages/Room.tsx`
- `artifacts/instacollab/src/lib/partyGiftPayments.ts`
- `artifacts/instacollab/src/lib/live/giftEconomy.ts`

## RTC / QoE / topology
- `lib/rtc/roomTopologyPolicy.mjs` + `artifacts/instacollab/src/lib/rtc/roomTopologyPolicy.ts`
- `artifacts/instacollab/src/lib/rtc/networkQoEGovernor.ts`
- `artifacts/instacollab/src/lib/rtc/liveKitPublishProfile.ts`
- `artifacts/instacollab/src/lib/rtc/realtimeReplayPolicy.ts`
- `lib/livekit/index.mjs`
- `supabase/functions/livekit/index.ts`
- `artifacts/instacollab/src/lib/livekit/hostLiveKitTelemetry.ts`
- `artifacts/instacollab/src/lib/livekit/liveKitVideoPublish.ts`

## Identity / calls / push
- `artifacts/instacollab/src/lib/identity/canonicalIdentity.ts`
- `artifacts/instacollab/src/lib/auth/authHandoff.ts`
- `artifacts/instacollab/src/lib/chat/callLifecycleState.ts`
- `artifacts/instacollab/src/lib/chat/useChatCall.ts`
- `artifacts/instacollab/src/lib/chat/nativeIncomingCallBridge.ts`
- `artifacts/instacollab/src/lib/push/pushDeviceRegistry.ts`
- `artifacts/instacollab/src/lib/push/pushDeviceLifecycle.ts`

## Commerce / thermal / media
- `supabase/migrations/20260823130000_settle_commerce_coin_sale.sql`
- `artifacts/api-server/src/routes/wallet.ts`
- `artifacts/instacollab/src/lib/commercePayments.ts`
- `artifacts/instacollab/src/lib/ledger/ledgerLanes.ts`
- `artifacts/instacollab/src/lib/performance/thermalGovernor.ts`
- `artifacts/instacollab/src/lib/media/mediaRenderGraph.ts`
- `artifacts/instacollab/src/components/reels/ReelsScreen.tsx`
- `artifacts/instacollab/src/smule-rooms/components/GameLivePanel.tsx`

## Tests / CI / docs / baselines
- `artifacts/instacollab/test/gift-playback-scheduler.test.mjs`
- `artifacts/instacollab/test/visual-regression-lock.test.mjs`
- `artifacts/instacollab/test/visual-baselines/**`
- `artifacts/instacollab/scripts/smoke-*.mjs`
- `.github/workflows/ci.yml`
- `docs/production-hardening/**`
