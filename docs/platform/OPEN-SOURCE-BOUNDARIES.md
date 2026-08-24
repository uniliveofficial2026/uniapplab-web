# Open Source Boundaries

Defines what belongs in reusable `@unilives/*` packages vs reference-app proprietary assets.

## Open platform packages (`lib/unilives-*`)

Intended for reuse, MIT or workspace license per package.json:

| Package | Boundary |
|---|---|
| `@unilives/rtc-contracts` | Pure types — safe to publish |
| `@unilives/rtc-core` | Domain orchestrators — no UI |
| `@unilives/rtc-client` | Client SDK |
| `@unilives/rtc-server` | Server grants/webhooks |
| `@unilives/rtc-livekit` | LiveKit adapter (optional dep) |
| `@unilives/rtc-fake` | Test double |
| `@unilives/rtc-qoe` | QoE logic |
| `@unilives/platform-core` | Control plane foundation |
| `@unilives/sdk` | Unified SDK |
| `@unilives/mcp`, `@unilives/cli` | Tooling |
| `@unilives/auth`, `database`, `storage`, `realtime`, `deploy`, `git` | Capability adapters |

**Rule**: no imports from `artifacts/instacollab` into lib packages.

## Reference app proprietary (`artifacts/instacollab`)

- Approved v15 live UI chrome and CSS
- Smule-rooms components, gift animations, sticker brand assets
- Firebase/Supabase auth integration layers (migration in progress)
- Visual baseline snapshots

Not extracted to platform packages in Stage B.

## Shared workspace libs

| Path | Role |
|---|---|
| `lib/livekit` | Legacy token/room helpers — consumed by rtc-server adapter |
| `lib/unilives-asset-studio` | Media asset pipeline — separate product |

## Documentation

- `docs/rtc-platform/` — RTC Stage B specs (this effort)
- `docs/platform/` — Platform architecture
- `docs/production-hardening/` — Stage A acceptance evidence
- `docs/rtc-audit/` — Prior audit (re-verify claims)

## Provider SDK coupling

Allowed inside adapter packages only:

- `livekit-client` → `@unilives/rtc-livekit`
- `@supabase/supabase-js` → auth/database/realtime adapters + legacy app
- `firebase` → legacy app + api-server (identity migration ongoing)

## Publishing policy (future)

1. Extract stable `@unilives/rtc-contracts` + `rtc-core` first
2. Keep reference app closed or separate repo
3. Document breaking changes in `docs/rtc-platform/19-CHANGE-LOG.md`

## Secrets

Never commit: `.env`, APNs keys, LiveKit API secrets, Supabase service role. Platform uses `secretRef` indirection.
