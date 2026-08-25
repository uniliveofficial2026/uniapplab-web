# UniLive Function Map (production QA)

**Base SHA:** `9e8c44a587b00e217f7cc79aa97044ec664f3a00`  
**Production URL:** https://app.uniapplab.com  
**RTC stack:** UniLiveRTC → LiveKitRTCProvider (`@unilives/rtc-livekit`) → LiveKit  
**uiUxChanged:** `false` (docs only)

Paths are relative to worktree root unless noted.

---

## Legend

| Column | Meaning |
|--------|---------|
| UI entry | Screen / control users tap |
| Component | Primary React surface |
| Handler | Hook / action / command |
| Domain | Domain module / orchestrator |
| SDK | Client SDK / package |
| API | HTTP route |
| DB/RPC | Table or Postgres RPC |
| Realtime | Bus / channel / postgres_changes |
| Provider | React context / lease owner |
| Cleanup | Teardown path |

---

## Auth / launch

| Field | Value |
|-------|--------|
| UI entry | Splash → onboarding → auth → profile_setup → trending → main |
| Component | `App.tsx`, launch hosts via `useLaunchRoute` |
| Handler | `lib/launchRoute.ts` `resolveLaunchRoute` |
| Domain | Auth session + IndexedDB launch progress |
| SDK | Supabase Auth (+ Firebase backup) |
| API | Auth via Supabase; platform session hydrate |
| DB/RPC | `profiles`, session storage |
| Realtime | Auth state listeners |
| Provider | Local DB / auth contexts |
| Cleanup | Identity-scoped storage clear on logout (`canonicalIdentity.ts`) |

---

## Live (go-live / watch)

| Field | Value |
|-------|--------|
| UI entry | Tab `/live`, CreateRoom, Party room modes (Solo-Live, Commerce-Live, Multi-Guest) |
| Component | `components/live/LiveScreen.tsx`, `smule-rooms/pages/{CreateRoom,Room}.tsx`, `SoloLiveView.tsx` |
| Handler | `lib/live/openLiveRoom.ts`, `platformStream.ts`, `hostMediaSession` |
| Domain | Live lifecycle + party rooms |
| SDK | UniLiveRTC / LiveKit via `lib/livekit/*`, `lib/unilive-rtc` |
| API | `/api/livekit/*`, `/api/live/rooms/*`, `/api/stream/*`, lifecycle routes |
| DB/RPC | `party_rooms`, `profiles.live_*`, lifecycle services |
| Realtime | LiveKit A/V + `useLiveRoomBus` / `party_room_sync_events` |
| Provider | Host media session + `appCameraOwner` lease |
| Cleanup | `permanentlyEndHostLive.ts` → end room, dispose LiveKit, `releaseAppCamera` |

---

## PK battles

| Field | Value |
|-------|--------|
| UI entry | PK invite / battle stage in Solo-Live / Commerce-Live; 1v1 video PK discovery |
| Component | `PKBattleStage.tsx`, `PKInviteSheet.tsx`, `OneVsOnePkSessionContainer.tsx`, `TeamPkSessionContainer.tsx` |
| Handler | `usePkLiveHosts`, challenge accept/start |
| Domain | `lib/unilive-rtc/pkDomain.ts` → `createPkOrchestrator`; `pkBattleReducer.ts` |
| SDK | UniLiveRTC + LiveKit media |
| API | `/api/live/pk/challenges/*`, lifecycle `…/pk/{session,start,end}` |
| DB/RPC | PK session rows; scores from **gift settlement only** |
| Realtime | Bus type `pk`; LiveKit |
| Provider | Room / session containers |
| Cleanup | `endDomainPk` / `endLivePk` / challenge cancel |

---

## Gifts

| Field | Value |
|-------|--------|
| UI entry | Live gift panel / party gift picker / recharge |
| Component | `LiveGiftsPanel.tsx`, `PartyGiftPickerPanel.tsx`, `GiftPlayOverlay.tsx` |
| Handler | `gift.send` → `sendGiftCommand` / `settlePartyGiftSend` |
| Domain | `domain/gifts/giftDomain.ts`, `services/GiftService.ts` |
| SDK | Catalog resolve + SVGA/renderer registries |
| API | `/api/gifts/{catalog,send,history,rankings/:roomId}`; Edge `supabase/functions/gifts` |
| DB/RPC | `settle_gift_send`; `gift_catalog_items`, `gift_transactions`, wallets |
| Realtime | LiveKit data `gift`/`gift_play` + `party_room_sync_events` |
| Provider | Room overlay state (no dedicated GiftProvider) |
| Cleanup | Overlay `onDone`; bus unsubscribe |

---

## Likes

### Live hearts (ephemeral)

| Field | Value |
|-------|--------|
| UI entry | Tap like on live stage / footer |
| Component | `LiveLikeFx.tsx`, `LiveLikeContext.tsx` |
| Handler | `tapLiveLike` → `useLiveRoomBus.emitLike` |
| Domain | Client FX only |
| SDK | — |
| API | None |
| DB/RPC | None |
| Realtime | LiveKit lossy `like` + optional cloud sync |
| Provider | `LiveLikeContext` in Room |
| Cleanup | `dismissLikeBurst`; unmount |

### Social feed likes

