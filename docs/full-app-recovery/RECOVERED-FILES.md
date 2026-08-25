# RECOVERED FILES (in progress)

Copied from owner dirty tree into `fix/restore-full-production-app` (no mutation of owner tree):

| File | Classification | Why |
|---|---|---|
| `artifacts/api-server/src/routes/chat.ts` | REAL_APP_REQUIRED | Restores GET `/threads`, GET messages, DM key, group meta |
| `artifacts/api-server/src/lib/chatDmKey.ts` | REAL_APP_REQUIRED | DM thread key helper required by fuller chat router |
| `lib/upstash/index.mjs` + `index.d.ts` | REAL_APP_REQUIRED | Multi-device presence + idempotent stream viewer membership |
| `artifacts/api-server/src/lib/upstash.ts` | REAL_APP_REQUIRED | Re-exports fuller Upstash surface |
| `artifacts/api-server/src/routes/me.ts` | REAL_APP_REQUIRED | `/identities` link/unlink + dual `/` and `/me` handlers |
| `artifacts/api-server/src/routes/presence.ts` | REAL_APP_REQUIRED | Device presence + `/presence/offline` |
| `artifacts/api-server/src/routes/stream.ts` | REAL_APP_REQUIRED | `room_type` + session-based viewers |
| `artifacts/api-server/src/routes/gifts.ts` | REAL_APP_REQUIRED | Live lifecycle gift settlement + catalog/price version checks |
| `artifacts/api-server/src/routes/livekit.ts` | REAL_APP_REQUIRED | Server-derived publish authority (owner/seat), not client `publish` flag |
| `artifacts/api-server/src/routes/youtube.ts` | REAL_APP_REQUIRED | Restores `/youtube/video`, channel, comments, related |
| `artifacts/api-server/src/lib/youtubeQuota.ts` | PLATFORM_REQUIRED | Quota helper used by fuller YouTube router |

Edited in recovery (not from dirty copy):

| File | Why |
|---|---|
| `artifacts/instacollab/src/providers/AuthProvidersHost.tsx` | Provide AuthContext during async provider load (stops offline-stub gap) |
| `artifacts/instacollab/src/main.tsx` | Remove Vercel SpeedInsights (404/MIME on production) |
| `artifacts/instacollab/src/components/onboarding/brand/princessOnboarding{Welcome,Connect,Shine}.css` | Enlarge invisible hit targets for Cap/notch (visual art unchanged) |
| `deploy/render-api/dist/*` | Rebuilt full API bundle after route recovery |
| `scripts/full-app-gates/*` + root `package.json` scripts | CI gates so platform-only builds cannot go green while consumer routes missing |
| `.github/workflows/ci.yml` | Run `test:full-app-gates` on `fix/**` + release paths |

## Intentionally NOT copied yet

| File | Why |
|---|---|
| `artifacts/api-server/src/app.ts` dirty | Adds `bootstrapLocalEnv`, 512mb JSON limit, request timing — needs careful merge with Stage D hardened bootstrap; not required for route completeness |

## Still pending

- Untracked supabase migrations under owner `artifacts/instacollab/supabase/migrations/`
- Physical iPhone completeness recheck after this API redeploy
- Full functional iPhone↔Mac call/live after completeness confirmed
- Do not wholesale overwrite Stage D hardened paths without diff review
