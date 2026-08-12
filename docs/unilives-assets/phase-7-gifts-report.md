# UniLive’s Phase 7 — Gifts visual assets report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

Visual gift presentation only. No price, wallet, transaction, ranking, schema, LiveKit, or deploy changes.

---

## Existing gift flow summary

1. Catalog: `giftEffectCatalogBase` + `giftStudioCatalog` → `PARTY_GIFT_CATALOG` / admin merge (`getMergedPartyGiftCatalog` / `getMergedGiftEffectCatalog`).
2. Picker: `LiveGiftsPanel` (tabs, quantity, combo, send) → `onSendGift` parent handler.
3. Payments / wallet: `partyGiftPayments`, `GiftService`, Firebase/Supabase gift wallet paths — **untouched**.
4. Room events: `roomGifts.ts` payloads with business `giftId`, names, icons, stars.
5. Playback: `GiftPlayOverlay` queue → `resolvePlayTier` / `resolveGiftEffect` → SVGA (`GiftSvgaPlayer`) / WebM / fly-in.
6. Legacy media: four SVGAs under `/live-gifts/`.
7. Registry: `gifts.manifest.json` + seed mappings (now Phase 7 wired-with-fallback).

## Gift logic boundaries (must stay outside visual components)

Catalog loading, price lookup, wallet balance validation/deduction, transaction creation, send payload, recipient/sender/room identity, quantity, combo, ranking, analytics, rate limits, moderation, server auth, history/replay, websocket/LiveKit publish, DB writes, error normalization, retries.

Visual layer receives: gift data, resolved visual source, UI state, callbacks via props.

---

## 1. Gift-system audit table

