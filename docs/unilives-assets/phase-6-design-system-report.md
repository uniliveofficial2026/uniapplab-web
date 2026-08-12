# UniLive’s Phase 6 — Design-system report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

Visual consistency only. No gifts, badges, rings, frames, legal redesign, QR/share cards, realtime, presence, LiveKit, PK, deploy, or push.

---

## 1. UI primitive audit

| File | Component / class | Variants | Breadth | Duplicates | Semantics | A11y | Canonical | Safe P6? | Risk |
|------|-------------------|----------|---------|------------|-----------|------|-----------|----------|------|
| *(none pre-existing)* | Shared `ui/` library | — | — | Tailwind ad-hoc | — | — | Create `components/ui` | yes | low |
| `launch/launchUi.tsx` | LaunchPrimary/Text/Field | primary/ghost/link-like | Launch auth/onboarding/profile | Many local `button` classes | `<button>` / `<input>` | focus/disabled | Tokenize Launch*; keep API | **yes** | low |
| `lib/ToastContext.tsx` | Toast | single | App-wide | ad-hoc alerts | portal toast | live region | Token + reduced motion | **yes** | low |
| `common/ScreenFallback.tsx` | skeleton shell | one | Suspense | local pulse divs | presentational | none critical | `UniLivesSkeleton` | **yes** | low |
| `common/OfflineStatusBanner.tsx` | banner | one | Network | amber banners | status | text | warning tokens | **yes** | low |
| `legal/LegalAgreementCheckbox.tsx` | checkbox + links | one | Auth/legal | local checkboxes | native checkbox | labels/links | tokens + focus-ring | **yes** | low |
| `common/Avatar.tsx` | avatar chrome | sizes/rings | High | frame styles in rooms | img + overlays | alt | container tokens only | **yes** (chrome) | med |
| `Shell.tsx` | top/bottom nav | tabs | App shell | — | nav + routes | labels | defer structure | **no** | high |
| Feature modals/sheets | Dialog/Sheet | many | Rooms/wallet/etc | local portals | focus trap | Escape | defer | **no** | high |
| Local buttons/inputs | Tailwind | many | Most screens | Launch / UniLives* | native | mixed | migrate gradually | partial | med |
| Switch/radio | local | sparse | Settings/forms | none shared | native | labels | defer shared | defer | low |
| Chip/tab rows | Tailwind | many | Discovery (P5) | UniLivesChip | buttons | mixed | leave P5 tokens | defer mass | med |
| Spinner | ad-hoc | many | Loading | UniLivesSpinner | presentational | busy | opt-in | yes create | low |
| Empty/error | copy blocks | many | Lists | UniLivesEmpty/Error | text + retry | announcements | wrappers only | yes create | low |

---

## 2. Token audit summary

| Class of value | Classification |
|----------------|----------------|
| Semantic theme vars (`--background`, `--card`, …) | **leave** — aliased by Phase 6 tokens |
| Phase 1–5 feature namespaces | **leave** — still valid |
| Launch / toast / fallback / offline / legal / avatar frame colors | **migrate now** |
| Shell nav geometry colors that affect layout | **defer layout-sensitive** |
| Gift/VIP/badge media colors | **defer feature-specific / later phase** |
| User-generated content colors | **leave unchanged** |
| Arbitrary z-index on modals | **defer** (behavior) |
| Karaoke/admin/workspace hex sprawl | **defer layout-sensitive** |
| Focus rings missing on launch/legal | **migrate now** |

---

## 3. Duplicate component audit

| Pattern | Locations | Canonical choice |
|---------|-----------|------------------|
| Primary CTA blue buttons | Launch + many screens | `UniLivesButton` / LaunchPrimary (tokenized) |
| Full-width inputs | Launch + auth + profile | `unilivesInputClass` / UniLivesInput |
| Pulse skeleton blocks | ScreenFallback + screens | `UniLivesSkeleton` |
| Dark toast pill | ToastContext only (shared) | Tokenized ToastContext |
| Card bordered panels | Everywhere | `UniLivesCard` / `unilivesCardClass` (opt-in) |
| Modal overlays | Feature folders | **Deferred** — do not unify hosts |

