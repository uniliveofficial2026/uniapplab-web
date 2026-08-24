# 02 — Data Flow Matrix (Stage A)

Invariant: **uiUxChanged: false**

Updated: 2026-08-24T04:26:30Z

| Feature | Client entry | Transport | Server / edge | Durable store | Ephemeral | Conflict risk | Status |
|---|---|---|---|---|---|---|---|
| F-AUTH | login / force_demo | HTTPS | Supabase Auth / Firebase | auth.users + identities | session | email never identity key | PASS |
| F-IDENTITY | PERSON/DEVICE/SESSION | HTTPS | api-server | profiles / push_devices | — | DEVICE≠PERSON | PASS |
| F-LIVE | Room / InstantRoom | LiveKit SFU | api-server tokens + lifecycle | room rows | LK roster | topology capacity policy | PASS |
| F-CAMERA | getUserMedia | local media | — | — | tracks | thermal does not reset beauty | PASS |
| F-BEAUTY | beauty sheet | local WebAR/DeepAR | — | device prefs | perception cadence | thermal slows FPS not settings | PASS |
| F-SEATS | multiguest chrome | LK data + REST | api-server | seats tables | bus | seat auth server-side | PASS |
| F-PK | PkLiveOverlay | REST challenges + LK | LiveLifecycleService | pk sessions (in-mem + dash) | bus | gift score idempotent | PASS |
| F-GIFTS | gift panel | REST settle + LK data | gifts + lifecycle settle | gift_transactions | FX FIFO | paid FX needs settlement id | PASS |
| F-WALLET | wallet UI | REST | wallet RPCs | wallets / ledger | optimistic UI | gift≠commerce lanes | PASS |
| F-LIKES | like button | LK publishData | — | none | batch 120ms | loss-tolerant | PASS |
| F-CHAT-ROOM | live comments | SB Realtime | — | messages | — | — | PASS |
| F-CHAT-DM | Messages | SB Realtime | chat routes | chat tables | outbox | multi-device isolation | PASS |
| F-TYPING | composer | Presence / chat-ws | chat-ws | none | presence | — | PASS |
| F-PRESENCE | shell / live | HTTP + SB Presence | api-server | soft counts | presence | — | PASS |
| F-CALL | Messages call | demo bus / LiveKit | api-server tokens | history | media room | reconnect same session | PASS |
| F-GAME | games panel | LK data (+ game iframe) | mixed | soft / session | bus | cleanup on close | PASS |
| F-MEDIA-CDN | uploads / assets | HTTPS | CF Worker + R2 | R2 objects | CDN cache | signed upload | PASS |
| F-PUSH | register token | HTTPS | `/api/push/*` | push_devices | — | person from auth only | PASS |
| F-MARKET | Marketplace modal | HTTPS / local demo | commerce settle RPC | commerce orders | — | gift diamonds ≠ commerce | PASS |

## Cross-cutting

| Concern | Status |
|---|---|
| Idempotency keys / envelope ids | PASS (gift clientRequestId, PK score eventId) |
| Reconnect / replay policy | PASS (PK + calls reconnect smokes; ACTIVE_FX expiry) |
| Dual-write / dual-lane (esp. gifts) | PASS (ledger separation contracts; commerce settle RPC) |
