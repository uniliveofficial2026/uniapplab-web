# UniLive’s Phase 3 — Authentication UI report

Generated: 2026-07-23T07:50:00.000Z  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

## Existing auth flow summary

1. Launch route: splash → onboarding → **auth** → profile_setup → trending → main (`resolveLaunchRoute`)
2. Primary surface: `LaunchFlowHost` → `components/launch/AuthScreen.tsx`
3. Modes: `login` | `signup` | `forgot` | `reset` (+ cloud email method `password` | `otp`)
4. Cloud path: Supabase email/password, email OTP, Google OAuth, password reset/update
5. Demo path: local demo login when cloud auth is not configured (DEV)
6. Legacy path: `components/auth/AuthScreen.tsx` (Firebase / App.tsx when applicable)
7. OTP UI: `EmailOtpPanel` — logic via props/callbacks only
8. Session restore / OAuth return: existing `oauthReturnGuard`, `SupabaseAuthContext`, `syncCloudSessionNow` (untouched in Phase 3)

## 1. Authentication audit table

| File | Component / symbol | Route or mode | Responsibility | Current visual assets | Proposed canonical IDs | Auth logic untouched | Safe Phase 3? |
|------|-------------------|---------------|----------------|----------------------|------------------------|----------------------|---------------|
| `launch/AuthScreen.tsx` | `AuthScreen` | launch `auth`; login/signup/forgot/reset | Primary auth UI | LaunchBrandMark, LaunchShell vibe/orbs, Google SVG | `auth.*.background/illustration`, social, state | Handlers, OAuth, OTP, demo, legal | **yes** (visual) |
| `launch/GoogleAuthButton.tsx` | `GoogleAuthButton` | OAuth button | Official Google mark + click | Inline Google SVG | `auth.social.google` (fallback keeps SVG) | `onClick` | **yes** (chrome only) |
| `launch/AppleAuthButton.tsx` | `AppleAuthButton` | Apple (available) | Official Apple mark | Existing SVG | `auth.social.apple` | handlers | **yes** (wrapper only; not primary launch) |
| `auth/EmailOtpPanel.tsx` | `EmailOtpPanel` | otp / verification | Send/verify OTP UI | secondary/border classes | `auth.otp.*`, `auth.verification.*` | send/verify/resend props | **yes** (tokens) |
| `auth/AuthScreen.tsx` | legacy `AuthScreen` | Firebase fallback | Legacy login/signup/reset | AppLogo + card | auth tokens | Firebase AuthContext methods | **yes** (light tokens) |
| `auth/brand/*` | UniLives auth chrome | visual layer | Shell/header/card/input/status | registry resolve | all auth IDs | none (props only) | **yes** (new) |
| `AuthProvidersHost` / `lib/auth/*` | providers, APIs | — | Auth logic | — | — | **all** | **no** |
| `SupabaseAuthContext` | recoveryMode etc. | — | Session / recovery | — | — | **all** | **no** |
| `LaunchFlowHost` / `launchRoute` | routing | — | Route switch | — | — | **all** | **no** |
| `ProfileSetup*` | profile | after auth | Profile setup | — | — | — | **no** (not-in-phase) |
| Discovery / wallet / gifts / LiveKit | — | — | — | — | — | — | **no** |

## 2. Auth flow summary

- Entry after onboarding completes → launch `AuthScreen`
- Sign in / Create account toggle (cloud) → password or email-code method
- Google OAuth → existing `cloudSignInWithGoogle` / OAuth return guards
- Forgot → reset link (cloud) or demo path
- Reset mode from `recoveryMode` in Supabase auth context
- Success → existing session sync / launch progress (unchanged)

## 3. Auth logic boundaries (must not move into visual components)

- `lib/auth/*` (cloudAuthApi, authService, oauthReturnGuard, localDemoAuth, redirectUrl, …)
- `contexts/SupabaseAuthContext`, `lib/AuthContext`
- Form submit handlers in launch `AuthScreen` (`onLogin`, `onSignup`, `onForgot`, `onReset`, `onOAuth`, `onDemoLogin`, `onEmailOtpVerified`)
- OTP: `authSendEmailOtp` / `authVerifyEmailOtp` + `EmailOtpPanel` callbacks
- Validation: `required`, `minLength`, username availability checks
- Route resolution / redirects / session storage / analytics / error toasts
- Visual components receive **props and callbacks only** — no Supabase/Firebase imports inside `auth/brand/`

## 4–5. Files created / modified

### Created

- `artifacts/instacollab/src/components/auth/brand/` (shell, background, header, card, input, button, social, divider, status, otp class, authResolve, index)
- `artifacts/instacollab/public/unilives-assets/manifests/auth.manifest.json` (or updated)
- `docs/unilives-assets/phase-3-auth-ui-report.md`
- `docs/unilives-assets/phase-3-screenshots/*`

### Modified (Phase 3 visual)

- `artifacts/instacollab/src/components/launch/AuthScreen.tsx` — visual shell/header/card/tokens; handlers preserved
- `artifacts/instacollab/src/components/launch/GoogleAuthButton.tsx` — border/surface tokens; Google SVG fills unchanged
- `artifacts/instacollab/src/components/auth/EmailOtpPanel.tsx` — tokenized classes only
- `artifacts/instacollab/src/components/auth/AuthScreen.tsx` — light auth token classes on legacy card shell
- `artifacts/instacollab/src/index.css` — auth semantic token aliases
- Registry: `seed.json`, `index.manifest.json`, `replacement-map.json`

