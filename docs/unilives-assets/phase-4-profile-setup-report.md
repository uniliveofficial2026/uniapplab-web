# UniLive’s Phase 4 — Profile setup UI report

Generated: 2026-07-23T08:05:00.000Z  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

## Existing flow summary

1. Launch route: splash → onboarding → auth → **profile_setup** → trending → main (`resolveLaunchRoute`)
2. Primary surface: `LaunchFlowHost` → `components/launch/ProfileSetupScreen.tsx`
3. **Single-screen form** (not multi-step): avatar → display name → username → public User ID → bio → optional avatar URL → legal checkbox → Continue
4. Persist: `commitUserProfile` → local `db.updateUser` → `db.completeProfileSetup` → cloud `flushCloudProfileSync` when configured
5. Avatar pick: camera (`useAppCamera`) or file → `fileToBase64` into local preview state (no production R2 upload in this screen)
6. Legacy: `components/auth/ProfileSetup.tsx` (Firebase / App.tsx path) — same commit path, plus language selector
7. **No interests UI and no creator-options UI** exist in the current profile setup flow

## 1. Profile setup audit table

| File | Symbol | Route / step | Responsibility | Current visuals | Canonical IDs | Untouched logic | Safe P4? |
|------|--------|--------------|----------------|-----------------|---------------|-----------------|----------|
| `launch/ProfileSetupScreen.tsx` | `ProfileSetupScreen` | launch `profile_setup` (single screen) | Primary setup UI | LaunchShell, circular avatar, launch inputs | `profile-setup.welcome.*`, avatar.*, identity.*, bio.*, state.* | `onSave`, username/ID checks, `commitUserProfile`, legal, camera/file | **yes** |
| `launch/PublicUserIdField.tsx` | `PublicUserIdField` | identity field | User ID + availability chrome | launch input styles | identity (tokens) | availability messages/handlers | **yes** (visual + optional `inputClass`) |
| `auth/ProfileSetup.tsx` | `ProfileSetup` | legacy Firebase path | Legacy setup modal | card + Lucide | profile-setup tokens | `handleComplete`, 5MB check, `commitUserProfile` | **yes** (light tokens) |
| `profile-setup/brand/*` | UniLives chrome | visual layer | Shell/header/card/avatar/status | registry | all profile-setup IDs | none | **yes** |
| `lib/auth/userDataFlow.ts` | `commitUserProfile` | persist | Writes | — | — | **all** | **no** |
| `lib/auth/cloudProfile.ts` | cloud sync | persist | Supabase profile | — | — | **all** | **no** |
| `LaunchFlowHost` / `launchRoute` | routing | handoff | Route switch | — | — | **all** | **no** |
| Interests / creator screens | — | — | **do not exist** | — | interests/creator IDs registered | — | **not-in-phase** (no UI invented) |
| Discovery / wallet / gifts / LiveKit | — | — | — | — | — | — | **no** |

## 2–3. Logic boundaries

Must stay outside visual components:

- `commitUserProfile`, `isCloudUsernameAvailable`, `validatePublicUserId`, `usePublicUserIdAvailability`
- `writeLegalAcceptanceToStorage`, `db.completeProfileSetup`
- Avatar `fileToBase64` / camera `openCamera` / 5MB check (legacy)
- Profiles table probe / SQL editor link
- Route progress / trending handoff
- Cloud flush / device account sync

Visual components receive preview URLs, labels, and callbacks only.

## Avatar upload flow (preserved)

1. User taps avatar or “Upload profile photo”
2. If camera available → `openCamera` → `setAvatarUrl(url)`
3. Else / upload button → hidden `<input type="file" accept="image/…">`
4. `onPickAvatar` → `fileToBase64(file)` → local state (toast on failure)
5. Optional Avatar URL field still editable
6. On Continue → `commitUserProfile({ avatarUrl, … })` unchanged
7. Phase 4 does **not** call production R2 and does not upload concept artwork as avatars

## Files created

- `artifacts/instacollab/src/components/profile-setup/brand/*`
- `artifacts/instacollab/public/unilives-assets/manifests/profile-setup.manifest.json`
- `docs/unilives-assets/phase-4-profile-setup-report.md`
- `docs/unilives-assets/phase-4-screenshots/*`

## Files modified

