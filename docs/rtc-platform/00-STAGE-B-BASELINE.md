# 00 — Stage B Baseline

| Field | Value |
|---|---|
| Stage A acceptance | **PASS** at SHA `4786a68` |
| Stage B | **STARTED** (documentation + package foundation) |
| Branch | `fix/vercel-api-root-now` |
| UI lock | **LOCKED** — `uiUxChanged: false`; no redesign during Stage B |
| Production RTC cutover | **NOT PERFORMED** |
| Reference app facade | `artifacts/instacollab/src/lib/unilive-rtc/` |
| Platform API | `artifacts/api-server/src/routes/uniliveV1.ts` (`/v1/*`) |

## Stage A outcome (frozen)

Stage A validated live/call/PK/gift/commerce flows against the existing LiveKit-backed product without UI changes. Visual lock (22/22), typecheck, smoke suites, and provider room lifecycle tests passed. Native CallKit/PushKit device QA remains an accepted external blocker.

## Stage B mission

Stage B introduces a **provider-neutral UniLiveRTC layer** under `lib/unilives-*` so business logic (calls, PK, seats, gifts, metering) no longer depends on LiveKit types or direct `livekit-client` imports.

Goals:

1. **Contracts first** — `@unilives/rtc-contracts` defines room types, grants, events, and the `UniLivesRTCProvider` interface.
2. **Orchestrators in core** — `@unilives/rtc-core` owns call/PK/seat/live/room domain state.
3. **Adapter isolation** — `@unilives/rtc-livekit` is the only package that imports `livekit-client` for media transport.
4. **Migration boundary** — `livekitCompatibilityBoundary.ts` documents interim re-exports while product modules migrate.
5. **Platform surface** — `/v1/*` API, SDK, MCP, and CLI share the same control-plane contracts.
6. **Honest acceptance** — many items are **IMPLEMENTED foundation**; full import migration and production cutover remain in progress.

## Package map

| Package | Role |
|---|---|
| `@unilives/rtc-contracts` | Types, roles, permissions, event envelopes |
| `@unilives/rtc-core` | Orchestrators + runtime factory |
| `@unilives/rtc-client` | Public client (`createUniLiveRTC`) |
| `@unilives/rtc-server` | Grants, token minting, webhook normalization |
| `@unilives/rtc-livekit` | LiveKit media adapter |
| `@unilives/rtc-fake` | In-memory provider for tests |
| `@unilives/rtc-qoe` | QoE governor + publish profiles |
| `@unilives/platform-core` | Control plane, registry, usage meter |
| `@unilives/sdk` | Unified SDK facade |
| `@unilives/mcp` / `@unilives/cli` | Agent + developer surfaces |

## Validation

- Stage B unit suite: `node scripts/test-stage-b.mjs` — **PASS** at `4786a68`
- LiveKit import scan: 22 import sites; 21 still outside adapter+boundary (migration in progress)

## Invariants (carry forward from Stage A)

- No UI/UX redesign.
- Canonical user identity is UniLive truth; provider identity is a mapping.
- Gift/PK scores from **authoritative settled events** only.
- Call domain states preserve Stage A lifecycle (including stale-accept guard).
