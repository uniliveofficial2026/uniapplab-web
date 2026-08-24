# 07 — Database Matrix

Invariant: **uiUxChanged: false**

Surfaces: `lib/db`, `supabase/` (+ instacollab supabase copies). Prior audit classification is evidence only.

| Domain | Tables / RPCs (candidate) | RLS | Writers | Readers | Status |
|---|---|---|---|---|---|
| Profiles | `profiles` | PENDING | auth/app | app | UNKNOWN |
| Streams / rooms | stream / party tables | PENDING | api / host | app | UNKNOWN |
| Seats | seats / sync | PENDING | api | app + Realtime | UNKNOWN |
| PK | `live_pk_sessions` (+ related) | PENDING | api | app | UNKNOWN |
| Gifts | gift tables + `settle_gift_send` | PENDING | api RPC | app | UNKNOWN |
| Wallet | wallet tables / RPCs | PENDING | api RPC | app | UNKNOWN |
| Live comments | party_room_messages (candidate) | PENDING | app/api | Realtime | UNKNOWN |
| Chat / DMs | chat message tables | PENDING | app | Realtime | UNKNOWN |
| Presence counts | soft counters | PENDING | api | discovery | UNKNOWN |
| Media metadata | asset metadata | PENDING | workers/api | CDN/app | UNKNOWN |

## Migrations / integrity

| Check | Status |
|---|---|
| Migration chain reviewed | NOT STARTED |
| Dual schema trees reconciled (root vs artifacts) | UNKNOWN |
| RLS vs service-role usage mapped | NOT STARTED |
| Destructive migration in Stage A | **FORBIDDEN** |
