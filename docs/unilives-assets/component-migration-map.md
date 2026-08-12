# UniLive’s component migration map (Phase 6)

Official brand spelling: **UniLive’s**

## Migration order executed

1. Semantic tokens in `index.css`
2. New `components/ui` primitives + class helpers
3. High-frequency shared wrappers (launch UI, toast, fallback, offline, legal checkbox, avatar frame tokens)
4. Documentation + local previews
5. Deferred: Shell nav chrome, feature modals/sheets, mass screen rewrites

## Map

| Before | After | Risk | Status |
|--------|-------|------|--------|
| Ad-hoc Tailwind button colors in launch | Tokenized `LaunchPrimaryButton` / `LaunchTextButton` | Low | Migrated |
| `launchInputClass` raw colors | Semantic input tokens | Low | Migrated |
| Toast hard-coded dark pill | Surface/text/shadow tokens + reduced motion | Low | Migrated |
| `ScreenFallback` pulse divs | `UniLivesSkeleton` + control-hover tokens | Low | Migrated |
| Offline banner amber literals | Warning / surface tokens | Low | Migrated |
| Legal checkbox primary `#…` | Primary + focus-ring tokens | Low | Migrated |
| Avatar inner border `border-white/…` | Border/surface tokens (frame media unchanged) | Low | Migrated |
| No shared Button/Input/Card | `UniLives*` primitives available | Low | Created (opt-in) |
| Shell bottom/top nav | — | High | Deferred |
| Modal/Dialog/Sheet hosts | — | High | Deferred |
| Feature chips on Live/Search | Phase 5 discovery tokens | Medium | Leave (already tokenized per-phase) |
| Gift icons / VIP badges | — | Out of scope | Deferred to later phases |

## Public API

| Consumer | Change |
|----------|--------|
| `LaunchPrimaryButton`, `LaunchTextButton`, `LaunchField` | **None** (className internals only) |
| `showToast` | **None** |
| `Avatar` props | **None** |
| `LegalAgreementCheckbox` props | **None** |
| New `UniLives*` components | Additive only — not required by existing screens |

## Do not migrate yet

- Anything that changes DOM hierarchy, portals, or handlers
- Gift / sticker / badge / ring / frame media
- Legal page layouts
- QR / share cards
- Realtime / presence / LiveKit / PK routing
