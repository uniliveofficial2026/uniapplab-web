# 04 — Identity Map

Invariant: **uiUxChanged: false**

Prior: `docs/rtc-audit/IDENTITY-MAPPING.md`, `CANONICAL-IDENTITY-PROJECTION.md`, `IDENTITY-RESOLUTION-POLICY.md` (evidence).

| Layer | Identifier | Issuer / store | Format notes | Status |
|---|---|---|---|---|
| Auth principal | Supabase Auth user id | Supabase Auth | UUID | UNKNOWN |
| App profile | `profiles.id` / user_id | Postgres | expect auth-aligned | UNKNOWN |
| LiveKit identity | token `identity` | api-server / `lib/livekit` | must match auth user | UNKNOWN |
| LiveKit room name | room naming helpers | `lib/livekit` | convention TBD verify | UNKNOWN |
| Seat occupant | seat row user_id | DB | | UNKNOWN |
| Chat participant | message author id | DB / Realtime | | UNKNOWN |
| Call peer | invite payload user ids | chat + LK | | UNKNOWN |
| Admin actor | admin ACL subject | `lib/admin-access` | | UNKNOWN |
| Firebase / dual-lane | legacy uid / wallet keys | Firebase (if present) | mismatch risk — re-verify | UNKNOWN |
| Device / session | device or session keys | client / presence | | UNKNOWN |

## Resolution policy (to confirm)

| Rule | Expected | Verified |
|---|---|---|
| LiveKit identity == Auth user id | YES (candidate) | PENDING |
| No silent remap across providers | YES | PENDING |
| Token grants bound to authenticated subject | YES | PENDING |

## Gaps / risks (open)

- See `13-UNRESOLVED.md` and `AUDIT-CLAIM-REVERIFY.md` for dual-lane / Firebase claims.

## Push / notifications (2026-08-23)

| Layer | Identifier | Notes | Status |
|---|---|---|---|
| PERSON | Supabase/auth user id | Push recipient | HARDENED (local) |
| DEVICE | `unilive_device_id` | Installation id; survives logout; never person | HARDENED (local) |
| Push token | APNS / FCM token | Maps to PERSON via DEVICE binding; unique | HARDENED (local registry) |

Logout clears PERSON binding on DEVICE. Account switch reassigns DEVICE→new PERSON. Remote provider send still external.
