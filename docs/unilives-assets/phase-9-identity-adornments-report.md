# UniLive’s Phase 9 — Identity adornments report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

Visual rendering only. No entitlement, verification, VIP, level, role, subscription, payment, payload, schema, presence, or chat-sync changes. No deploy/push/R2 upload.

---

## 3. Existing identity-adornment flow summary

1. **Verification:** `user.isVerified` → ✓ / CheckCircle2 / ShieldCheck on feed, search, mentions, visitors, workspace.
2. **Profile Premium (VIP display):** `getProfilePremiumAccessStatus(user)` → `ProfilePremiumBadgeForUser` (Crown + “Premium”); inactive/expired hidden.
3. **Creator level:** `CreatorProgress` / `creatorXP` → `CreatorLevelBadge` shows `Lvl {level} {tierLabel}` + XP; Lucide Zap/Award icons.
4. **Room roles:** seat occupancy / moderation state → host/cohost CSS seat frames (`cyan-crown`, `gold-wings`); no separate host badge media overlay invented from seat position alone.
5. **Avatar rings:** CSS gradients for live/story status on `Avatar` — status indicators, not VIP entitlement rings.
6. **Seat frames:** CSS border/shadow via `getAvatarFrameStyles` / `getSeatFrameClasses`; registry frames remain missing → CSS is active fallback.

## 4. Identity logic boundaries

**Must stay outside visual components:** entitlement checks, verification rules, VIP/premium calculations, subscriptions/payments, level/XP math, room-role resolution, moderator/host permissions, expiration, user/room fetch, analytics, DB writes, admin mutations.

**Visual layer may receive only:** authoritative identity props, canonical asset IDs, resolved media, presentation/a11y state.

Lookup direction: authoritative state → display map → canonical ID → resolver → fallback. Never filename/CSS/asset presence → entitlement.

---

## 1. Authoritative identity-state audit

| field/selector | source file | authoritative source | type | default | expiration | visibility | surfaces | safe visual? | risks |
|---|---|---|---|---|---|---|---|---|---|
| `user.isVerified` | `types.ts` / User | profile/user record | boolean | false | n/a | show badge when true | feed, search, mentions, visitors, workspace | **yes** | do not infer from followers |
| `getProfilePremiumAccessStatus` | `lib/premium.ts` | `premiumSubscriptions` | active + expiresAt | inactive | hides when expired | ProfilePremiumBadge | post header, follow lists, profile | **yes** (icon only) | keep Crown fallback |
| `vipTier` (optional) | not on User as SVIP/VVIP | future/explicit prop only | string | none | n/a | registry ready | UniLivesVipBadge | **yes** | do not invent tiers on User |
| `CreatorProgress.level` | `creatorXP.ts` | XP system | number | 1 | n/a | CreatorLevelBadge | profile, preview, modal | **yes** (icon bucket) | keep stored level text |
| `CreatorProgress.tierLabel` | `creatorXP.ts` | XP tiers | string | — | n/a | text beside level | same | **no logic** | display only |
| room host/cohost | `roomSeats.ts` / Room | seat occupancy + ownership | role | none | role removal | seat CSS frames | live seats | **CSS only** | no badge from seat component alone |
| moderation admin/mod | Room moderation | room state | role | none | removal | labels/UI | room admin | deferred media | permissions untouched |
| `frameStyle` | seat guest object | host→cyan-crown, vip seat→gold-wings | string | none | with seat | CSS ring | Room / WatchTogether | **legacy CSS** | overlay only if production |
| avatar live/story status | `Avatar` / liveRing | presence/live flags | enum | none | session | CSS gradient ring | discovery/avatars | **status ring** | not VIP ring |
| selected profile frame ID | none found | n/a | — | — | — | — | — | **not-in-phase** | do not invent picker |
| selected avatar ring ID | none found | n/a | — | — | — | — | — | **not-in-phase** | registry visual-only |
| admin visual overrides | none for badges | n/a | — | — | — | — | — | n/a | no admin schema change |

## 2. Identity rendering-surface audit