| businessGiftId | name | price | currency | businessTier | thumbnail | animation | canonicalAssetId | status | safe visual |
|---|---|---:|---|---|---|---|---|---|---|
| `lucky_clover` | Lucky Clover | 1 | stars | normal | emoji `🍀` | — | `gift.normal.lucky-clover` | wired-with-fallback | yes |
| `rose` | Rose | 5 | stars | normal | emoji `🌹` | — | `gift.normal.rose` | wired-with-fallback | yes |
| `balloon` | Balloon | 8 | stars | normal | emoji `🎈` | — | `gift.normal.balloon` | wired-with-fallback | yes |
| `heart` | Heart | 10 | stars | normal | emoji `💖` | — | `gift.normal.heart` | wired-with-fallback | yes |
| `coffee` | Coffee | 10 | stars | normal | emoji `☕` | — | `gift.normal.coffee` | wired-with-fallback | yes |
| `chocolate` | Chocolate | 15 | stars | normal | emoji `🍫` | — | `gift.normal.chocolate` | wired-with-fallback | yes |
| `cake` | Cake | 20 | stars | normal | emoji `🎂` | — | `gift.normal.cake` | wired-with-fallback | yes |
| `mic` | Mic | 25 | stars | normal | emoji `🎤` | /live-gifts/mic.svga | `gift.normal.mic` | wired-with-fallback | yes |
| `teddy_bear` | Teddy Bear | 25 | stars | normal | emoji `🧸` | — | `gift.normal.teddy-bear` | wired-with-fallback | yes |
| `kiss` | Kiss | 30 | stars | normal | emoji `💋` | — | `gift.normal.kiss` | wired-with-fallback | yes |
| `pumpkin_lantern` | Pumpkin Lantern | 45 | stars | normal | emoji `🎃` | — | `gift.seasonal.pumpkin-lantern` | wired-with-fallback | yes |
| `star` | Star | 50 | stars | normal | emoji `⭐` | /live-gifts/star.svga | `gift.normal.star` | wired-with-fallback | yes |
| `flower_bouquet` | Flower Bouquet | 50 | stars | normal | emoji `🌸` | — | `gift.normal.flower-bouquet` | wired-with-fallback | yes |
| `red_packet` | Red Packet | 66 | stars | normal | emoji `🧧` | — | `gift.seasonal.red-packet` | wired-with-fallback | yes |
| `xmas_tree` | Xmas Tree | 88 | stars | normal | emoji `🎄` | — | `gift.seasonal.xmas-tree` | wired-with-fallback | yes |
| `crown` | Crown | 100 | stars | premium | emoji `👑` | /live-gifts/crown.svga | `gift.premium.crown` | wired-with-fallback | yes |
| `royal_crown` | Royal Crown | 120 | stars | premium | emoji `👑` | /live-gifts/crown.svga | `gift.premium.royal-crown` | wired-with-fallback | yes |
| `champagne` | Champagne | 150 | stars | premium | emoji `🍾` | — | `gift.premium.champagne` | wired-with-fallback | yes |
| `rocket` | Rocket | 250 | stars | premium | emoji `🚀` | /live-gifts/rocket.svga | `gift.premium.rocket` | wired-with-fallback | yes |
| `diamond_ring` | Diamond Ring | 250 | stars | premium | emoji `💍` | — | `gift.premium.diamond-ring` | wired-with-fallback | yes |
| `santa_sleigh` | Santa Sleigh | 288 | stars | premium | emoji `🎅` | — | `gift.seasonal.santa-sleigh` | wired-with-fallback | yes |
| `crystal_diamond` | Crystal Diamond | 300 | stars | premium | emoji `💎` | /live-gifts/crown.svga | `gift.premium.crystal-diamond` | wired-with-fallback | yes |
| `treasure_chest` | Treasure Chest | 450 | stars | premium | emoji `🎁` | — | `gift.premium.treasure-chest` | wired-with-fallback | yes |
| `diamond` | Diamond | 500 | stars | premium | emoji `💎` | /live-gifts/crown.svga | `gift.premium.diamond` | wired-with-fallback | yes |
| `super_car` | Super Car | 500 | stars | premium | emoji `🚗` | — | `gift.premium.super-car` | wired-with-fallback | yes |
| `vip_crown` | VIP Crown | 500 | stars | premium | emoji `👑✨` | /live-gifts/crown.svga | `gift.vip-exclusive.vip-crown` | wired-with-fallback | yes |
| `cupids_arrow` | True Love | 520 | stars | premium | emoji `💏` | — | `gift.seasonal.cupids-arrow` | wired-with-fallback | yes |
| `luxury_bag` | Luxury Bag | 600 | stars | premium | emoji `👜` | — | `gift.premium.luxury-bag` | wired-with-fallback | yes |
| `lion_dance` | Lion Dance | 666 | stars | premium | emoji `🏮🦁` | — | `gift.seasonal.lion-dance` | wired-with-fallback | yes |
| `luxury_watch` | Luxury Watch | 750 | stars | premium | emoji `⌚` | — | `gift.premium.luxury-watch` | wired-with-fallback | yes |
| `yacht` | Yacht | 850 | stars | premium | emoji `🛥` | — | `gift.premium.yacht` | wired-with-fallback | yes |
| `dracula_castle` | Dracula Castle | 888 | stars | premium | emoji `🧛🏰` | — | `gift.seasonal.dracula-castle` | wired-with-fallback | yes |
| `castle` | Castle | 999 | stars | premium | emoji `🏰` | /live-gifts/rocket.svga | `gift.premium.castle` | wired-with-fallback | yes |
| `private_jet` | Private Jet | 999 | stars | premium | emoji `✈` | — | `gift.premium.private-jet` | wired-with-fallback | yes |
| `phoenix` | Phoenix | 1000 | stars | epic | emoji `🔥` | /live-gifts/rocket.svga | `gift.legendary.phoenix` | wired-with-fallback | yes |
| `golden_dragon` | Golden Dragon | 1200 | stars | epic | emoji `🐉` | /live-gifts/rocket.svga | `gift.epic.golden-dragon` | wired-with-fallback | yes |
| `vip_lambo` | VIP Lambo | 1500 | stars | epic | emoji `🏎️💨` | /live-gifts/rocket.svga | `gift.vip-exclusive.vip-lambo` | wired-with-fallback | yes |
| `studio_phoenix` | Phoenix | 1800 | stars | epic | emoji `🦅` | /live-gifts/rocket.svga | `gift.epic.studio-phoenix` | wired-with-fallback | yes |
| `unicorn` | Unicorn | 2500 | stars | epic | emoji `🦄` | /live-gifts/crown.svga | `gift.epic.unicorn` | wired-with-fallback | yes |
| `crystal_castle` | Crystal Castle | 2500 | stars | epic | emoji `🏰` | /live-gifts/rocket.svga | `gift.epic.crystal-castle` | wired-with-fallback | yes |
| `galaxy_portal` | Galaxy Portal | 3000 | stars | epic | emoji `🌀` | /live-gifts/star.svga | `gift.epic.galaxy-portal` | wired-with-fallback | yes |
| `flying_unicorn` | Flying Unicorn | 3500 | stars | epic | emoji `🦄` | /live-gifts/crown.svga | `gift.epic.flying-unicorn` | wired-with-fallback | yes |
| `star_whale` | Star Whale | 4500 | stars | epic | emoji `🐳` | — | `gift.epic.star-whale` | wired-with-fallback | yes |
| `galaxy` | Galaxy | 5000 | stars | epic | emoji `🌌` | /live-gifts/star.svga | `gift.epic.galaxy` | wired-with-fallback | yes |
| `ice_queen` | Ice Queen | 5500 | stars | epic | emoji `❄️` | — | `gift.epic.ice-queen` | wired-with-fallback | yes |
| `magic_tree` | Magic Tree | 6000 | stars | epic | emoji `🌳` | — | `gift.epic.magic-tree` | wired-with-fallback | yes |
| `rainbow_pegasus` | Rainbow Pegasus | 7000 | stars | epic | emoji `🎠` | — | `gift.epic.rainbow-pegasus` | wired-with-fallback | yes |
| `space_rocket` | Space Rocket | 9999 | stars | epic | emoji `🚀` | /live-gifts/rocket.svga | `gift.epic.space-rocket` | wired-with-fallback | yes |
| `dragon` | Dragon | 10000 | stars | legendary | emoji `🐉` | /live-gifts/rocket.svga | `gift.legendary.dragon` | wired-with-fallback | yes |
| `golden_palace` | Golden Palace | 12000 | stars | legendary | emoji `🏛` | — | `gift.legendary.golden-palace` | wired-with-fallback | yes |
| `lion_king` | Lion King | 15000 | stars | legendary | emoji `🦁` | — | `gift.legendary.lion-king` | wired-with-fallback | yes |
| `titan_robot` | Titan Robot | 20000 | stars | legendary | emoji `🤖` | — | `gift.legendary.titan-robot` | wired-with-fallback | yes |
| `emperor_throne` | Emperor Throne | 28000 | stars | legendary | emoji `🪑` | — | `gift.legendary.emperor-throne` | wired-with-fallback | yes |
| `celestial_angel` | Celestial Angel | 35000 | stars | legendary | emoji `👼` | — | `gift.legendary.celestial-angel` | wired-with-fallback | yes |
| `universe` | Universe | 50000 | stars | legendary | emoji `🪐` | /live-gifts/crown.svga | `gift.legendary.universe` | wired-with-fallback | yes |
| `universe_creation` | Universe Creation | 50000 | stars | legendary | emoji `🌌` | /live-gifts/crown.svga | `gift.legendary.universe-creation` | wired-with-fallback | yes |
| `time_portal` | Time Portal | 65000 | stars | legendary | emoji `⏳` | — | `gift.legendary.time-portal` | wired-with-fallback | yes |
| `king_of_dragons` | King of Dragons | 80000 | stars | legendary | emoji `🐲` | /live-gifts/rocket.svga | `gift.legendary.king-of-dragons` | wired-with-fallback | yes |
| `space_battleship` | Space Battleship | 90000 | stars | legendary | emoji `🛸` | — | `gift.legendary.space-battleship` | wired-with-fallback | yes |
| `cosmic_explosion` | Cosmic Explosion | 99999 | stars | legendary | emoji `💥` | — | `gift.legendary.cosmic-explosion` | wired-with-fallback | yes |
| `eternity` | Eternity | 100000 | stars | mythic | emoji `✨` | /live-gifts/star.svga | `gift.mythic.eternity` | wired-with-fallback | yes |
| `galaxy_emperor` | Galaxy Emperor | 120000 | stars | mythic | emoji `👑🌌` | /live-gifts/star.svga | `gift.mythic.galaxy-emperor` | wired-with-fallback | yes |
| `cosmic_phoenix` | Cosmic Phoenix | 150000 | stars | mythic | emoji `🔥🦅` | /live-gifts/rocket.svga | `gift.mythic.cosmic-phoenix` | wired-with-fallback | yes |
| `mythic_citadel` | Mythic Citadel | 200000 | stars | mythic | emoji `🏰✨` | — | `gift.mythic.mythic-citadel` | wired-with-fallback | yes |
| `divine` | Divine | 250000 | stars | mythic | emoji `🕊️` | /live-gifts/crown.svga | `gift.mythic.divine` | wired-with-fallback | yes |
| `eternal_ocean` | Eternal Ocean | 250000 | stars | mythic | emoji `🌊🐋` | /live-gifts/crown.svga | `gift.mythic.eternal-ocean` | wired-with-fallback | yes |
| `solar_dragon` | Solar Dragon | 350000 | stars | mythic | emoji `🐉☀️` | /live-gifts/rocket.svga | `gift.mythic.solar-dragon` | wired-with-fallback | yes |
| `supernova_prime` | Supernova Prime | 500000 | stars | mythic | emoji `💥🌟` | /live-gifts/star.svga | `gift.mythic.supernova-prime` | wired-with-fallback | yes |


