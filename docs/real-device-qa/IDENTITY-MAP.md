# UniLive Identity Map

**Base SHA:** `9e8c44a`  
**Source of truth:** `artifacts/instacollab/src/lib/identity/canonicalIdentity.ts`  
**Push binding:** `lib/push/pushDeviceRegistry.ts`, `pushDeviceLifecycle.ts`

---

## Layers

| Layer | What it is | Must not be |
|-------|------------|-------------|
| **PERSON** | Application / Supabase auth user id — business primary key | Device id, LiveKit SID, push token |
| **DEVICE** | Install id (`unilive_device_id`) — one physical install | PERSON |
| **APP_SESSION** | Signed-in browser/app session | RTC connection |
| **ROOM_SESSION** | Party / live / call room session id | PERSON |
| **RTC_PARTICIPANT_SESSION** | LiveKit participant SID (`PA_…`) — ephemeral connection | PERSON / durable identity |

Provider IDs (Firebase UID, LiveKit identity string, APNS/FCM token) are **aliases/projections**, not the person PK.

---

## PERSON

- Canonical: auth user id (`asPersonId`)
- Business writes (gifts, chat, wallet, profiles) key off PERSON
- Hidden admin watchers: identity prefix `aw_` — not roster people (`isHiddenWatcherIdentity`)

---

## DEVICE

- Local install id stored for push lifecycle
- One APNS/FCM token maps to at most one PERSON (token move reassigns)
- Survives logout preferences carefully; PERSON-scoped keys cleared on logout

---

## APP_SESSION

- Signed-in shell session + launch funnel flags (`splashSession`, auth handoff)
- Clearance reasons: `logout` | `account_switch` | `session_expired` | `reinstall`
- Clear prefixes: `unilives.auth.`, `unilives.session.`, `unilives.wallet.`, `ic.auth.`, `ic.session.`, `sb-`, `unilive.push.person.`

---

## RTC room vs participant

| Concept | Example | Notes |
|---------|---------|-------|
| RTC room name | Stream id, party room id, `ic-chat-call-*` | Token grant roomName from `/api/livekit/*` |
| Participant **identity** | Prefer PERSON / `user_id` | Bus trusts `participant.identity` over claimed sender |
| Participant **SID** | `PA_…` | `isLiveKitParticipantSid` → **not** PERSON |
| `personIdFromRtcIdentity` | identity → person or null | Rejects watcher aliases and SIDs |

---

## Push tokens vs PERSON

| Token type | Platform enum | Binding |
|------------|---------------|---------|
| APNS | `apns` | DEVICE → PERSON via `push_devices` |
| FCM | `fcm` | DEVICE → PERSON |
| Web Push | `web_push` | Session/device |

API: `/api/push/{register,clear-person,devices}` → table `push_devices`.

---

## QA checks

1. After logout, PERSON-scoped storage gone; DEVICE id may remain.
2. LiveKit SID never used as gift sender / wallet owner.
3. Two devices same PERSON: separate DEVICE rows, shared PERSON wallets/chat.
4. Account switch clears prior PERSON push binding appropriately.