| Field | Value |
|-------|--------|
| UI entry | Post/reel like |
| Component | Feed / post cards |
| Handler | `queueCloudEngagement` |
| Domain | `lib/cloudSocial/cloudSocialContent.ts` |
| API / DB | `social_engagement` (+ Firestore mirror) |
| Realtime | postgres_changes on engagement |

---

## Calls (1v1 + group)

| Field | Value |
|-------|--------|
| UI entry | Messages header call buttons |
| Component | `MessagesScreen.tsx`, call overlays / stages under `components/messages/` |
| Handler | `lib/chat/useChatCall.ts`, `chatCallKit.ts` |
| Domain | `lib/unilive-rtc/callDomain.ts` → `createCallOrchestrator` |
| SDK | UniLiveRTC → LiveKit (`liveKitCallRuntime`, `liveKitInstant`) |
| API | `/api/livekit/token`, `/api/livekit/chat/token`; chat invite via cloud chat |
| DB/RPC | Call invites as chat messages |
| Realtime | LiveKit Room/Track; chat invite sync |
| Provider | `ChatCallProviderHost` → `ChatCallProviderImpl` |
| Cleanup | `cleanupRoom` / `endCall`; release camera lease |

**Native CallKit:** scaffolded off (`IncomingCallKitManager.FEATURE_ENABLED = false`); in-app ring only for production QA until flags + certs.

---

## Messages / DM

| Field | Value |
|-------|--------|
| UI entry | Tab `/messages`, `/messages/:chatId` |
| Component | `MessagesScreen.tsx`, thread/compose components |
| Handler | `queueCloudMessageSend`, `ChatService` |
| Domain | `lib/chat/cloudChatSync.ts`, `lib/db/domains/messages.ts` |
| SDK | Supabase (+ Firestore backup); optional `artifacts/chat-ws` |
| API | `/api/chat/{threads,messages,typing}` |
| DB/RPC | `chat_messages` / threads |
| Realtime | postgres_changes / Firestore listeners; typing presence |
| Provider | Messages screen state |
| Cleanup | Unsubscribe realtime on leave thread |

---

## Marketplace / commerce

| Field | Value |
|-------|--------|
| UI entry | Shell `#marketplace-modal`, wallet Shop, live commerce controls |
| Component | `ShopTab.tsx`, `CommerceLiveCheckoutModal.tsx`, `SoloShopLiveControls.tsx` |
| Handler | `lib/commercePayments.ts`, bus `emitCommerce` |
| Domain | Wallet/commerce ledger lanes (≠ gift wallet) |
| SDK | Product catalog client |
| API | Commerce checkout + `POST /api/wallet/commerce-settle` |
| DB/RPC | `settle_commerce_coin_sale` (migration) |
| Realtime | Live bus commerce events |
| Provider | Wallet / room |
| Cleanup | Modal dismiss; settle completion |

**Note:** `lib/unilives-marketplace` is a **template/plugin registry**, not the in-app shop modal.

---

## Karaoke / party rooms / games / wallet / dating / workspace

| Feature | UI path | Key modules |
|---------|---------|-------------|
| Karaoke | `/karaoke` | `components/karaoke/*`, recording studio camera/mic |
| Party rooms | `/party`, `/room*` | `smule-rooms/pages/*` |
| Games | `/games`, `/games/local`, `/games/web`, `/greedy-tap` | game hub + LocalGamePlayer |
| Wallet | `/wallet` | wallet sync / shop |
| Dating | `/dating` | dating tab |
| Workspace | `/workspace` | studio/workspace |
| Reels / Home / Explore | `/reels`, `/home`, `/explore` | social feed cloud paths |
| Notifications | `/notifications` | `notificationsCloud` |
| YouTube | `/youtube` | `pages/YouTube.tsx` |

---

## Camera ownership audit (snippet)

Canonical path (preferred):

1. `lib/camera/cameraAcquire.ts` — `openCameraMediaStream` / `getUserMedia`
2. `lib/camera/appCameraOwner.ts` — serialized lease
3. `lib/camera/useCameraStream.ts` / `useAppCameraPipeline.ts` / `useLiveTrtcPipeline.ts`
4. Publish: `lib/livekit/liveKitVideoPublish.ts` `updateLiveKitLocalVideoTrack` (`LocalVideoTrack`)

| Usage | Path |
|-------|------|
| Canonical GUM | `lib/camera/cameraAcquire.ts` |
| Owner / lease | `lib/camera/appCameraOwner.ts` |
| React stream hook | `lib/camera/useCameraStream.ts` |
| Pipeline facade | `lib/camera/useAppCameraPipeline.ts` |
| Live bind (no 2nd GUM) | `lib/camera/trtcCameraPipeline.ts`, `acquireLiveMedia.ts` |
| Call GUM (parallel) | `lib/chat/useChatCall.ts` |
| Voice changer GUM | `lib/live/voiceChangerPipeline.ts` |
| Mic-only GUM | `lib/useVoice.ts`, `useMicVoiceActivity.ts`, `useSingingSession.ts` |
| DeepAR audio GUM | `lib/deepar/useDeepAR.ts` |
| Karaoke GUM | `components/karaoke/RecordingStudio.tsx` |
| Capacitor Camera plugin | **Not used** (no `@capacitor/camera` dependency) |
| LiveKit camera enable | Via publish helpers / UniLiveRTC `enableCamera` — not raw feature UI `Room.connect` |

See also **NATIVE-MAP.md** for Capacitor WebView permission paths.