- `launch/ProfileSetupScreen.tsx` (visual shell/header/card/avatar/inputs)
- `launch/PublicUserIdField.tsx` (token styles + optional `inputClass`)
- `auth/ProfileSetup.tsx` (light token classes)
- `index.css` (profile-setup aliases)
- Registry: `seed.json` (v5), `index.manifest.json`, `replacement-map.json`
- Docs: inventory, missing, validation, replacement-map

## Canonical asset IDs added (20)

All `status: missing`, fallback `/brand/app-logo.png`:

- `profile-setup.welcome.background` / `.illustration`
- `profile-setup.avatar.placeholder` / `.upload` / `.success` / `.error`
- `profile-setup.identity.background` / `.illustration`
- `profile-setup.bio.background` / `.illustration`
- `profile-setup.interests.background` / `.illustration` (**not-in-phase** UI)
- `profile-setup.creator.background` / `.illustration` (**not-in-phase** UI)
- `profile-setup.completion.background` / `.illustration`
- `profile-setup.state.loading` / `.success` / `.error`
- `profile-setup.fallback.default`

## Production / fallback / missing

| | |
|--|--|
| Production binaries used | **0** |
| Fallbacks | `/brand/app-logo.png`, Lucide Camera, LaunchShell onboarding-tone orbs, working avatar preview when set |
| Missing | All 20 profile-setup IDs |
| Mapping | wired-with-fallback (welcome/avatar/identity/bio/state); interests/creator **not-in-phase** |

## Copy changes

| Before | After | Reason |
|--------|-------|--------|
| Header had title only | Added `UniLivesWordmark` above title | Official brand spelling |
| Form questions / legal / toasts | Unchanged | No rewrite |

## User-data isolation audit (correctness only)

| Check | Result |
|-------|--------|
| User ID from session/`db.currentUser` via `resolveUser` | Preserved |
| Availability `exceptUserId: me.id` | Preserved |
| Form state is component-local `useState` (not shared singleton) | Preserved |
| `commitUserProfile(me.id, …)` scoped to current user | Preserved |
| Avatar preview is local state on this screen | Preserved |
| Temporary state clears on remount / user change (no global form store) | Preserved |
| Demo vs cloud: `localOnly: !isCloudAuthConfigured()` | Preserved |
| Risks noted (pre-existing, not redesigned) | Legacy `ProfileSetup` seeds local row if missing; language preference is UI-only and not written in `commitUserProfile` patch — unchanged |

## Layout / functional / data model

- Layout changes: **none** (no new steps, fields, or progress bar injected)
- Functional changes: **none**
- Data model changes: **none**

Note: `UniLivesProfileSetupProgress`, `UniLivesInterestChip`, and `UniLivesProfileSetupCompletion` are exported for registry completeness but **not** injected into the single-screen layout (would change structure).

## Registry validation

- Total assets: **168**
- Profile-setup: **20**
- Duplicate IDs: **0**
- Brand spelling: **UniLive’s**
- Result: **PASS**

## Typecheck / build / tests

| Check | Result |
|-------|--------|
| Baseline | 28 |
| After Phase 4 | 28 |
| New errors | **0** |
| Build | **PASS** |
| `auth:check` / `smoke:manage-tab` | run in validation |

## Manual validation (code-path)

1–6. Single screen order, Continue disable rules, username/ID validation references unchanged → pass  
7–9. displayName/bio/avatar still in same `commitUserProfile` patch → pass (no interests IDs exist)  
10–15. Camera/file/`fileToBase64`/toast paths unchanged → pass  
16–21. Completion via `profileSetupComplete: true`; routes untouched → pass  
22–29. Tokens + reduced-motion on motion helpers; no hardcoded `/unilives-assets/` in screens; no deploy → pass  

## Screenshots

`docs/unilives-assets/phase-4-screenshots/`

## Rollback

1. Revert Phase 4 visual/registry/docs files listed above  
2. `pnpm --filter @workspace/instacollab build`  
3. Confirm Continue still calls `commitUserProfile`

## Risks and blockers

- All production profile-setup artwork missing → wired-with-fallback  
- Spec listed interests/creator steps; **current product has none** — IDs registered, UI **not invented** (not-in-phase)  
- Stop: no discovery, gifts, badges, chat/realtime, deploy, or push without approval
