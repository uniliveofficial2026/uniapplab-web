# Final Provider Qualification (Stage B)

**Status:** PASS (foundation) · **Production cutover:** NOT_PERFORMED

## Qualified providers

| Provider | Package / path | Production | Qualification evidence |
|---|---|---|---|
| **LiveKit** | `@unilives/rtc-livekit` | **Yes** (underlying media) | Adapter implements full contract; boundary scan PASS; `connectLiveKitRoom` uses provider |
| **Fake RTC** | `@unilives/rtc-fake` | No (CI/dev only) | Full Stage B test suite without cloud |
| **Cloudflare Realtime** | `lib/unilives-rtc-livekit/cloudflareQualification.mjs` | **No** (lab only) | Probe adapter; throws on production connect |

## LiveKit qualification matrix

| Criterion | Result |
|---|---|
| Implements `UniLivesRTCProvider` | Yes — `createLiveKitRTCProvider` |
| Grants + token join path | Yes — via `@unilives/rtc-server` |
| Webhook normalization | Yes — `normalizeProviderWebhook({ provider: 'livekit', ... })` |
| QoE stats feed | Yes — `getStats` mapped to governor |
| Import isolation | Yes — dynamic import in adapter only |
| Stage B unit tests | PASS (16/16) |
| Stage A regression | PASS (this session) |

## Fake provider qualification

Proves **provider independence** for domain logic:

- Call stale-accept + dedupe without SFU
- PK gift idempotency without SFU
- Seat accept without SFU
- Provider unavailable does not destroy call state
- MCP/CLI room probes

```bash
node scripts/test-stage-b.mjs
# Stage B unit suite PASS — no LiveKit Cloud required
```

## Cloudflare Realtime (non-production)

`cloudflareQualification.mjs`:

- `production: false`
- `probe()` returns `qualified_lab_only` when forced available
- `connect()` throws `CF_REALTIME_LAB_ONLY`
- Does **not** dual-publish production video
- Does **not** switch production SFU

Future qualification path: implement `UniLivesRTCProvider` behind same contracts as LiveKit adapter, run identical test matrix, owner approval for cutover.

## Self-host LiveKit

Architecture documented in `docs/platform/OPEN-SOURCE-BOUNDARIES.md` and `16-SELF-HOST-READINESS.md`. Stage B validates contract swap via Fake provider; docker compose stack is **FOUNDATION_READY** (CLI `start` note only).

## Explicitly not qualified for production

| Provider | Reason |
|---|---|
| Cloudflare Realtime | Lab probe only |
| Fake RTC | Test double |
| Alternate SFU (Agora, etc.) | Not implemented |

## Cutover policy

| Gate | Value |
|---|---|
| `productionRtcApi` | UniLiveRTC |
| `productionMediaProvider` | LiveKit |
| `productionRtcCutover` | NOT_PERFORMED |
| `productionMediaProviderCutover` | NOT_REQUIRED_FOR_STAGE_B |

Stage B acceptance does not require swapping LiveKit for another SFU in production.

## Evidence

- `scripts/test-stage-b.mjs` — provider independence + LiveKit boundary
- `lib/unilives-rtc-livekit/cloudflareQualification.mjs` — lab adapter source
- Stage A PK/call/seat regressions — see `FINAL-STAGE-B-REPORT.md`