Additional reserved visual (no business mapping): `gift.mythic.universe` (tags: visual-only-reserved, unassigned).

Studio/seasonal/VIP catalog entries share the same wiring pattern via replacement-map (`wired-with-fallback`).

---

## Business-tier vs visual-tier differences

| Business ID | Business tier (stars) | Visual ID | Visual tier folder | Action |
|-------------|----------------------|-----------|--------------------|--------|
| `phoenix` | **epic** (1000) | `gift.legendary.phoenix` | legendary | **Documented mismatch — do not change catalog** |
| `universe` | legendary (50000) | `gift.legendary.universe` | legendary | Aligned; mythic reserved unused |
| Others | from `giftTierFromStars` | `gift.<tier>.<slug>` | matches map | Visual-only |

---

## Files created

- `src/lib/unilives-assets/giftResolve.ts`
- `src/components/gifts/brand/*` (thumbnail, preview, animation, fallback, media host, category chip, loading, error, price, index)
- `docs/unilives-assets/phase-7-gifts-report.md`
- `docs/unilives-assets/gift-business-to-visual-map.md`
- `docs/unilives-assets/gift-media-inventory.md`
- `docs/unilives-assets/gift-performance-audit.md`
- `docs/unilives-assets/phase-7-screenshots/*`
- `docs/unilives-assets/phase-7-media-tests/*`

