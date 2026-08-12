# UniLive’s Phase 8 — Stickers & seat-interaction visuals report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

Visual media only. No chat, presence, gift, wallet, seat-targeting, or event-protocol changes. No fake sticker/interaction events.

---

## Existing sticker flow summary

1. **Editor / story overlays:** `EditorToolPanels` + `StoryCreatorEdit` / `ShellCreateModal` — emoji tray; draft stores emoji in `sticker` (+ `stickerPos`).
2. **Beauty AR stickers:** `LiveBeautySheet` EffectGrid → Tencent `catalogs.stickers` (`id`, `cover`, effect URL). Selection writes `beautyEffects.stickerId` only.
3. **Chat reactions:** `MessagesScreen` / `db.toggleMessageReaction` — **out of scope** (unchanged).
4. **No room “sticker message tray”** product surface with separate business catalog beyond the above.

## Existing seat-interaction flow summary

1. **Registry:** 10 reserved `interaction.*` assets (kiss, hug, …) — previously unmapped.
2. **Room seat sheet:** mute / follow / profile / mention / leave-remove / ban — **no** kiss/hug interaction send UI.
3. **No** LiveKit/websocket seat-interaction event publisher found for these IDs.
4. Phase 8 adds visual resolve + brand components only; does **not** invent a send pipeline.

## Logic boundaries

**Outside visuals:** catalog entitlements/prices (n/a), send handlers, chat construction, seat/source/target resolution, permissions, cooldowns, rate limits, payloads, queueing, LiveKit/websocket, analytics, persistence.

**Visual layer:** data + resolved media + callbacks via props.

---

## 1. Sticker-system audit table

| business sticker ID | display name | category | current thumbnail | playback | fallback | canonical asset ID | payload field | entitlement/price | safe visual? | risks |
|---------------------|--------------|----------|-------------------|----------|----------|--------------------|---------------|-------------------|--------------|-------|
| `fire` … `rocket` (12) | Fire…Rocket | reaction/static | emoji | none | emoji | `sticker.reaction.*` / `sticker.static.*` | draft `sticker` = emoji | none | **yes** | keep emoji in draft |
| Tencent effect `id` | remote name | beauty-AR | `cover` URL | Tencent SDK | cover | (no static map) | `stickerId` | SDK | **yes** (thumb only) | do not invent registry rows |
| chat reaction emoji | — | chat | emoji | — | — | — | message reaction | — | **no** | out of scope |

## 2. Seat-interaction audit table

| business ID | name | category | source/target | permissions | cooldown | thumbnail | playback | canonical ID | payload | safe visual? | risks |
|-------------|------|----------|---------------|-------------|----------|-----------|----------|--------------|---------|--------------|-------|
| `kiss` | Kiss | social | user-to-user (planned) | unset | unset | 💋 | missing | `interaction.kiss` | none in product | **yes** (registry/components) | no UI to wire |
| `hug` | Hug | social | user-to-user | unset | unset | 🤗 | missing | `interaction.hug` | none | **yes** | same |
| `high_five` | High five | social | user-to-user | unset | unset | 🙌 | missing | `interaction.high-five` | none | **yes** | same |
| `pillow_fight` | Pillow fight | social | user-to-user | unset | unset | 🛏️ | missing | `interaction.pillow-fight` | none | **yes** | same |
| `love_you` | Love you | social | user-to-user | unset | unset | 😍 | missing | `interaction.love-you` | none | **yes** | same |
| `cheer` | Cheer | social | user-to-user | unset | unset | 📣 | missing | `interaction.cheer` | none | **yes** | same |
| `crown` | Crown | effect | user-to-user | host/mod unset | unset | 👑 | missing | `interaction.crown` | none | **yes** | same |
| `freeze` | Freeze | effect | user-to-user | host/mod unset | unset | ❄️ | missing | `interaction.freeze` | none | **yes** | same |
| `fire` | Fire | effect | user-to-user | any-seated unset | unset | 🔥 | missing | `interaction.fire` | none | **yes** | same |
| `confetti` | Confetti | effect | room-or-target | any-seated unset | unset | 🎊 | missing | `interaction.confetti` | none | **yes** | same |

