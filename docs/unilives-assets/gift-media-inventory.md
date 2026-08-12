# UniLive’s gift media inventory

Official brand: **UniLive’s**  
Phase: 7

## Production UniLive’s gift binaries

| Location | Status |
|----------|--------|
| `public/unilives-assets/gifts/**` | Directories reserved (`.gitkeep`); **0 production binaries** |
| Manifest entries | 70 gift assets, all `status: missing` |

## Legacy active fallbacks (retained)

| Path | Kind | Related business IDs |
|------|------|----------------------|
| `/live-gifts/mic.svga` | SVGA | `mic` |
| `/live-gifts/star.svga` | SVGA | `star`, `galaxy`, `eternity`, … |
| `/live-gifts/crown.svga` | SVGA | `crown`, `diamond`, `unicorn`, `universe`, `divine`, … |
| `/live-gifts/rocket.svga` | SVGA | `rocket`, `castle`, `phoenix`, `dragon`, … |
| `/live-gifts/manifest.json` | legacy manifest | — |
| Catalog `icon` emoji | temporary thumbnail | all gifts without media URL |
| Admin remote icon URL | override | when `isGiftIconMediaUrl` |

## Neutral fallback

`/brand/app-logo.png` — used when no emoji/media/legacy URL applies (also reduced-motion / low-performance static).

## Audio

| Item | Status |
|------|--------|
| Gift audio entries in registry | None invented |
| Playback | `shouldPlayAssetAudio` remains false without `asset.audio` |
| Mute | Visual still shows; no audio invented |

## Formats preference (resolver)

1. SVGA → 2. WebM → 3. JSON → 4. WebP → 5. PNG  
Reduced motion / low performance → static formats / brand mark.
