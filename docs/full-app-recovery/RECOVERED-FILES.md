# RECOVERED FILES (in progress)

Copied from owner dirty tree into `fix/restore-full-production-app` (no mutation of owner tree):

| File | Classification | Why |
|---|---|---|
| `artifacts/api-server/src/routes/chat.ts` | REAL_APP_REQUIRED | Restores GET `/threads`, GET messages, DM key, group meta |
| `artifacts/api-server/src/lib/chatDmKey.ts` | REAL_APP_REQUIRED | DM thread key helper required by fuller chat router |

Edited in recovery (not from dirty copy):

| File | Why |
|---|---|
| `artifacts/instacollab/src/providers/AuthProvidersHost.tsx` | Provide AuthContext during async provider load (stops offline-stub gap) |
| `artifacts/instacollab/src/main.tsx` | Remove Vercel SpeedInsights (404/MIME on production) |
| `artifacts/instacollab/src/components/onboarding/brand/princessOnboarding{Welcome,Connect,Shine}.css` | Enlarge invisible hit targets for Cap/notch (visual art unchanged) |

## Still pending reconcile from owner dirty API

- `routes/me.ts`, `gifts.ts`, `livekit.ts`, `presence.ts`, `stream.ts`, `youtube.ts`, `app.ts`
- Untracked supabase migrations under owner `artifacts/instacollab/supabase/migrations/`

Do not wholesale overwrite Stage D hardened paths without diff review.
