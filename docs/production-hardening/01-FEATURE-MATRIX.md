# 01 — Feature Matrix (Stage A)

Invariant: **uiUxChanged: false** — verify/harden behavior only; no redesign.

Status legend: `UNKNOWN` | `IN_PROGRESS` | `PASS` | `FAIL` | `N/A`

| ID | Feature | Owner surface | Status | Notes |
|---|---|---|---|---|
| F-AUTH | Auth / session | instacollab + Supabase Auth | UNKNOWN | Re-verify vs rtc-audit identity docs |
| F-IDENTITY | Identity projection (user ↔ provider ids) | lib + api-server + LiveKit | UNKNOWN | See `04-IDENTITY-MAP.md` |
| F-LIVE | Live room join / publish / subscribe | instacollab + LiveKit + api-server | UNKNOWN | Primary RTC path |
| F-CAMERA | Camera / mic capture | instacollab | UNKNOWN | |
| F-BEAUTY | Beauty / AR pipeline | instacollab | UNKNOWN | |
| F-SEATS | Multiguest / seats | api-server + DB + LiveKit data | UNKNOWN | |
| F-PK | PK battles | api-server + LiveKit + DB | UNKNOWN | |
| F-GIFTS | Gift send / settle / FX | api-server + DB + LiveKit | UNKNOWN | Dual-lane risk (audit claim) |
| F-WALLET | Wallet balance / earnings | api-server + DB | UNKNOWN | |
| F-LIKES | Live likes | LiveKit data (ephemeral) | UNKNOWN | |
| F-CHAT-ROOM | Live comments | Supabase Realtime + DB | UNKNOWN | |
| F-CHAT-DM | DMs / cloud chat | Supabase + chat paths | UNKNOWN | |
| F-TYPING | Typing indicators | Presence / chat-ws | UNKNOWN | |
| F-PRESENCE | App + room presence | api-server + Realtime | UNKNOWN | |
| F-CALL | 1:1 / chat calls | LiveKit + chat signaling | UNKNOWN | |
| F-GAME | Live arcade / game bus | LiveKit data | UNKNOWN | |
| F-MEDIA-CDN | Media CDN / R2 assets | workers/uniapplab-media | UNKNOWN | |
| F-ADMIN | Admin config surfaces | admin-panel | UNKNOWN | |
| F-API-CONTRACT | OpenAPI / Zod / client | lib/api-* + api-server | IN_PROGRESS | Typecheck started; known FAIL |
| F-DEPLOY-TOPO | Deploy topology awareness | Vercel / CF / Render | UNKNOWN | No prod deploy in Stage A |

## Stage gate

- All features must leave `UNKNOWN` before Stage A acceptance.
- Stage B: **NOT STARTED**


## Progress note (2026-08-23T07:24:24Z)
- TYPECHECK PASS
- Gift combo unit qty, like batching, sender identity, QoE bitrate delta, thermal governor, PK attach path: implemented/verified
- Broad feature E2E matrix still open
