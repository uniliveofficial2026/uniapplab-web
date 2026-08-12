# Animation registry

## Rules

- Static scaling ≠ true animation
- Splash requires brand animation, voice saying only “UniLive’s”, lip-sync, music/FX
- Gifts require true animation + synchronized sound
- Stickers require action / facial / body / lip-sync / voice / FX where specified
- Rings / frames / cards animate **without** voices
- Reduced-motion fallbacks required
- Playable MP4/WebM preview required before production approval

## Seed animation-capable brand IDs

| ID | Expected formats | Notes |
|----|------------------|-------|
| `brand.logo.animated` | webm, json, webp | Default animated splash/logo candidate |
| `brand.loading.mascot` | webm, webp, png | Loading animation |
| Gift / sticker / seat-interaction IDs | svga/webm/json | All currently missing production binaries |

## Local tools

- FFmpeg: preview mux / optimize
- Blender: model correction / custom animation / export
- Three.js / R3F: GLB clip playback in app preview hosts
- Asset Studio: dry-run by default; one paid call max when enabled
