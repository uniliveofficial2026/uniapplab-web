# UniLive’s Phase 2 — Onboarding report

Generated: 2026-07-23T07:33:54.286Z
Status: **complete — awaiting human approval**

## Existing flow summary

1. `resolveLaunchRoute`: splash → **onboarding** → auth → profile_setup → trending → main
2. Entry: `LaunchFlowHost` case `onboarding` → `OnboardingScreen`
3. State: `hasCompletedOnboarding` via `db.completeOnboarding()` (`authLaunch.ts`)
4. Storage: launch progress device key (existing `saveLaunchProgress`)
5. Steps: **4** slides (Welcome, Grow your circle, Chat in real time, Go live & create)
6. Skip / last Get started → `completeOnboarding()` (unchanged)
7. Next → `setIndex(i+1)` (unchanged)
8. No Back control existed (unchanged)
9. Custom background: `settings.onboardingBackgroundUrl` (upload logic unchanged)
10. Auth handoff: route advances after onboarding flag (unchanged)

## Audit table

| File | Symbol | Responsibility | Visual asset | Canonical ID | Untouched logic | Safe P2? |
|------|--------|----------------|--------------|--------------|-----------------|----------|
| OnboardingScreen.tsx | OnboardingScreen | 4-slide UI | Lucide + vibe orbs | onboarding.*.illustration/background | finish/index/completeOnboarding | yes (visual) |
| OnboardingBackgroundUpload.tsx | upload tile | bg upload | Lucide / preview | onboarding.*.illustration | updateSettings upload | yes (visual) |
| launchUi.tsx | LaunchShell / buttons | shell chrome | vibe orbs / gradient | decoration tokens | handlers | yes (opt-in tone) |
| LaunchFlowHost.tsx | route switch | hosts screens | — | — | switch cases | no |
| launchRoute.ts | resolveLaunchRoute | routing | — | — | all | no |
| authLaunch.ts | completeOnboarding | persistence | — | — | all | no |
| AuthScreen.tsx mode onboarding | legacy auth funnel | separate | — | — | — | **no** (not-in-phase) |

## Visual changes

- Onboarding decoration tone uses UniLive’s token orbs
- Progress dots use onboarding progress token
- CTA / Skip use onboarding tone (primary solid)
- Artwork tile uses onboarding surface token + Lucide fallback
- Reduced-motion: slide x-translation disabled via `useReducedMotion`
- Registry IDs registered; production media missing → Lucide + brand fallback

## Copy changes

| Before | After | Reason |
|--------|-------|--------|
| Titles/bodies already used `APP_DISPLAY_NAME` | Same (now UniLive’s curly apostrophe from Phase 1) | Brand spelling already correct via constant |
| No other copy edits | — | No marketing rewrite |

## Assets

- Added 15 onboarding registry entries (all `missing`)
- Production binaries used: **0**
- Fallbacks: Lucide slide icons + `/brand/app-logo.png`
- Mapping statuses: wired-with-fallback (4 slides + shell), not-in-phase (permissions)

## Layout / functional changes

- Layout: **none**
- Functional: **none**

## Rollback

1. Restore `OnboardingScreen.tsx`, `OnboardingBackgroundUpload.tsx`, `launchUi.tsx`, onboarding brand components, token aliases, manifests/seed.
2. Rebuild `pnpm --filter @workspace/instacollab build`.
3. Confirm Skip/Next/completeOnboarding still work.