## Files modified

- `src/lib/unilives-assets/types.ts` (mapping metadata + statuses)
- `src/lib/unilives-assets/index.ts` (exports)
- `src/lib/unilives-assets/seed.json` (v7; gift fallbacks; mapping status)
- `public/unilives-assets/manifests/gifts.manifest.json`
- `public/unilives-assets/manifests/index.manifest.json`
- `public/unilives-assets/manifests/replacement-map.json`
- `src/smule-rooms/components/LiveGiftsPanel.tsx` (thumbnails/price chrome/preload)
- `src/smule-rooms/components/GiftPlayOverlay.tsx` (resolve play media + thumbnails)

**Not modified:** gift prices, business IDs, wallet, transactions, Supabase functions, schemas, APIs, LiveKit, combo math, ranking.

---

## Canonical gift asset IDs

70 gift registry entries (including reserved `gift.mythic.universe`).  
69 business→visual mappings activated as `wired-with-fallback`.

## Production assets used

**0** new production gift binaries.

## Legacy assets still active

`/live-gifts/mic.svga`, `star.svga`, `crown.svga`, `rocket.svga` (+ manifest). Catalog emoji as temporary thumbnails. Admin media URLs when present.

## Missing production assets

All `gift.*` unilives-assets format paths remain missing (thumbnails, SVGA, WebM, reduced-motion PNGs under `/unilives-assets/gifts/`).

