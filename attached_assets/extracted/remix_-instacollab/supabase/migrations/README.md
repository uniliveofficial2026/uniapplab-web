# Supabase migrations

Apply **in filename order** on project `kgiaflmukkguzjtmcuqd` (or your `VITE_SUPABASE_URL` project).

## Apply via Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Paste and run each file below, one at a time, in order.
3. Confirm **Authentication → Providers** and **URL Configuration** per `docs/CLOUD_AUTH.md`.

## Apply via CLI

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Files

| File | Purpose |
|------|---------|
| `20260601120000_profiles.sql` | `profiles` table, RLS, `handle_new_user` trigger |
| `20260601130000_google_profile_metadata.sql` | Google OAuth metadata on profiles |
| `20260601140000_apple_profile_metadata.sql` | Apple OAuth metadata on profiles |
| `20260601150000_public_user_id.sql` | Public user ID column + constraints |
| `20260601160000_user_app_state.sql` | JSON app state + Realtime for collections sync |
| `20260601170000_profiles_realtime.sql` | Realtime on `profiles` for live profile edits |

After applying, enable **Realtime** for `profiles` and `user_app_state` if changes do not appear across tabs.
