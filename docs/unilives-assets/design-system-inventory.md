# UniLive’s design-system inventory

Official brand spelling: **UniLive’s**  
Phase: 6 (global design-system rollout)

## Canonical primitives (`src/components/ui/`)

| Component | File | Variants / API notes | Safe consumers |
|-----------|------|----------------------|----------------|
| `UniLivesButton` | `Button.tsx` | primary, secondary, outline, ghost, destructive, success, icon, link; sizes sm/md/lg/icon; `loading` | New surfaces; launch continues via Launch* wrappers |
| `UniLivesInput` / `UniLivesTextarea` | `Input.tsx` | Native attrs preserved | Forms adopting classes |
| `UniLivesCard` | `Card.tsx` | Surface + border + shadow tokens | Cards |
| `UniLivesChip` / `UniLivesBadge` | `Chip.tsx` | Selected chip; LIVE/status badge tone | Filters/labels (visual) |
| `UniLivesSpinner` / `UniLivesSkeleton` / `UniLivesDivider` | `Spinner.tsx` | Reduced-motion aware skeleton | Loading chrome |
| `UniLivesEmptyState` / `UniLivesErrorState` | `EmptyState.tsx` | Copy + retry handler props only | Empty/error wrappers |
| `UniLivesSurface` / `UniLivesAvatarFrame` | `Surface.tsx` | Container chrome only | Panels; avatar frame border |
| Class helpers | `classes.ts` | Shared Tailwind class strings | Tokenized without remounting |

## Shared wrappers (pre-existing, tokenized in Phase 6)

| Surface | File | Notes |
|---------|------|-------|
| Launch buttons/fields | `launch/launchUi.tsx` | Public API unchanged; tokens + focus ring |
| Toast | `lib/ToastContext.tsx` | `showToast` API unchanged; reduced motion |
| Screen skeleton | `common/ScreenFallback.tsx` | Uses `UniLivesSkeleton` |
| Offline banner | `common/OfflineStatusBanner.tsx` | Warning tokens |
| Legal checkbox | `legal/LegalAgreementCheckbox.tsx` | Focus ring + primary link color |
| Avatar container | `common/Avatar.tsx` | Border/bg tokens only; rings/VIP untouched |

## Deferred (behavior / feature risk)

| Surface | Reason |
|---------|--------|
| `Shell.tsx` top/bottom nav structure | Layout + safe-area + route active logic — style-only later |
| Feature modals / sheets / drawers | Focus trap, Escape, click-outside — defer |
| Switch / radio / checkbox shared components | No shared primitive existed; leave local |
| Tooltips (feature-specific) | Keyboard behavior risk if remounted |
| Gift / VIP / level badge media | Later phases |
| Avatar rings / frames media | Later phases |
| GreedyNavIcon emoji (🥕/🍖) | Feature-specific functional emoji — leave |
| Karaoke / admin / workspace raw colors | Layout-sensitive / feature-specific |
| Dialog/sheet portal hosts | Preserve portals and z-index |

## Icon policy

- Keep existing Lucide / current icon set.
- No new icon library.
- No functional emoji replacements in Phase 6 (documented: **none performed**).
