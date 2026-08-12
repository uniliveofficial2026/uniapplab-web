# UniLive’s gift business → visual map

Official brand: **UniLive’s**  
Phase: 7  
Source: `replacement-map.json` / `seed.json` (version 7)

## Rules

- Business gift IDs are authoritative for wallet, transactions, ranking, analytics, history.
- Visual asset IDs are registry-only.
- One active visual mapping per business gift.
- `gift.mythic.universe` is **reserved / unassigned** — never map `universe` to it.
- `phoenix` business remains **epic / 1000 stars**; visual ID is `gift.legendary.phoenix` (documented mismatch).

## Active mappings (status: wired-with-fallback)

| businessGiftId | canonicalAssetId | businessTier | visualTier | price | currency | legacyAnimation | notes |
|----------------|------------------|--------------|------------|------:|----------|-----------------|-------|
| `phoenix` | `gift.legendary.phoenix` | epic | legendary | 1000 | stars | `/live-gifts/rocket.svga` | Visual-only tier mismatch |
| `universe` | `gift.legendary.universe` | legendary | legendary | 50000 | stars | `/live-gifts/crown.svga` | mythic.universe not mapped |
| `mic` | `gift.normal.mic` | normal | normal | 25 | stars | `/live-gifts/mic.svga` | |
| `star` | `gift.normal.star` | normal | normal | 50 | stars | `/live-gifts/star.svga` | |
| `crown` | `gift.premium.crown` | premium | premium | 100 | stars | `/live-gifts/crown.svga` | |
| `rocket` | `gift.premium.rocket` | premium | premium | 250 | stars | `/live-gifts/rocket.svga` | |
| … | … | … | … | … | stars | catalog / shared legacy SVGA | See Phase 7 report |

Full 69 gift mappings: `public/unilives-assets/manifests/replacement-map.json` (`type: "gift"`).

## Reserved (not mapped)

| Asset ID | Status | Reason |
|----------|--------|--------|
| `gift.mythic.universe` | unassigned / visual-only-reserved | Must not double-map `universe` |

## Lookup path (runtime)

```
businessGiftId
  → getGiftReplacementMapping (preserveBusinessId, not rolled-back/unmapped/not-in-phase)
  → canonicalAssetId
  → resolveAsset / resolveGiftPlayMedia / resolveGiftThumbnailVisual
  → registry production | legacy SVGA/emoji | /brand/app-logo.png
```
