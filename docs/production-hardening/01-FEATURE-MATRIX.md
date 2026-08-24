# 01 — Feature Matrix (Stage A)

Status legend: `UNKNOWN` | `IN_PROGRESS` | `PASS` | `FAIL` | `N/A` | `BLOCKED_EXTERNAL`

Updated: 2026-08-24T04:26:30Z · uiUxChanged: false · Stage B locked

| ID | Feature | Primary surfaces | Status | Evidence / notes |
|---|---|---|---|---|
| F-AUTH | Auth / session | instacollab + Supabase Auth | PASS | Dev-local + cloud auth; multi-device isolation smoke |
| F-IDENTITY | Identity projection (user ↔ provider ids) | lib + api-server + LiveKit | PASS | PERSON/DEVICE/SESSION contracts; push person-from-auth |
| F-LIVE | Live room join / publish / subscribe | instacollab + LiveKit + api-server | PASS | Solo/multiguest/shop chrome smokes; LiveKit room create/grant/delete |
| F-CAMERA | Camera / mic capture | instacollab | PASS | Live go-live + PK dual camera chrome; CallKit fail-closed |
| F-BEAUTY | Beauty / AR pipeline | instacollab | PASS | beauty chrome smoke + beauty-slo + thermal cadence units |
| F-SEATS | Multiguest / seats | api-server + DB + LiveKit data | PASS | multiguest chrome smoke + seat stage-a units |
| F-PK | PK battles | api-server + LiveKit + DB | PASS | lifecycle round1+2, reconnect, gift score idempotent |
| F-GIFTS | Gift send / settle / FX | api-server + DB + LiveKit | PASS | gift scheduler 13 + storm + lifecycle settle |
| F-WALLET | Wallet balance / earnings | api-server + DB | PASS | wallet authority + commerce settle RPC |
| F-LIKES | Live likes | LiveKit data (ephemeral) | PASS | loss-tolerant batch + thermal particle cap contracts |
| F-CHAT-ROOM | Live comments | Supabase Realtime + DB | PASS | PK/live chrome comments surface; messages mount |
| F-CHAT-DM | DMs / cloud chat | Supabase + chat paths | PASS | messages mount + multi-device isolation |
| F-TYPING | Typing indicators | Presence / chat-ws | PASS | covered under messages isolation (no redesign) |
| F-PRESENCE | App + room presence | api-server + Realtime | PASS | multi-device + live host discovery |
| F-CALL | 1:1 / chat calls | LiveKit + chat signaling | PASS | dual-party demo bus + reconnect + unit lifecycle matrix |
| F-GAME | Live arcade / game bus | LiveKit data | PASS | games lifecycle smoke + media-games cleanup contracts |
| F-MEDIA-CDN | Media CDN / R2 assets | workers/uniapplab-media | PASS | Cloudflare worker mapped (presign/upload/CORS) |
| F-ADMIN | Admin config surfaces | admin-panel | PASS | workspace unlock remote + admin-embed mount |
| F-PUSH | Push DEVICE↔PERSON registry | api-server + push_devices | PASS | remote ownership switch/multi-device; FCM topic healthcheck |
| F-MARKET | Marketplace / commerce | Shell + ledger | PASS | mount + Buy flow smoke; ledger separation units |
| F-NATIVE-INCOMING | CallKit / Android FGS | iOS/Android | BLOCKED_EXTERNAL | FEATURE_ENABLED=false; devices Offline; no VoIP cert |
| F-APNS | APNS provider send | Apple push | BLOCKED_EXTERNAL | key/cert absent after exhaust |
| F-DEPLOY-TOPO | Deploy topology awareness | Vercel / CF / Render | N/A | No prod deploy in Stage A |

## Stage A exit rule
- No in-scope `UNKNOWN` remains (BLOCKED_EXTERNAL + N/A allowed with evidence).
- uiUxChanged must remain false.
