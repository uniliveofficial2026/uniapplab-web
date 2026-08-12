# UniLive platform architecture

**Source of truth (code):** [`artifacts/instacollab/src/lib/platformArchitecture.ts`](../artifacts/instacollab/src/lib/platformArchitecture.ts)

This document mirrors that contract. Product data and privileged mutations must stay on these lanes only.

## Canonical stack

| Service | Provider |
| --- | --- |
| Authentication | Supabase Auth |
| Database | Supabase Postgres |
| Realtime | Supabase Realtime |
| Images / Videos | Cloudflare R2 |
| CDN | Cloudflare |
| Backend APIs | Supabase Edge Functions |
| Heavy processing | Cloudflare Workers |
| Livestream A/V | LiveKit (TRTC via adapter) |
| Frontend | Vercel (React / Vite / TypeScript / Tailwind) |
| Payments | Stripe (via Edge Functions); Apple/Google Pay later |
| AI Beauty / Voice | Provider abstraction over existing SDKs |

## Data flow

```
Upload bytes → Cloudflare Worker / Edge media gateway → R2 → public URL
URL + metadata → Supabase Postgres (never store media bytes in Postgres or Supabase Storage)
Privileged mutations → Supabase Edge Functions (service role on server only)
Realtime events → Supabase Realtime (chat, gifts, presence, wallet, PK)
A/V transport → LiveKit (never through Supabase)
```

## Client architecture layer (additive)

Under `artifacts/instacollab/src/`:

| Folder | Role |
| --- | --- |
| `services/` | Facades (Auth, Wallet, Gift, Room, Upload, …) wrapping existing `lib/` |
| `store/` | Zustand feature state |
| `providers/` | React Query and other non-visual providers |
| `features/` | Feature logic modules (may import existing UI; do not move UI here yet) |
| `lib/` | Existing implementation — keep until approved migrations |
| `components/` | Existing UI — **do not redesign or rename without approval** |

State: **TanStack Query + Zustand**. No Redux.

## Forbidden lanes

- MongoDB Atlas / Amazon Aurora as app data stores
- Supabase Storage for product media bytes
- Firebase Auth / Auth0 as primary auth (Firebase may remain backup only)
- Exposing `SUPABASE_SERVICE_ROLE_KEY`, R2 secret keys, or JWT secrets to the frontend

## Edge Functions (current)

`architecture`, `media`, `wallet`, `gifts`, `livekit`, `admin`, `me`, `chat`, `stream`, `presence`, `payments`, `platform`, `automation`, `disk-cleanup`

## Media Worker

`workers/uniapplab-media` — R2 binding for avatars, posts, chat, gifts, karaoke, covers, misc.
