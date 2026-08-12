<!-- RECOVERY 2026-07-30: File physically present in repository. Prior PASS/fail claims are historical and must not be treated as re-verified unless the recovery verification commands succeed independently. -->

# Final brand audit (Phase 12)

Official display: **UniLive’s** (U+2019).

## Repository scan counts (src + public + docs/unilives-assets)

| Pattern | Approx count | Classification |
|---------|-------------:|----------------|
| UniLive’s (curly) | 511+ | correct |
| UniLives (PascalCase identifier) | 711 | component/package IDs — **retain** |
| UniLive (bare word) | 1238 | mostly comments/paths/docs — **retain** unless UI |
| UniLive's (ASCII) | residual in historical docs + one code comment | documentation / comment — **retain** |
| Uni Live | 0 product | audit doc mentions only |
| UniLive App | 0 product | audit doc mentions only |
| UniLiveGlobal | 3 | historical Phase 5 docs — **retain** |

## Corrected in Phase 12 (user-visible)

| File | Before | After | Reason |
|------|--------|-------|--------|
| `BannedScreen.tsx` | cannot access UniLive. | UniLive’s | user-visible ban copy |
| `LocalGamePlayer.tsx` | Back to UniLive Home | Back to UniLive’s Home | button title |
| `YouTube.tsx` | UniLive's (ASCII) | UniLive’s | label |
| `public/home/index.html` | 11× UniLive's | UniLive’s | marketing landing |
| `vite.config.ts` PWA manifest | UniLive's | UniLive’s | installable name |
| `platformBrand.ts` (api-server + vendor) | UniLive's | UniLive’s | platform brand strings |
| `discord.ts` (api-server + vendor) | UniLive's | UniLive’s | Discord reply copy |

## Intentionally retained

- Identifiers: `UniLives*`, `unilives-assets`, `exitsToUniLiveHome`
- Hosts: `unilive.app`, LiveKit `unilive-*.livekit.cloud`
- Env/package/migration filenames
- Comment in `greedyTap/config.ts` (ASCII in comment)
- Historical phase reports documenting before→after ASCII
- Firebase demo fixture project id strings

## Unresolved / deferred

- Broad comment-only “UniLive” cleanup (non-user-visible)