## Default emoji gift audit

| Classification | Handling |
|----------------|----------|
| Catalog `icon` emoji used as tray art | Temporary display via `UniLivesGiftThumbnail` until production media |
| Chat / reaction emoji | Untouched |
| User-generated emoji | Untouched |
| Functional non-gift emoji (nav) | Untouched (out of phase) |

Emoji code retained in catalog; not deleted.

## Picker wiring

`LiveGiftsPanel` → `UniLivesGiftThumbnail` + `UniLivesGiftPrice` (amount from `gift.stars`). Order, tabs, send, combo, VIP lock unchanged.

## Animation wiring

`GiftPlayOverlay` → `resolveGiftPlayMedia(businessGiftId, legacy URLs)` → SVGA/WebM/static. Lookup key = business gift ID. Queue/timing/tiers preserved. Reduced motion → static + attribution.

## Audio audit

No gift audio invented. Mute/sound flags respected. Missing audio does not block visuals. Overlay unmount cleans players.

## Media lifecycle audit

Existing `GiftSvgaPlayer` destroy-on-unmount retained. Static timers cleared. No event drop/reorder. Concurrent queue behavior unchanged.

## Preload strategy

Visible tray ≤24 canonical IDs; no mass SVGA preload. See `gift-performance-audit.md`.

## Preservation proof

| Item | Result |
|------|--------|
| Gift prices changed | **none** |
| Business gift IDs changed | **none** |
| Wallet behavior | **none** |
| Transaction payloads | **none** |
| Ranking / analytics | **none** |
| Layout structure | **none** |
| Functional send logic | **none** |

## Registry validation

- Seed version **7**
- Gift maps: **69** `wired-with-fallback`
- `universe` → only `gift.legendary.universe`
- `gift.mythic.universe` mappings: **0**
- Duplicate business IDs in gift maps: **0**
- Brand spelling: UniLive’s
- Typecheck: **28 = baseline**
- Build: **PASS**

## Test results

| Script | Result |
|--------|--------|
| typecheck | 28 (0 new) |
| build | PASS |
| smoke:manage-tab | PASS |
| auth:check | PASS |

## Manual validation (code-path)

Picker location/order/categories/names/prices/currency/balance/insufficient/recipient/quantity/combo/send handlers preserved. Business IDs in payloads unchanged. Phoenix price/tier unchanged; legendary visual ID visual-only. Universe single mapping. Legacy SVGAs remain. Missing media → emoji/legacy/brand. Reduced-motion/low-perf static path. Mute: no invented audio. Unmount cleanup retained. No fake gifts/transactions. No deploy/upload.

## Screenshots / media tests

- `docs/unilives-assets/phase-7-screenshots/`
- `docs/unilives-assets/phase-7-media-tests/`

## Rollback

1. Revert `LiveGiftsPanel.tsx`, `GiftPlayOverlay.tsx` to pre-Phase-7.
2. Remove `src/components/gifts/brand/` and `giftResolve.ts`.
3. Restore `seed.json` / manifests / `replacement-map.json` gift statuses to prior (`not-in-phase`) and fallbacks.
4. Revert `types.ts` / `index.ts` gift exports if needed.
5. Remove Phase 7 docs/screenshots.
6. Re-run typecheck (expect 28) + build.

## Risks / blockers

- All production gift artwork still missing — runtime uses legacy SVGA + temporary emoji.
- Phoenix business/visual tier mismatch must stay documented until product explicitly changes catalog (out of scope).
- Admin `PartyGiftPickerPanel` still uses `GiftIcon` for editing (intentional).
- Mass seasonal gift IDs in registry without unique legacy SVGAs share the four legacy files.

---

**STOP.** Do not begin stickers, badges, VIP, rings, frames, legal, QR/share, chat, presence, live registration, PK, realtime, deploy, or push.