---

## 4. Canonical components selected

- `UniLivesButton`, `UniLivesInput`, `UniLivesTextarea`, `UniLivesCard`, `UniLivesChip`, `UniLivesBadge`
- `UniLivesSpinner`, `UniLivesSkeleton`, `UniLivesDivider`
- `UniLivesEmptyState`, `UniLivesErrorState`
- `UniLivesSurface`, `UniLivesAvatarFrame`
- Class helpers in `classes.ts`
- Existing Launch* wrappers remain the launch-surface API (tokenized, not replaced)

---

## 5. Files created

- `artifacts/instacollab/src/components/ui/{Button,Input,Card,Chip,Spinner,EmptyState,Surface,classes,index}.ts(x)`
- `docs/unilives-assets/phase-6-design-system-report.md`
- `docs/unilives-assets/design-system-inventory.md`
- `docs/unilives-assets/design-token-reference.md`
- `docs/unilives-assets/component-migration-map.md`
- `docs/unilives-assets/phase-6-screenshots/*` (31 HTML previews + README)

## 6. Files modified

- `artifacts/instacollab/src/index.css` — Phase 6 semantic token layer + utilities
- `artifacts/instacollab/src/components/launch/launchUi.tsx`
- `artifacts/instacollab/src/lib/ToastContext.tsx`
- `artifacts/instacollab/src/components/common/ScreenFallback.tsx`
- `artifacts/instacollab/src/components/common/OfflineStatusBanner.tsx`
- `artifacts/instacollab/src/components/legal/LegalAgreementCheckbox.tsx`
- `artifacts/instacollab/src/components/common/Avatar.tsx` (container tokens only)

**Not updated:** `asset-validation-report.md`, `asset-inventory.md`, `replacement-map.json` (no registry / production asset changes).

---

## 7. Components migrated

- Launch primary/text buttons + input class + shell text/bg tokens
- Toast surface / motion / aria live
- ScreenFallback skeletons
- OfflineStatusBanner
- LegalAgreementCheckbox focus/links
- Avatar inner frame border/background tokens

## 8. Components deferred

- Shell top/bottom navigation structure
- Feature modals, dialogs, sheets, drawers, menus
- Shared switch/radio library
- Feature tooltips remount
- Mass discovery/live/party local chip rewrites (already Phase 5 tokenized)
- Gift/Coin icons, VIP/level badges, avatar rings/frames media
- GreedyNavIcon functional emoji
- Karaoke/admin/workspace hex cleanup

---

## 9. Semantic tokens added

Full Core / Status / Controls / Shape / Elevation / Motion / Typography set documented in `design-token-reference.md`. Utilities: `.unilives-focus-ring`, `.unilives-surface`, `.unilives-text-muted`, `.unilives-transition-*`.

## 10. Raw visual values replaced (representative)

- Launch button/input/shell hard-coded slate/blue → semantic tokens
- Toast `#0f172a` / white → surface tokens + shadow token
- Offline amber banner → warning/surface tokens
- Legal link colors → primary token + focus ring
- Avatar frame border/bg → border/surface tokens
- ScreenFallback gray pulses → control-hover + skeleton primitive

---

## 11. Accessibility corrections

| Correction | Where |
|------------|-------|
| Visible focus-visible ring utility | `.unilives-focus-ring` on launch buttons/links, legal links, new primitives |
| Toast `role="status"` / `aria-live` | ToastContext |
| Reduced-motion for toast + skeleton pulse | ToastContext, ScreenFallback, transition utilities |
| Button `aria-busy` when loading | UniLivesButton (additive primitive) |

No product behavior changes for focus traps, Escape, or click-outside (those hosts deferred).