| file | component | surface | avatar size | adornments | identity source | current media | proposed IDs | stable key | safe visual? | risks |
|---|---|---|---|---|---|---|---|---|---|---|
| `Post.tsx` | Post header | feed | md | verification + premium | `isVerified` + premium status | ✓ + Crown | `badge.official.verified`, `badge.vip.default` | `postAuthor.id` | **yes** | wired |
| `RepostPostMediaPanel.tsx` | repost header | feed embed | — | verification | `repost.user.isVerified` | ✓ | `badge.official.verified` | `repost.user.id` | **yes** | wired |
| `SearchScreen.tsx` | ProfileNameLines | search | 12/14 | verification as premiumBadge prop | `isVerified` | ✓ | verified badge | `user.id` | **yes** | prop name quirk retained |
| `TrendingScreen.tsx` | creators list | onboarding discover | 12 | verification | `isVerified` | ✓ | verified | `user.id` | **yes** | wired |
| `ProfileVisitorsModal.tsx` | visitor row | profile | Avatar | verification | `isVerified` | CheckCircle2 | verified | `user.id` | **yes** | wired |
| `StoryCaptionComposer.tsx` | mention list | stories | 7 | verification | `isVerified` | ✓ | verified | `u.id` | **yes** | wired |
| `ShellCreateCaptionPanel.tsx` | mention list | create | 7 | verification | `isVerified` | ✓ | verified | `u.id` | **yes** | wired |
| `RecordingStudio.tsx` | caption mentions | karaoke | 7 | verification | `isVerified` | ✓ | verified | `u.id` | **yes** | wired |
| `WorkspaceScreen.tsx` | team roster | workspace | — | verification | `isVerified` | ShieldCheck | verified | `user.id` | **yes** | wired |
| `ProfilePremiumBadge.tsx` | premium chip | many | — | VIP/premium icon | premium status | Crown | `badge.vip.default` | via user | **yes** | entitlement unchanged |
| `CreatorLevelBadge.tsx` | level widget | profile | — | level icon + text | `progress.level` | Zap | `badge.level.*` buckets | profile user | **yes** | text unchanged |
| `Room.tsx` seats | guest avatars | live | seat | CSS frame | `frameStyle` | CSS | `frame.seat.*` | participant id | **CSS fallback** | no layout change |
| `Avatar` | live/story ring | many | varies | status CSS | live/story | gradient | `ring.standard.default` docs | user id | **CSS primary** | not VIP |

## Level display buckets (display-only)

| stored level | bucket | canonical asset ID |
|---|---|---|
| 1–9 | 1-9 | `badge.level.default` |
| 10–24 | 10-24 | `badge.level.10` |
| 25–49 | 25-49 | `badge.level.25` |
| 50+ | 50+ | `badge.level.50` |

Stored level and “Lvl N” text remain exact.

## Identity-binding audit

Wired surfaces pass `userId` / use the same user object as the avatar/name. Seat CSS frames remain bound to seat occupant identity in Room state. No global adornment cache added. Account switch uses current user props (React re-render).

**Pre-existing quirk:** Search/Visitors `premiumBadge` prop slot carries verification visuals — naming only; entitlement still `isVerified`.

## Stacking and collision audit

| combination | current behavior | Phase 9 policy |
|---|---|---|
| verification + premium | Post shows both | preserve; order name → verification → premium |
| level + verification | separate widgets | unchanged |
| host CSS frame + speaking | Room CSS | unchanged; registry overlay only if production |
| ring + frame | status ring CSS + seat CSS | do not stack VIP media rings onto status rings |
| multiple roles | product limits | UniLivesIdentityBadgeStack order: role → verification → VIP → level (ready; not forced everywhere) |

Collisions needing later layout approval: animated ring + speaking indicator; profile frame + cover crop — **deferred**.

## Reduced-motion / performance

- Missing production → Lucide/CSS legacy (no animated identity media active).
- When production arrives: `resolveIdentityMediaUrl` prefers reducedMotion/lowPerformance fallbacks.
- Preload: visible badges/current user only; do not preload all levels/VIP tiers/animated rings.
- List rows: lazy `loading="lazy"` on identity imgs.

## Legacy media

| class | examples |
|---|---|
| active fallback | Lucide CheckCircle2/Crown/Zap; ✓ text replaced by badge component with Lucide fallback; seat CSS frames; Avatar status gradients |
| superseded but retained | prior ✓ spans removed from wired files |
| unmapped | unused `badge.fan.super` without product state |
| unused candidate | none deleted |

## Canonical IDs

**Badges (16):** badge.creator.default, badge.fan.super, badge.host.elite, badge.level.10, badge.level.25, badge.level.50, badge.level.default, badge.official.verified, badge.role.admin, badge.role.cohost, badge.role.moderator, badge.role.supporter, badge.verification.default, badge.vip.default, badge.vip.svip, badge.vip.vvip

**Rings (6):** ring.fan.super, ring.host.elite, ring.standard.default, ring.vip.default, ring.vip.svip, ring.vip.vvip

**Frames (4):** frame.comment.vip, frame.profile.unicorn-dream, frame.seat.audio.vip, frame.seat.video.host

**Identity maps:** 22 × `wired-with-fallback`

## Production assets used

None installed — all identity registry entries `status: missing`. Runtime uses legacy Lucide/CSS.

## Missing production media

All 26 badge/ring/frame registry rows. Expected formats: png/webp/svg (rings may later include webm). Neutral fallback `/brand/app-logo.png` must not display when Lucide legacyNode is provided.

## Proof entitlements preserved

- Verification still gated by `isVerified` only.
- Premium still gated by `getProfilePremiumAccessStatus(...).active`.
- Level text still `progress.level` / XP from `CreatorProgress`.
- Seat `frameStyle` strings and CSS classes unchanged.
- No DB/schema/payload/permission edits in Phase 9.

## Rollback

1. Revert Phase 9 brand components under `src/components/identity/brand/`.
2. Revert `identityResolve.ts` and index exports.
3. Restore Lucide/✓ markup in wired consumers.
4. Restore `ProfilePremiumBadge` Crown-only / `CreatorLevelBadge` Zap-only.
5. Revert seed v9 identity assets/maps (or set maps to `rolled-back`).
6. Rebuild locally.

## Files created / modified

See completion response. Seed version **9**, registered assets **229**.

---

**STOP:** Phase 9 complete. Awaiting human approval before any later phase.
