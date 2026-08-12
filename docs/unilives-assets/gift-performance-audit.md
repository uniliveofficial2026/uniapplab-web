# UniLive’s gift performance audit (Phase 7)

Official brand: **UniLive’s**

## Preload strategy

| What | Policy |
|------|--------|
| Gift tray | Preload up to **24** visible canonical asset IDs (thumbnail attempt only) |
| Every SVGA / WebM | **Never** preload on app launch |
| Selected preview | Uses same thumbnail resolver; no eager SVGA decode |
| Common fallbacks | Brand mark already in app shell |

## Concurrency

- GiftPlayOverlay queue + priority unchanged (`GIFT_QUEUE_PRIORITY`).
- One active premium+ media effect at a time (existing pump).
- Combo barrages for normal tier remain lightweight.

## Decoder / memory

| Component | Cleanup |
|-----------|---------|
| `GiftSvgaPlayer` | `stop` / `clear` / `destroy` player + parser on unmount (unchanged) |
| WebM `<video>` | keyed by URL; `onEnded`/`onError` finish |
| Static reduced-motion | 1.8s timer; cleared on unmount |
| Preload cache | in-memory Set; no decoded SVGA instances retained |

## Reduced motion / low performance

- `resolveGiftPlayMedia` sets `preferStatic`.
- Overlay shows static image + attribution text; transaction path unchanged.
- No full-screen SVGA/WebM in those modes.

## Audio

- No gift audio files added.
- Missing audio never blocks visuals.
- Room leave unmounts overlay → players destroyed.

## Lifecycle fixes (Phase 7)

| Fix | Behavior change? |
|-----|------------------|
| Resolve media via business gift ID mapping | Visual only |
| Static path for reduced motion | Visual only |
| Combo state carries `giftId` for thumbnail resolve | Visual only |
| Preload limited tray IDs | Visual only |

No gift events reordered or dropped.
