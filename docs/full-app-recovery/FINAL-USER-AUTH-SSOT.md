# Final user auth SSOT

Single source of truth for **who a person is** in UniLive / UniApplab production.

## Canonical PERSON

- **`auth.users.id` (Supabase UUID) is the canonical PERSON.**
- Application tables own rows via `user_id` / `person_id` / `owner_id` / `sender_id` / `author_id` / `profiles.id` that map to that UUID.
- **Email and username are metadata only** — never ownership FKs, never request-time identity keys, never silent merge keys across provider subjects.

## `auth_identities` aliases

- Table (production / API): `auth_identities` maps `(provider, provider_user_id) → user_id`.
- Middleware contract (`artifacts/api-server/src/middlewares/auth.ts`):
  - Supabase bearer → `auth.getUser(token)` → `req.authUser.id`
  - Firebase bearer → verified Firebase UID → **`resolveOrLinkAuthIdentity({ provider: "firebase", ... })`** → canonical `user_id`
  - Comment in middleware: *“Firebase token → verified provider subject → auth_identities → canonical user_id. Email is never used as the identity key.”*
- Distinct provider subjects that share an email are **not** auto-merged (`artifacts/api-server/src/lib/authIdentities.ts`).

## Device / session / RTC / push mappings

| Layer | Identifier | Binding |
| --- | --- | --- |
| PERSON | `auth.users.id` | Canonical actor for API (`req.authUser.id`) |
| DEVICE | installation / `device_id` (e.g. presence + push) | Survives logout; not identity |
| Session | Supabase access/refresh token (primary when configured) | Restored via `supabase.auth.getSession` / `onAuthStateChange` |
| RTC (LiveKit primary) | tokens minted with `req.authUser!.id` | `artifacts/api-server/src/routes/livekit.ts` |
| RTC (Tencent standby) | UserSig minted **only** for `req.authUser.id` (`body.userId` ignored) | `tencentRtc.ts` |
| Push | `push_devices.person_id` ← auth person; `device_id` PK | Never trust `body.personId` |

Logout / account switch must clear PERSON-scoped stores and best-effort `postPresenceOffline` (`artifacts/instacollab/src/lib/auth/authHandoff.ts`). DEVICE ids may remain.

## Presence is NOT identity authority

- Presence answers “is this person/device online recently?” with TTL.
- Backends (failover chain in `artifacts/api-server/src/routes/presence.ts`): **Upstash → Postgres (`presence_ephemeral`) → in-memory**.
- Actor for `/api/presence/online|offline` is always `req.authUser!.id`.
- Migration: `supabase/migrations/20260825120000_presence_ephemeral.sql`.

## Consumer vs Studio / developer auth

| Surface | Auth |
| --- | --- |
| Consumer app (shell) | Supabase session (primary) / Firebase mapped via `auth_identities` |
| Admin / control plane | Same bearer + `requireAdmin` / `loadAdminAuthz` on `/api/admin/**` |
| Workspace unlock | Separate workspace unlock session (`/api/workspace/*`) — not PERSON SSOT |
| Studio / local admin | Dev-local admin token only when explicitly enabled — not production consumer authority |
| Demo accounts | May sign in through real Supabase when configured (`demoCloudAuth.ts`); **local IndexedDB demo bypass is not production auth authority** |

## Current production notes (recovery)

Source-backed as of recovery docs / evidence:

- **`presence_ephemeral` is applied on production Supabase** (via authorized MCP `apply_migration`); live probes return `backend: "postgres"` with `failover: true` when Upstash is unavailable.
- **Upstash may still be quota-blocked**; durable fallback is Postgres (memory remains last resort).
- **Cloud `profile_setup_complete` is launch SSOT** — hydrates local profile/trending/legal gates on auth restore so returning users are not trapped on Profile Setup.
- Physical multi-account isolation and device media paths remain separate evidence keys (see account-switch gate).

## Related artifacts

- `docs/full-app-recovery/AUTH-API-MATRIX.json`
- `docs/full-app-recovery/DB-OWNERSHIP-MATRIX.json`
- Gates: `scripts/full-app-gates/test-user-identity-ssot.mjs`, `test-auth-boot.mjs`, `test-presence-failover.mjs`, `test-account-switch-isolation.mjs`
