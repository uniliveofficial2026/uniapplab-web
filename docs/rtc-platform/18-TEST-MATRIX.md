# 18 — Test Matrix

Stage B validation is automated in `scripts/test-stage-b.mjs` (no LiveKit Cloud required).

## Unit / integration tests

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

## Run command

```bash
node scripts/test-stage-b.mjs
```

Expected: `Stage B unit suite PASS`

## Stage A regression (still required)

Visual lock, smoke suites, typecheck, wallet/gift tests — see `docs/production-hardening/10-TEST-MATRIX.md`.

## Import boundary gate

Allowed `livekit-client` import paths:

- `lib/unilives-rtc-livekit/`
- `artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts`

Offender count must **monotonically decrease** during Stage B. Current baseline: **21** outside allowed paths (22 total sites).

## Future E2E

- LiveKit Cloud room create/grant/delete (Stage A PASS)
- Dual-party call smoke with UniLiveRTC provider
- PK lifecycle with normalized webhooks feeding meter

## CI hook

MCP `run_tests({ suite: 'stage-b-unit' })` delegates to this script.
