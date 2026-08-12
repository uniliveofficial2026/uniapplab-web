# UniLive’s Phase 5 — Discovery UI report

Generated: 2026-07-23T08:20:00.000Z  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

## Existing discovery flow summary

1. Launch: profile_setup → **trending** (`launch/TrendingScreen`) → `markTrendingSeen` → main
2. Main explore/search: App tab `search` → `/explore` → `SearchScreen` (tabs: top/accounts/youtube/audio/tags/places)
3. Live discovery: `LiveScreen` + `useCloudLiveDiscovery` + filters + `openLiveUserRoom`
4. Party lobby: `smule-rooms/pages/Party.tsx` via `RoomsHost` + `useCloudPartyRooms`
5. Legacy: `auth/TrendingScreen` (Firebase path) — demo categories/topics pre-exist

## 1. Discovery audit table

| File | Symbol | Route/section | Responsibility | Data source | Visuals | Canonical IDs | Untouched logic | Safe P5? |
|------|--------|---------------|----------------|-------------|---------|---------------|-----------------|----------|
| `launch/TrendingScreen.tsx` | `TrendingScreen` | launch `trending` | Creators + posts | `db.users`/`db.posts` sort | shell/cards | `discovery.trending.*` | sort, follow, markTrendingSeen | **yes** |
| `search/SearchScreen.tsx` | `SearchScreen` | `/explore` | Search + explore grid | `useDiscoverableUserSearch`, posts, YouTube | search/tabs | search/explore | query, tabs, follow, YouTube | **yes** |
| `live/LiveScreen.tsx` | `LiveScreen` | Live tab | Live room grid | `useCloudLiveDiscovery`, local live users | empty/cards | live.* | filters, openLiveUserRoom | **yes** |
| `live/LiveDiscoveryCardChrome.tsx` | chrome | card overlay | LIVE/privacy/viewers | props | tokens + PK pill | live.live-indicator | counts, privacy | **yes** |
| `live/LiveFiltersPanel.tsx` | filters | live filters | type/country/follow/search | props | (unchanged structure) | category.* | filter state | **no** (logic); light tokens optional skipped to avoid risk |
| `smule-rooms/pages/Party.tsx` | `Party` | rooms lobby | Karaoke rooms + concerts | `useCloudPartyRooms` | tokens | party.* | navigate/Link, room IDs | **yes** (visual) |
| `auth/TrendingScreen.tsx` | legacy | Firebase trending | Demo trending UI | local db + hardcoded topics | tokens | trending | follow/demo | **yes** (light) |
| `useCloudLiveDiscovery` / party hooks | hooks | — | Queries | Supabase/API | — | — | **all** | **no** |
| Team-PK separate card type | — | — | **no LiveKind** | — | — | `party.team-pk-indicator` | — | **not-in-phase** |
| Games category chip UI | — | — | no dedicated chip row | — | — | `category.games` | — | **not-in-phase** |

## Discovery logic boundaries

Outside brand components: query hooks, Supabase/live discovery, pagination, ranking/sort, follow/unfollow, search endpoints, room-entry (`openLiveUserRoom`), LiveKit preview attach, realtime, analytics, moderation/blocked filtering, presence.

## Data sources

- Trending users/posts: in-memory `db` sorts (followers / likes)
- Search accounts: `useDiscoverableUserSearch`
- Explore posts: `db.posts` + `isPostActive` / `resolveProfileGridPost`
- Live: local `status==='live'` + `useCloudLiveDiscovery` streams
- Party: `useCloudPartyRooms`
- Room type / PK: authoritative `liveKind` / `resolveLiveRoomType` / `LIVE_KIND_LABELS` — never title inference

## Files created / modified

**Created:** `src/components/discovery/brand/*`, `discovery.manifest.json`, `phase-5-discovery-ui-report.md`, `phase-5-screenshots/*`

**Modified:** `launch/TrendingScreen.tsx`, `SearchScreen.tsx`, `LiveScreen.tsx`, `LiveDiscoveryCardChrome.tsx`, `Party.tsx`, `auth/TrendingScreen.tsx` (brand spelling + bg token), `index.css`, registry seed/index/replacement (v6)

## Canonical IDs (43)

All `missing` → `/brand/app-logo.png`. Includes trending/search/explore/live/party/creator/category/fallback sets per phase brief.  
**not-in-phase mappings:** `discovery.category.games`, `discovery.party.team-pk-indicator` (no team-PK LiveKind in product).

## Production / fallback / missing

| | |
|--|--|
| Production binaries | **0** |
| Fallbacks | brand mark, existing Lucide icons, existing room covers/avatars, LiveKit preview |
| Missing | all 43 discovery IDs |

## Copy changes

| Before | After | Reason |
|--------|-------|--------|
| Demo topic `UniLiveGlobal` (legacy TrendingScreen) | `UniLive’s` | Official brand spelling |
| Headers gained wordmark | UniLive’s | Brand |

Room titles, usernames, bios, search terms unchanged.

## Identity-binding audit

| Surface | Key | Binding |
|---------|-----|---------|
| Trending creators | `user.id` | `resolveUser(db.users, user)` + follow on that id |
| Trending posts | `post.id` | post image/likes from same post |
| Live cards | `user.id` (+ roomId prop) | host from resolved user; openLiveUserRoom(user.id, …) |
| Party rooms | `room.id` | Link `/room/${room.id}` |
| Risks (pre-existing, Phase 11) | Cloud live stub users may lack full profile until cached | unchanged |

## Presence-display audit

| Indicator | Source | Notes |
|-----------|--------|-------|
| LIVE pill | Static chrome when card is in live discovery list | Not presence heartbeat |
| Viewer count | `useLiveViewerPreviews` / cloud `viewerCount` | Phase 11 if stale |
| Online green-dot on discovery cards | **Not used** on Trending/Live/Party discovery cards | Messages presence elsewhere — deferred |
| Party room participants | cloud room fields | unchanged |

## Room-type labeling audit

| Label | Source | Rule |
|-------|--------|------|
| LIVE | chrome | always for live discovery cards |
| PK | `liveKind === 'pk'` → `kindLabel` / `pkLabel` | **not** from title |
| Audio / Multi / Solo / … | `LIVE_KIND_LABELS[liveKind]` + `formatRoomModeLabel(roomType)` | authoritative |
| Team PK | no `team-pk` LiveKind | asset not-in-phase; no invented label |
| Privacy Public/Private | `normalizeRoomPrivacy(cloud.privacy)` | unchanged |

## Layout / functional / query / follow / room-entry

All **none**.

## Registry / typecheck / build / tests

- Assets: **211** total, **43** discovery, **0** dupes → PASS  
- Typecheck: 28 → **28** (0 new)  
- Build: **PASS**  
- `smoke:manage-tab`: run in validation  

## Screenshots

`docs/unilives-assets/phase-5-screenshots/`

## Rollback

Revert Phase 5 visual/registry/docs files; rebuild `@workspace/instacollab`.

## Risks / Phase 11 deferrals

- All discovery production media missing  
- Team-PK indicator registered but unused (no authoritative team-PK kind)  
- Party “Live Concerts” still uses pre-existing hardcoded concert demos (not added in P5; not removed to avoid scope change)  
- Live viewer preview freshness / LiveKit attach correctness → Phase 11  
- Presence green-dots not on discovery cards; message presence elsewhere → Phase 11  
- Stop: no gifts/badges/chat/realtime/deploy/push without approval
