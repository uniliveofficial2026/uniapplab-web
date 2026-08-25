# UniLive Provider Map

**Base SHA:** `9e8c44a` · **Prod:** https://app.uniapplab.com  
**No secrets in this doc** — env var **names** only where useful.

---

## LiveKit

| Item | Detail |
|------|--------|
| Role | Production A/V + data channels for live, party, calls, PK media |
| Client package | `@unilives/rtc-livekit` → `livekit-client` |
| App facade | `lib/unilive-rtc`, `lib/livekit/*` |
| Compatibility | `lib/rtc/livekitCompatibilityBoundary.ts` |
| Token API | `artifacts/api-server/src/routes/livekit.ts` |
| Grant | `@unilives/rtc-server` |
| Capacitor allowNavigation | `*.livekit.cloud` |

---

## Supabase

| Item | Detail |
|------|--------|
| Role | Primary auth, Postgres, Realtime (`postgres_changes`), Edge functions |
| Client | App Supabase modules under `lib/supabase/*`, cloud facades |
| Gifts Edge | `supabase/functions/gifts` |
| Migrations | `artifacts/instacollab/supabase/migrations/*` (gifts, push_devices, commerce, …) |
| Dual-write | Firebase mirror when configured (`liveDataFlowMap` / cloud facades) |
| Capacitor allowNavigation | `*.supabase.co` |

---

## Cloudflare R2 + Workers

| Item | Detail |
|------|--------|
| R2 API helper | `artifacts/api-server/src/lib/r2.ts` |
| Media routes | `artifacts/api-server/src/routes/media.ts` |
| Client upload | `lib/media/r2Upload.ts` `uploadBlobToR2` |
| Worker (media CDN/upload) | `workers/uniapplab-media/` |
| Worker (SPA/API/game/media proxy) | `workers/uniapplab-app/` (`productionRtcApi: UniLiveRTC`) |
| Folders (conceptual) | avatars, posts, chat, gifts, karaoke, … |
| Read path | CDN URL or `/api/media/object` presigned GET |

---

## Firebase (backup / messaging config)

| Item | Detail |
|------|--------|
| Role | Auth/data mirror + messaging sender config |
| Config | `lib/firebase/*` (no secrets here) |
| Messaging sender | `getFirebaseMessagingSenderId()` |
| Emulators | Localhost-only in DEV — must not be used in production builds |

---

## FCM / APNS / Web Push

| Provider | Client | Server | Notes |
|----------|--------|--------|-------|
| FCM | Push lifecycle + Firebase messaging config | `/api/push/register` platform `fcm` | Android / web paths |
| APNS | Same registry platform `apns` | Same API → `push_devices` | Alert push registration model; **not** VoIP PushKit |
| Web Push | `web_push` | Same | Browser |

**APNS production readiness for background calls:** **Not ready** (no VoIP background mode / PushKit; CallKit feature flag false).

---

## Optional / ancillary

| Provider | Role |
|----------|------|
| `artifacts/chat-ws` | Optional typing/thread fanout — not sole message store |
| DeepAR / Tencent WebAR | Beauty/AR processing over MediaStream (not RTC provider) |
| Upstash / QStash | Background jobs (`api-server` qstash routes) — admin/handoff |

---

## Production origin allowlist (security)

`lib/security/installAppSecurity.ts` includes `app.uniapplab.com` and localhost for **DEV**. Production traffic must stay on `app.uniapplab.com`.
