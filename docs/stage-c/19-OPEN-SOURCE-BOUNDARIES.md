# 19 — Open Source Boundaries

Defines what belongs in reusable `@unilives/*` packages vs reference-app proprietary assets.

## Open platform packages (`lib/unilives-*`)

Intended for reuse once license decision is made (see `LICENSE-DECISION.md`):

| Package | Boundary |
|---|---|
| `@unilives/rtc-contracts` | Pure types — safest first publish candidate |
| `@unilives/rtc-core` | Domain orchestrators — no UI |
| `@unilives/rtc-client` | Client SDK |
| `@unilives/rtc-server` | Server grants/webhooks |
| `@unilives/rtc-livekit` | LiveKit adapter (optional dep) |
| `@unilives/rtc-fake` | Test double — internal/CI |
| `@unilives/rtc-qoe` | QoE logic |
| `@unilives/platform-core` | Control plane foundation |
| `@unilives/sdk` | Unified SDK |
| `@unilives/mcp`, `@unilives/cli` | Tooling |
| `@unilives/auth`, `database`, `storage`, `realtime`, `deploy`, `git`, `observe` | Capability adapters |
| `@unilives/ui` | Registry only — internal until components extracted |

**Rule**: no imports from `artifacts/instacollab` into lib packages.

## Reference app proprietary (`artifacts/instacollab`)

- Approved v15 live UI chrome and CSS
- Smule-rooms components, gift animations, sticker brand assets
- Firebase/Supabase auth integration layers (migration in progress)
- Visual baseline snapshots

Not extracted to platform packages in Stage B or Stage C bootstrap.

## Shared workspace libs (not `@unilives/*`)

| Path | Role |
|---|---|
| `lib/livekit` | Legacy token/room helpers — consumed by rtc-server adapter |
| `lib/unilives-asset-studio` | Media asset pipeline — `@workspace` scope, separate product |

## Provider SDK coupling

Allowed inside adapter packages only:

- `livekit-client` → `@unilives/rtc-livekit` (+ compatibility boundary in reference app)
- `@supabase/supabase-js` → auth/database/realtime adapters + legacy app
- `firebase` → legacy app + api-server (identity migration ongoing)

## Publishing policy (Stage C)

1. **License decision first** — no silent license inventing
2. Extract stable `@unilives/rtc-contracts` + `rtc-core` when approved
3. Keep reference app closed or separate repo
4. Document breaking changes in `23-CHANGE-LOG.md`
5. Public npm publish may be `RELEASE_READY_EXTERNAL_STEP` — not automatic at Stage C PASS

## Secrets

Never commit: `.env`, APNs keys, LiveKit API secrets, Supabase service role. Platform uses `secretRef` indirection.
