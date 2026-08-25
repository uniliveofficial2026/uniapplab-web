# UniLive Dataflow Map

**Base SHA:** `9e8c44a` · **Prod:** https://app.uniapplab.com  
**Authority overview:** `artifacts/instacollab/src/lib/liveDataFlowMap.ts`  
**Chain:** SOURCE → TRANSFORM → AUTHORITY → TRANSPORT → STORAGE → EVENT → CONSUMER → UI

---

## Gifts

| Stage | Detail |
|-------|--------|
| SOURCE | Tap gift in `LiveGiftsPanel` / `PartyGiftPickerPanel` |
| TRANSFORM | `settlePartyGiftSend` / `sendGiftCommand` (`giftDomain`, `partyGiftPayments`) |
| AUTHORITY | `POST /api/gifts/send` → RPC `settle_gift_send` (catalog price + wallet debit) |
| TRANSPORT | LiveKit `publishData` (`gift` / `gift_play`) + `party_room_sync_events` |
| STORAGE | `gift_transactions`, wallets; catalog `gift_catalog_items` |
| EVENT | `gift_play` envelope / bus |
| CONSUMER | `useLiveRoomBus` / Room; UniLiveRTC `publishAuthoritativeGift` |
| UI | `GiftPlayOverlay` / `GiftSvgaPlayer` / senders overlay |

---

## Likes

### Live hearts

| Stage | Detail |
|-------|--------|
| SOURCE | Stage/footer tap |
| TRANSFORM | Local burst + batch (`emitLike`) |
| AUTHORITY | **None** (FX-only; not wallet) |
| TRANSPORT | LiveKit unreliable `like` (+ optional cloud sync) |
| STORAGE | None |
| EVENT | `like` |
| CONSUMER | Peer Room + `LiveLikeContext` |
| UI | `LiveLikeFx` |

### Feed engagement

| Stage | Detail |
|-------|--------|
| SOURCE | Post/reel like control |
| TRANSFORM | `queueCloudEngagement` |
| AUTHORITY | Auth + cloud social write |
| TRANSPORT | Supabase / Firestore |
| STORAGE | `social_engagement` |
| EVENT | postgres_changes / listeners |
| CONSUMER | Feed surfaces |
| UI | Like state on post cards |

---

## Calls

| Stage | Detail |
|-------|--------|
| SOURCE | Messages audio/video call button |
| TRANSFORM | `useChatCall` + `chatCallKit` peer resolution; UniLiveRTC `createCallOrchestrator` |
| AUTHORITY | Auth + LiveKit token grant (`/api/livekit/chat/token` or `/token`) |
| TRANSPORT | LiveKit media; invite via `cloudChatSync` (`ic-chat-call-*` rooms) |
| STORAGE | Invite/thread as chat messages |
| EVENT | Room connected / Track published / call phase |
| CONSUMER | `ChatCallProviderImpl` |
| UI | Overlays, PiP, stages (`MessagesActiveCallOverlay`, etc.) |

---

## Live

| Stage | Detail |
|-------|--------|
| SOURCE | CreateRoom go-live / Live discovery join |
| TRANSFORM | Host media session + camera lease + publish profile |
| AUTHORITY | `/api/livekit/*`, `/api/live/rooms/*`, `/api/stream/*`, `LiveLifecycleService` |
| TRANSPORT | LiveKit A/V + data; party sync events |
| STORAGE | `party_rooms`, `profiles.live_*` |
| EVENT | Lifecycle / seats / discovery |
| CONSUMER | Host + viewers via Room hooks |
| UI | `SoloLiveView`, multi-guest, discovery preview |

---

## PK

| Stage | Detail |
|-------|--------|
| SOURCE | Invite / accept / discovery open 1v1 PK |
| TRANSFORM | Challenge API + PK start; `createPkOrchestrator` |
| AUTHORITY | `LiveLifecycleService` + **gift settle** for scores (never React gift++ alone) |
| TRANSPORT | LiveKit + `/api/live/pk/challenges/*` + bus `pk` |
| STORAGE | PK session / sync events |
| EVENT | Score / end / layout |
| CONSUMER | `PKBattleStage`, 1v1/team containers |
| UI | Battle stage, overlays, sticker sheet |

---

## Messages

| Stage | Detail |
|-------|--------|
| SOURCE | Compose bar send |
| TRANSFORM | `queueCloudMessageSend` |
| AUTHORITY | Auth (+ `/api/chat/*` when used) |
| TRANSPORT | Supabase realtime / Firestore; optional `artifacts/chat-ws` fanout |
| STORAGE | `chat_messages` / threads; media URLs on R2 |
| EVENT | postgres_changes / listeners / typing |
| CONSUMER | `MessagesScreen` / thread |
| UI | Bubble list + compose |

---

## Marketplace / commerce

| Stage | Detail |
|-------|--------|
| SOURCE | Shop modal / live product checkout |
| TRANSFORM | `commercePayments` + checkout payload |
| AUTHORITY | `POST /api/wallet/commerce-settle` (+ coin sale RPC) |
| TRANSPORT | HTTP + live bus `commerce` |
| STORAGE | Commerce ledger (lane ≠ gifts); order rows as applicable |
| EVENT | Settle result / bus commerce |
| CONSUMER | Wallet + live commerce panels |
| UI | `CommerceLiveCheckoutModal`, `ShopTab` |

---

## Cross-cutting media

| Stage | Detail |
|-------|--------|
| SOURCE | Capture / picker / gift asset upload |
| TRANSFORM | `uploadBlobToR2` |
| AUTHORITY | Media API / worker auth |
| TRANSPORT | Cloudflare Worker → R2 |
| STORAGE | R2 folders (avatars/posts/chat/gifts/karaoke/…) |
| EVENT | URL written to Supabase metadata |
| CONSUMER | Feed / chat / gifts |
| UI | Image/video elements |
