# UniLive Gift Economy Architecture

Production gift system for Android / iOS / Web, layered on the existing UniLive live-room stack (LiveKit bus + Supabase sync + API server).

## Scope honesty

This repo implements **software architecture and Phase 1 economy** with **Supabase + Firebase dual-lane** settle. It does **not** ship 300 commercial SVGA files, licensed music, or original 3D art. Assets are uploaded via Admin Creation Studio into `public/live-gifts/` / CDN slots and referenced by catalog metadata.

## Dual-lane settle order

1. **Supabase API** `POST /api/gifts/send` → `settle_gift_send` RPC (when session is on Supabase)
2. **Firebase Firestore** `wallets` + `gift_transactions` transaction (when Firebase backup / Supabase degraded)
3. **Local** K-Star / `coins_balance` fallback

Successful API settles are best-effort mirrored into Firestore `gift_transactions` for cross-backend history.

## High-level topology

```text
Apps (Android / iOS / Web)
        │
        ▼
API Gateway (/api)
   ├── /wallet          multi-currency balances + history
   ├── /gifts           catalog, send, history, room rankings
   ├── /payments        commerce + coin recharge (Stripe)
   ├── LiveKit / sync   gift_play realtime events
   └── Admin            catalog publish + wallet credit
```

## Currencies (Phase 1)

| Currency | Role |
|----------|------|
| `coins` (`wallets.balance`) | Primary spend for gifts |
| `bonus_coins` | Promo coins spent before paid coins |
| `diamonds` | Creator earnings from received gifts |
| `reward_points` | Loyalty (reserved) |
| `promo_credits` | Campaign credits (reserved) |
| `vip_tokens` | VIP currency (Phase 3) |

## Gift send flow

```text
Tap gift → quantity/combo → POST /api/gifts/send
  → settle_gift_send RPC (idempotent)
  → debit bonus_coins then coins
  → credit receiver diamonds
  → gift_transactions + wallet_transactions + gift_room_stats
  → client emits gift_play on LiveKit / party_room_sync_events
  → GiftPlayOverlay queue (tier priority) + SVGA/video
```

Realtime event shape:

```json
{
  "giftId": "dragon_001",
  "senderId": "user123",
  "receiverId": "host456",
  "roomId": "room789",
  "quantity": 10,
  "combo": 7,
  "timestamp": 1780000000
}
```

## Phase roadmap

### Phase 1 — Core (implemented)

- Multi-currency wallet schema + spend limits
- Gift catalog table + APIs
- Authoritative gift settle + history + room rankings
- Stripe recharge packages → credit coins/bonus
- Client wiring: send gift, recharge UI, queue priority

### Phase 2 — Advanced (scaffolded types)

- Combo thresholds / labels (`giftEconomy.ts`)
- Queue priority Mythic → Normal (`GiftPlayOverlay`)
- Lucky / blind / PK flags on `gift_catalog_items`
- Multi-animation: extend overlay to N simultaneous stages

### Phase 3 — Community

- VIP gates on `vip_only` gifts
- Guild / agency tables + contribution from `gift_transactions`
- Daily / weekly / monthly leaderboards from stats aggregates
- Seasonal windows via `available_from` / `available_until`

### Phase 4 — Intelligence

- Recommendation service reading gift history
- Dynamic pricing metadata on catalog
- Analytics pipelines (async) + creator dashboards
- A/B flags on catalog `metadata`

## Key files

| Area | Path |
|------|------|
| Migration | `artifacts/instacollab/supabase/migrations/20260710120000_gift_economy_phase1.sql` |
| Gift API | `artifacts/api-server/src/routes/gifts.ts` |
| Wallet API | `artifacts/api-server/src/routes/wallet.ts` |
| Recharge | `artifacts/api-server/src/routes/payments.ts` |
| Client settle | `artifacts/instacollab/src/lib/partyGiftPayments.ts` |
| Types | `artifacts/instacollab/src/lib/live/giftEconomy.ts` |
| Overlay | `artifacts/instacollab/src/smule-rooms/components/GiftPlayOverlay.tsx` |
| SVGA player | `artifacts/instacollab/src/smule-rooms/components/GiftSvgaPlayer.tsx` |

## Deployment notes

1. Apply Supabase migration `20260710120000_gift_economy_phase1.sql`.
2. Deploy API server with `STRIPE_SECRET_KEY` for live recharge.
3. Publish gifts via Admin Creation Studio (jsonb catalog) and/or `PUT /api/gifts/catalog/:id`.
4. Host SVGA/video on CDN; set `effect_svga_url` / `effect_video_url` on catalog rows.

## Scalability

- Horizontal API instances behind the gateway
- Gift play fan-out via existing LiveKit data channel + durable Supabase sync
- Catalog + packages cached at edge / CDN
- Analytics and notifications processed asynchronously
- Idempotent `client_request_id` / recharge order keys prevent double spend