---

## Files created

- `src/lib/unilives-assets/stickerResolve.ts`
- `src/lib/unilives-assets/seatInteractionResolve.ts`
- `src/components/stickers/brand/*`
- `src/components/seat-interactions/brand/*`
- Phase 8 docs + screenshots + media-tests

## Files modified

- `types.ts`, `index.ts`, `seed.json` (v8), `stickers.manifest.json`, `interactions.manifest.json`, `index.manifest.json`, `replacement-map.json`
- `EditorToolPanels.tsx` (sticker tray visuals)
- `LiveBeautySheet.tsx` (beauty sticker thumbs via remote override)
- Asset inventory docs

## Canonical IDs

- **12** sticker assets added (`sticker.reaction.*` / `sticker.static.*`)
- **10** interaction assets normalized (existing `interaction.*` IDs retained)
- **22** replacement mappings `wired-with-fallback`

## Production / legacy / missing

| | |
|--|--|
| Production binaries used | **0** |
| Legacy active | Editor emoji; Tencent covers; brand mark |
| Missing | All sticker + interaction unilives-assets media |

## Emoji audit

| Class | Action |
|-------|--------|
| Editor sticker emoji | Temporary production visual → wired-with-fallback |
| Seat-interaction emoji | Temporary catalog icons only |
| Chat / UGC / gift emoji | Untouched |
| Beauty covers | Remote media (not emoji) |

## Wiring results

| Surface | Result |
|---------|--------|
| Sticker picker (editor) | `UniLivesStickerThumbnail`; order/selection/draft emoji unchanged |
| Sticker playback | Resolver ready; no separate room sticker message host |
| Beauty sticker tray | Remote cover through brand thumb; `stickerId` unchanged |
| Seat-interaction picker | **Deferred** — no product UI (would invent feature) |
| Seat-interaction playback | Components + resolver ready; no event host wired |

## Permission / seat-targeting

Unchanged. Seat sheet behavior unchanged. Catalog metadata documents planned scopes only (`client-catalog-unset`).

## Audio / lifecycle / preload

No audio invented. Timer cleanup in animation hosts. No mass SVGA preload. See `phase-8-performance-audit.md`.

## Preservation proof

| Item | Result |
|------|--------|
| Sticker business IDs (draft emoji values) | unchanged |
| Interaction business IDs | none renamed; mappings additive |
| Event payloads | none (no new events) |
| Seat targeting | none |
| Permissions / cooldowns / rate limits | none |
| Chat / realtime / gifts / wallet | none |
| Layout | none |
| Functional send logic | none |

## Registry validation

- Seed version **8**, assets **223**
- Sticker maps **12**, interaction maps **10**
- Duplicate business IDs in these maps: **0**
- Typecheck **28 = baseline**
- Build: see completion response

## Rollback

1. Revert `EditorToolPanels.tsx`, `LiveBeautySheet.tsx`.
2. Remove `stickers/brand`, `seat-interactions/brand`, `stickerResolve.ts`, `seatInteractionResolve.ts`.
3. Restore seed/manifests/replacement-map to pre-Phase-8 (remove sticker assets/maps; restore interaction fallbacks).
4. Remove Phase 8 docs/screenshots.
5. Re-run typecheck/build.

## Risks / blockers

- No room seat-interaction product UI — wiring picker would invent features (correctly deferred).
- All production sticker/interaction media missing.
- Beauty AR stickers remain remote-first (cannot register every Tencent ID locally).

---

**STOP.** Do not begin badges, VIP, rings, frames, legal, QR/share, chat, presence, live registration, PK, realtime, deploy, or push.
