---
name: Account switcher (remix_-instacollab reference)
description: Faithful port of Add/Switch Account UI and device account storage from remix_-instacollab zip.
---

## Reference package (in repo)

- **Zip (user download):** `~/Downloads/remix_-instacollab.zip`
- **Extracted copy in monorepo:** `attached_assets/extracted/remix_-instacollab/`
- Re-sync from zip when remix changes: `unzip -o ~/Downloads/remix_-instacollab.zip -d attached_assets/extracted/remix_-instacollab`

## Canonical remix sources

| Concern | Remix path |
|--------|------------|
| Account modal UI | `src/components/profile/ProfileScreen.tsx` (Account Switcher Modal block) |
| Device accounts + Google link | `src/lib/AuthContext.tsx` (`user_accounts`, `selectAccount`, `switchAccount`) |
| Login recent accounts | `src/components/auth/AuthScreen.tsx` |

## App implementation (artifacts/instacollab)

| Piece | Path |
|-------|------|
| Modal component (remix UI) | `src/components/profile/AccountSwitcherModal.tsx` |
| Device storage helpers | `src/lib/auth/deviceAccounts.ts` |
| Google provider + scopes | `src/lib/auth/googleAuthProvider.ts` |
| Auth context (enhanced remix logic) | `src/lib/AuthContext.tsx` |
| Profile entry | `src/components/profile/ProfileScreen.tsx` |

## Enhancements over remix zip (keep when porting)

- `linkGoogleAccount()` — saves current account, signs out Firebase only, opens Google with `prompt=select_account`, rolls back on cancel
- Per-account Google access tokens (`google_access_token_{uid}`) for Workspace tabs
- `syncDeviceAccountForAppUser()` — Supabase/cloud logins appear in account list
- `ensureDeviceAccountsSynced()` — merges Firebase + `db.currentUser` before opening modal

## UX (match remix)

- Profile → Edit profile → **Add or Switch Account** opens modal
- **Add / Link New Google Account** closes modals first, then starts Google link (remix `switchAccount` flow)
