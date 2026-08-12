# Phase 8 media tests (local)

Official brand: **UniLive’s**

## Stickers
- Editor/story: 12 emoji overlays; business slugs (`fire`, …) map to `sticker.reaction.*` / `sticker.static.*`.
- Drafts still store emoji string (unchanged payload).
- Beauty AR stickers: Tencent remote `cover` via remoteIconOverride; effect `id` unchanged.
- Production unilives-assets sticker binaries: missing.

## Seat interactions
- Registry: 10 `interaction.*` assets; business IDs `kiss`, `hug`, …
- **No Room seat-interaction picker/send UI exists** — components + resolver only; no fake events.
- Seat action sheet remains mute/follow/profile/mention/remove/ban.

## Audio
- No sticker/interaction audio invented.
- Manifest audio paths remain missing and unused.

Do not upload.
