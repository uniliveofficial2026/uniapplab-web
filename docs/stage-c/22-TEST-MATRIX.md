# 22 — Test Matrix (Stage C)

Stage C inherits all Stage B and Stage A gates and adds productization acceptance tests as slices land.

## Stage B unit suite (required — must stay green)

Script: `scripts/test-stage-b.mjs` (no LiveKit Cloud required)

| Test | Validates |
|---|---|
| `fake_provider_join_publish` | Client join, publish, leave |
| `provider_unavailable_does_not_destroy_business_state` | Call state survives RTC failure |
| `call_orchestrator_stale_accept_and_dedupe` | Stage A call guards |
| `pk_gift_score_idempotent` | Gift dedupe + scoring |
| `seat_orchestrator_accept` | Seat permissions |
| `qoe_hysteresis_and_profiles` | QoE governor + thermal profile |
| `rtc_grant_permissions` | Role → permissions |
| `webhook_normalization_idempotent_id` | Event id format |
| `usage_meter_idempotent` | Meter dedupe |
| `control_plane_and_sdk` | SDK + graph + trace |
| `mcp_requires_auth` | MCP credential gate |
| `cli_doctor_and_rtc_status` | CLI probes |
| `auth_memory_and_realtime_lanes` | Auth + realtime lanes |
| `deploy_git_registry` | Deploy + git + registry |
| `live_runtime_end_to_end_fake` | Live orchestrator E2E |
| `livekit_import_boundary_scan` | Boundary file exists; counts offenders |

```bash
node scripts/test-stage-b.mjs
# Expected: Stage B unit suite PASS
pnpm run test:stage-b   # CI equivalent
```

## Stage A regression (required on RTC/gift/call/PK touches)

| Suite | Expected |
|---|---|
| Gift playback scheduler | 13/13 |
| Visual regression lock | 22/22 |
| Call lifecycle state | 4/4 |
| PK team topology | 6/6 |
| PK seat Stage A | 6/6 |
| Wallet authority | 7/7 |
| API live PK challenge | 16/16 |

Evidence: `docs/production-hardening/10-TEST-MATRIX.md`

## Import boundary gate

Allowed `livekit-client` import paths:

- `lib/unilives-rtc-livekit/`
- `artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts`

Offender count must **monotonically decrease** during Stage C. Stage B sealed baseline: **1** site (adapter+boundary only) per `FINAL-STAGE-B-STATUS.json`.

## Stage C additions (planned — not yet implemented)

| Gate | Description | Status |
|---|---|---|
| Package README lint | Each `@unilives/*` has README + exports audit | **NOT STARTED** |
| Postgres control plane | Persistence adapter integration test | **NOT STARTED** |
| SDK adapter wiring | auth/database/storage/realtime no longer throw | **NOT STARTED** |
| API auth middleware | Mutating `/v1/*` reject unscoped credentials | **NOT STARTED** |
| Reference app attach E2E | Join/publish via `createUniLiveRTC` in smoke | **NOT STARTED** |
| License file presence | SPDX in publishable packages after decision | **BLOCKED** on license |

## CI hooks

- `.github/workflows/ci.yml` — `pnpm run test:stage-b`
- MCP `run_tests({ suite: 'stage-b-unit' })` delegates to Stage B script

## Future E2E (post–Stage C bootstrap)

- LiveKit Cloud room create/grant/delete (Stage A PASS path)
- Dual-party call smoke with UniLiveRTC provider end-to-end
- PK lifecycle with normalized webhooks feeding meter in production config
