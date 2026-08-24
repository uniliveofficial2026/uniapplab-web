# 05 — Realtime Matrix

Invariant: **uiUxChanged: false**

Prior: `docs/rtc-audit/REALTIME-TRANSPORT-MATRIX.md` (evidence).

| Feature | Transport | Server | Durable? | Reconnect | Dup protection | Status |
|---|---|---|---|---|---|---|
| Live comments | Supabase Realtime | Postgres changes | Yes | PENDING | PENDING | UNKNOWN |
| DMs | Supabase Realtime | chat tables | Yes | PENDING | PENDING | UNKNOWN |
| App presence | HTTP heartbeat | api-server | Ephemeral | PENDING | PENDING | UNKNOWN |
| Room presence | SB Presence | Realtime channel | Ephemeral | PENDING | PENDING | UNKNOWN |
| Typing | SB Presence (+ chat-ws) | Presence / chat-ws | Ephemeral | PENDING | PENDING | UNKNOWN |
| Viewer count | mixed (presence / DB / LK) | mixed | Soft | PENDING | PENDING | UNKNOWN |
| PK invite/score | LK data + REST | api + DB | Yes (sync) | PENDING | PENDING | UNKNOWN |
| Gift FX | LK data + sync | SB + LK | money yes / FX soft | PENDING | PENDING | UNKNOWN |
| Likes | LK data only | — | No | PENDING | PENDING | UNKNOWN |
| Seats | LK data + sync + DB | api + SB | Yes | PENDING | PENDING | UNKNOWN |
| Call signaling | chat invites + LK media | chat + LK | Partial | PENDING | PENDING | UNKNOWN |
| Game (arcade) | LK data bus | LK + sync | Soft | PENDING | PENDING | UNKNOWN |
| Greedy casino | Socket.IO (external) | Render (audit) | Session | PENDING | PENDING | UNKNOWN |

## chat-ws

| Item | Status |
|---|---|
| Deployed / reachable | UNKNOWN |
| Role vs Supabase Presence for typing | UNKNOWN — re-verify |
| Auth on WS | UNKNOWN |
