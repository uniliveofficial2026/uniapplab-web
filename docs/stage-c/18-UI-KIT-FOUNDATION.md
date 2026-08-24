# 18 — UI Kit Foundation (`@unilives/ui`)

Stage C does **not** redesign UI. This document describes the platform UI kit registry — not React components.

## Package

- Path: `lib/unilives-ui`
- Name: `@unilives/ui` v0.1.0

## Factory

`createUiKitRegistry()` returns surface catalog:

| Surface | Status |
|---|---|
| Auth, Profile, Posts, Reels, Messaging | `reference_bound` |
| Calls, Live, AudioRoom, MultiGuest, PK, Gifts, Beauty, Games, Marketplace | `reference_bound` |
| Checkout, Orders, Seller | `foundation` |

Each `reference_bound` entry includes `referencePath` pointing to `artifacts/instacollab` locations.

## Principle

UI components remain in the reference app. Platform package provides **surface registry and contracts** — not new visual chrome.

## Approved UI lock (Stage A → C)

- Visual baselines: 22/22 PASS
- `uiUxChanged: false` — invariant for Stage C
- Live tools v15 chrome, gift panels, PK sheets unchanged

## Integration pattern (target)

```
React UI (unchanged layout)
    ↓ hooks / containers
lib/unilive-rtc/  ← createUniLiveRTC, orchestrators
    ↓
@unilives/rtc-livekit provider
```

## App Builder (future)

`ProjectGraph` components/bindings will map to UI kit slots. Not implemented in Stage B/C foundation.

## Asset pipeline

`@workspace/unilives-asset-studio` and `unilives-assets` are separate from UI kit — stickers/gifts/brand resolution unchanged.

## Classification

**FOUNDATION** + **INTERNAL_ONLY** — no extractable React components yet.

## Stage C notes

Do not export UI components from `@unilives/ui` until explicit extract plan approved. Registry is documentation/metadata only.

## Evidence

`scripts/test-stage-b.mjs` — ui kit foundation gate in `FINAL-STAGE-B-STATUS.json`
