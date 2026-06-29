# Cloud auth and realtime sync

InstaCollab uses **Supabase Auth** as the primary cloud backend when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Sessions, profiles, and app data sync through one pipeline.

## Code map

| Piece | Path |
|--------|------|
| Sign-in / sign-up / OAuth | `src/lib/auth/authService.ts` |
| UI exports | `src/lib/auth/cloudAuthApi.ts` |
| Session → local `db` | `src/lib/auth/sessionManager.ts` |
| Profile push + availability | `src/lib/auth/cloudProfile.ts` |
| Realtime app collections | `src/lib/auth/cloudAppState.ts` |
| React provider | `src/contexts/CloudAuthContext.tsx` |

Flow: **auth** → `applySupabaseSessionToLocalDb` → `db.syncAuthUser` → profile Realtime + `user_app_state` Realtime → every `db.save` debounces a cloud push.

## One-time Supabase setup

Project (this repo): `kgiaflmukkguzjtmcuqd` (from `.env`).

### 1. Environment

Copy `.env.example` → `.env` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Restart dev server after changes.

Verify locally:

```bash
npm run auth:check
```

### 2. Database tables (required)

If you see **“Could not find the table public.profiles”**, the cloud database was never set up.

**Fastest (recommended):**

```bash
npm run auth:bootstrap-db
```

This copies `supabase/bootstrap.sql` to your clipboard and opens the Supabase SQL Editor. Paste → **Run** → hard-refresh the app.

Verify:

```bash
npm run auth:check
```

Should show `public.profiles table: exists`.

**Alternative:** run each file under `supabase/migrations/` in order (see `supabase/migrations/README.md`).

### 3. Authentication providers

**Supabase → Authentication → Providers**

- **Email**: enabled (sign-up + sign-in).
- **Google**: enabled — use the same **Web** OAuth client as Google Cloud (Client ID + secret).
- **Apple**: optional — enable if you use Apple sign-in.

**Supabase → Authentication → URL Configuration**

- **Site URL**: `http://localhost:3000` for local dev, or your public tunnel URL when using `npm run dev:public`.
- **Redirect URLs**: add `http://localhost:3000/**` and your tunnel URL with `/**` (e.g. `https://xyz.trycloudflare.com/**`).

### 4. Google Cloud (for Google sign-in)

When using a public tunnel:

```bash
npm run dev:public
npm run oauth:setup -- https://YOUR-SUBDOMAIN.trycloudflare.com
```

**Google Cloud → APIs & Services → Credentials → Web client**

| Field | Value |
|--------|--------|
| **Authorized redirect URIs** | `https://YOUR_PROJECT.supabase.co/auth/v1/callback` only |
| **Authorized JavaScript origins** | `http://localhost:3000`, your tunnel `https://….trycloudflare.com` |

Do **not** put `trycloudflare.com` in **redirect URIs** — only in **JavaScript origins**.

### 5. Realtime

**Database → Replication**: ensure `profiles` and `user_app_state` are in the `supabase_realtime` publication (migrations attempt to add them).

## Running the app

| Command | Use |
|---------|-----|
| `npm run dev` | Local only (`localhost:3000`) |
| `npm run dev:public` | Local + HTTPS tunnel for OAuth |
| `npm run oauth:setup` | Print exact Google/Supabase URLs |
| `npm run auth:check` | Validate env + list migrations |
| `npm run verify` | Typecheck, lint, build, health |

## Testing checklist

1. **Email sign-up** → confirm email if required → log in → profile setup → feed.
2. **Email log-in** → welcome toast within a few seconds (not stuck on “Restoring your session…”).
3. **Google** (tunnel URL in browser) → redirect back → signed in → feed.
4. **Realtime**: two tabs, same account — like a post on tab A → tab B feed updates.
5. **Dev demo** (no cloud): `demo@instacollab.app` / `demo123` on `npm run dev` only.

## Legacy Firebase-only

If **only** `VITE_FIREBASE_*` is set (no Supabase), `CloudAuthContext` uses the Firebase auth path. For new deployments, prefer Supabase only. See `docs/FIREBASE_AUTH.md` for Firebase-only notes.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Incorrect email or password” | Sign up first, or use correct Supabase account; dev demo uses `demo123`. |
| `redirect_uri_mismatch` | Add Supabase callback URL to Google **redirect URIs**; run `npm run oauth:setup`. |
| Stuck “Restoring session…” | Wait ~8s safety timeout; check browser console; confirm migrations ran. |
| Google “invalid” / code 11 | JavaScript origins must include exact tunnel URL; redirect URI must be Supabase callback. |
| “Database error saving new user” | Run `20260601120000_profiles.sql`. |
| Data not syncing across tabs | Run `user_app_state` + Realtime migration; stay signed in with same account. |
