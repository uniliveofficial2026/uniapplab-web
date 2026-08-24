# UI Kit Architecture

Stage B does **not** redesign UI. This document describes how platform RTC relates to existing UI surfaces.

## Principle

UI components remain in `artifacts/instacollab`. Platform packages provide **facades and orchestrators** — not new visual chrome.

## Approved UI lock (Stage A)

- Visual baselines: 22/22 PASS
- `uiUxChanged: false` — invariant for Stage B
- Live tools v15 chrome, gift panels, PK sheets unchanged

## Integration pattern (target)

```
React UI (unchanged layout)
    ↓ hooks / containers
lib/unilive-rtc/  ← createUniLiveRTC, orchestrators
    ↓
@unilives/rtc-livekit provider
```

## Current migration state

Many hooks still import `livekit-client` via `livekitCompatibilityBoundary.ts` or directly:

- `useMultiGuestLiveKit.ts`
- `OneVsOnePkSessionContainer.tsx`
- `TeamPkSessionContainer.tsx`
- `lib/livekit/*` publish helpers

UI behavior preserved; only import path and join authority change.

## Event lanes vs UI FX

Likes/gift animations remain in product FX layer. `eventLanes.ts` routes authoritative vs loss-tolerant payloads — UI subscribes unchanged.

## App Builder (future)

`ProjectGraph` components/bindings will map to UI kit slots. Not implemented in Stage B foundation.

## Asset pipeline

`unilives-assets` and `unilives-asset-studio` are separate from RTC platform — stickers/gifts/brand resolution unchanged.