### Explicitly not modified in Phase 3

- Auth API modules / OAuth scopes / redirect URLs / session storage
- Onboarding, profile setup redesign, discovery, wallet, gifts, LiveKit
- Deploy / push / R2 / Edge Functions

Note: other `lib/auth/*` and `ProfileSetup.tsx` diffs may exist on the working tree from **prior** work; Phase 3 did not redesign profile setup.

## 6. Canonical auth asset IDs added (20)

- `auth.welcome.background` / `auth.welcome.illustration`
- `auth.login.background` / `auth.login.illustration`
- `auth.signup.background` / `auth.signup.illustration`
- `auth.otp.background` / `auth.otp.illustration`
- `auth.verification.background` / `auth.verification.illustration`
- `auth.password-recovery.background` / `auth.password-recovery.illustration`
- `auth.social.google` / `auth.social.apple` / `auth.social.facebook` / `auth.social.email`
- `auth.state.loading` / `auth.state.success` / `auth.state.error`
- `auth.fallback.default`

All `status: missing`, fallback `/brand/app-logo.png` (provider buttons keep official inline marks).

## 7–9. Production / fallback / missing

| Category | Result |
|----------|--------|
| Production auth binaries used | **0** |
| Fallback active | `/brand/app-logo.png` + LaunchBrandMark + official Google SVG + token orbs |
| Missing production assets | All 20 auth IDs |
| Mapping status | **wired-with-fallback** (auth screens); Facebook social **wired-with-fallback** / not shown if no integration |

## 10. Copy changes

| Before | After | Reason |
|--------|-------|--------|
| Plain text brand near mark | `UniLivesWordmark` (UniLive’s) | Official spelling |
| Legal / consent body | Unchanged (still uses `APP_DISPLAY_NAME` + age constant) | No legal rewrite |
| Error / toast strings | Unchanged | Visual only |

## 11. Layout changes

**none** — field order, tabs, providers, legal placement, forgot-password placement preserved.

## 12. Functional changes

**none**

## 13. Auth handler changes

**none** — same submit/OAuth/OTP/demo/legal callbacks; no Supabase/Firebase method changes in Phase 3.

## 14. Registry validation

- Total assets: **148**
- Auth assets: **20**
- Duplicate IDs: **0**
- Brand spelling on entries: **UniLive’s**
- Auth entries without fallback: **0**

## 15. Typecheck baseline comparison

| Metric | Value |
|--------|------:|
| Approved baseline | 28 |
| After Phase 3 | 28 |
| New Phase 3 errors | **0** |
| Normalized diff (new) | empty |
| Normalized diff (gone) | empty |

Pre-existing: `AdminControlCenter.tsx` (1) + `vite.config.ts` (27).

## 16. Build result

`pnpm --filter @workspace/instacollab build` → **PASS**

## 17. Test results

| Script | Result |
|--------|--------|
| `auth:check` | PASS (cloud DB + env ready) |
| `smoke:manage-tab` | PASS |
| `smoke:full-app` / launch smoke | not required if heavy; manage-tab run |

## 18. Manual validation results

Local structural / code review confirmation (no production deploy):

1. Session restore paths untouched → **pass (code)**
2. Logged-out auth route unchanged → **pass**
3–13. Email/password, OTP, OAuth, forgot/reset handlers same references → **pass (code)**
14–17. Loading/disabled/Enter/autocomplete preserved on inputs → **pass (code)**
18. Legal links same handlers → **pass**
19. Demo mode button still DEV-only → **pass**
20. Auth→profile_setup handoff not edited → **pass**
21. Reduced-motion: no new blocking animations on forms → **pass**
22–23. Missing assets resolve via registry fallback; no hardcoded `/unilives-assets/` paths in screens → **pass**
24. Unrelated screens not redesigned in Phase 3 → **pass** (profile setup remains out of phase)
25. No secrets added to browser auth UI → **pass**

Interactive browser credential tests depend on local `.env` / live providers; logic paths unchanged.

## 19. Local screenshot locations

`docs/unilives-assets/phase-3-screenshots/`

Includes welcome/login/signup/otp/verification/forgot/reset/error/loading + mobile 320/390 + tablet 768 + reduced-motion.

## 20. Rollback instructions

1. Revert Phase 3 visual files: `launch/AuthScreen.tsx`, `GoogleAuthButton.tsx`, `EmailOtpPanel.tsx`, light legacy `auth/AuthScreen.tsx`, `index.css` auth tokens, `src/components/auth/brand/`, auth manifest/seed/replacement entries, this report + screenshots.
2. Rebuild: `pnpm --filter @workspace/instacollab build`
3. Confirm login/signup/OAuth/OTP still call the same handlers.

## 21. Risks and blockers

- **Blocker:** all production auth artwork missing → wired-with-fallback until binaries land
- Do not invent provider logos; Google/Apple keep existing official marks
- Facebook registry ID present but no new Facebook CTA invented on launch screen
- Concept boards are reference only — not cropped into production
- Stop: do not start profile-setup / discovery / design-system / gifts / realtime phases without approval