## 12. Functional icon replacements

**None.**

## 13–17. Preservation proof

| Item | Result |
|------|--------|
| Public component API changes | **none** |
| Layout changes | **none** |
| Functional changes | **none** |
| Route changes | **none** |
| Business-logic changes | **none** |

Evidence: Launch* / `showToast` / Avatar / Legal checkbox props and handlers unchanged; no route or query edits; Avatar ring/VIP/live/story logic untouched; TypeScript error set identical to baseline.

---

## 18. Registry changes

**None.** No new assets registered; no R2 upload; no `replacement-map.json` updates.

## 19. Typecheck baseline comparison

| | |
|--|--|
| Approved baseline | **28** errors |
| After Phase 6 | **28** errors |
| New Phase 6 errors | **0** |
| Diff (normalized paths) | empty |

## 20. Build result

`pnpm --filter @workspace/instacollab build` → **PASS** (`✓ built in ~27s`)

## 21. Test results

| Script | Result |
|--------|--------|
| `typecheck` | 28 = baseline |
| `build` | PASS |
| `smoke:manage-tab` | PASS |
| `auth:check` | PASS (env/DB ready notes) |

Other scripts (`smoke:full-app`, `test:reels`, etc.) not required for design-system chrome; not invented.

## 22. Manual validation (local / code-path review)

| # | Check | Result |
|---|-------|--------|
| 1–5 | Splash / onboarding / auth / profile / discovery surfaces | Preserved (Phases 1–5 + token consumers) |
| 6 | Navigation destinations | Unchanged (Shell deferred) |
| 7–10 | Submit / link / disabled / loading double-submit | Launch + UniLivesButton preserve native semantics; loading disables |
| 11–12 | Autocomplete / password managers | Input attrs untouched |
| 13–15 | Dialog focus / Escape / click-outside | Deferred hosts — behavior unchanged |
| 16–17 | Toast / tooltips | Toast tokenized; tooltips deferred |
| 18–19 | Bottom nav safe-area / tabs | Structure deferred — unchanged |
| 20–23 | Follow / room entry / wallet / gifts | Untouched |
| 24–26 | No new realtime / routes / layout structure | Confirmed |
| 27–28 | Images / resolvers | No registry changes |
| 29–34 | Reduced motion / responsive / focus / no deploy | Utilities + local-only |

## 23. Screenshot locations

`docs/unilives-assets/phase-6-screenshots/` — HTML previews for buttons, forms, surfaces, nav placeholders, and representative screens (onboarding, login, profile setup, trending, search, live, party, shell). Local only; not published.

## 24. Rollback instructions

1. Revert `artifacts/instacollab/src/index.css` Phase 6 token/utility block (restore prior surface alias if needed).
2. Delete `artifacts/instacollab/src/components/ui/`.
3. Restore modified files: `launchUi.tsx`, `ToastContext.tsx`, `ScreenFallback.tsx`, `OfflineStatusBanner.tsx`, `LegalAgreementCheckbox.tsx`, `Avatar.tsx`.
4. Remove Phase 6 docs under `docs/unilives-assets/phase-6-*`, `design-system-inventory.md`, `design-token-reference.md`, `component-migration-map.md`.
5. Re-run `pnpm --filter @workspace/instacollab typecheck` (expect 28) and `build`.

## 25. Risks and blockers

- Mass screen adoption of `UniLives*` not done — intentional to avoid layout regressions.
- Shell / modal hosts still use pre-Phase-6 local styling until a dedicated low-risk pass.
- Avatar rings/VIP media still legacy (later phases).
- Production brand media still missing (Phases 1–5 registry pattern).
- No visual pixel QA against device screenshots beyond local HTML previews.

---

**STOP.** Awaiting explicit human approval before any later phase (gifts, badges, VIP, rings, frames, legal, QR/share, chat, presence, live registration, PK, realtime, deploy).
