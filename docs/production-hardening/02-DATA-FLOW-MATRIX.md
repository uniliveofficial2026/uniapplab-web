# 02 — Data Flow Matrix (skeleton)

Invariant: **uiUxChanged: false**

Fill cells during Stage A verification. Prior flows in `docs/rtc-audit/` are evidence only.

| Feature | Client entry | Transport | Server / edge | Durable store | Ephemeral | Conflict risk | Status |
|---|---|---|---|---|---|---|---|
| F-AUTH | — | — | — | — | — | — | UNKNOWN |
| F-IDENTITY | — | — | — | — | — | — | UNKNOWN |
| F-LIVE | — | LiveKit SFU | api-server tokens | room rows | LK roster | — | UNKNOWN |
| F-CAMERA | — | local media | — | — | tracks | — | UNKNOWN |
| F-BEAUTY | — | local pipeline | — | device prefs | — | — | UNKNOWN |
| F-SEATS | — | LK data + REST | api-server | seats tables | bus | seats vs LK | UNKNOWN |
| F-PK | — | LK data + REST | api-server | pk sessions | bus | — | UNKNOWN |
| F-GIFTS | — | REST + LK data | settle RPC | wallet / gifts | FX bus | dual-lane? | UNKNOWN |
| F-WALLET | — | REST | api-server | wallet tables | optimistic UI | — | UNKNOWN |
| F-LIKES | — | LK data | — | none | memory | lost on reconnect | UNKNOWN |
| F-CHAT-ROOM | — | SB Realtime | — | messages | — | — | UNKNOWN |
| F-CHAT-DM | — | SB Realtime | — | chat tables | — | — | UNKNOWN |
| F-TYPING | — | Presence / chat-ws | chat-ws | none | presence | dual path? | UNKNOWN |
| F-PRESENCE | — | HTTP + SB Presence | api-server | soft counts | presence | multi-source | UNKNOWN |
| F-CALL | — | chat + LiveKit | api-server | invites | media room | — | UNKNOWN |
| F-GAME | — | LK data (+ external SO for casino) | mixed | soft / session | bus | — | UNKNOWN |
| F-MEDIA-CDN | — | HTTPS | CF Worker + R2 | R2 objects | CDN cache | — | UNKNOWN |

## Cross-cutting

| Concern | Status |
|---|---|
| Idempotency keys / envelope ids | UNKNOWN |
| Reconnect / replay policy | UNKNOWN |
| Dual-write / dual-lane (esp. gifts) | UNKNOWN — re-verify audit claims |
