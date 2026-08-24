# 00 — Stage C Baseline

| Field | Value |
|---|---|
| Stage A acceptance | **PASS** at SHA `4786a68` |
| Stage B acceptance | **PASS (sealed)** at SHA `fb94caf` |
| Stage B implementation | `a6b2e43faac6c137fd899e4b3f64120e196ef79b` |
| Stage C | **STARTED** — bootstrap slice |
| Branch | `stage-c/unilives-platform` |
| Worktree | `/Volumes/Wei2TB/Universal-Fixer-Stage-C` |
| Parent repo worktree | `/Volumes/Wei2TB/Universal-Fixer` (shares `fb94caf` HEAD) |
| UI lock | **LOCKED** — `uiUxChanged: false`; no redesign during Stage C |
| Production RTC API | **UniLiveRTC** (`@unilives/rtc-*`) |
| Production media provider | **LiveKit** (via `@unilives/rtc-livekit`) |
| Production RTC cutover | **NOT_PERFORMED** (carried forward from Stage B) |

## Stage A outcome (frozen)

Stage A validated live/call/PK/gift/commerce flows against the existing LiveKit-backed product without UI changes. Visual lock (22/22), typecheck, smoke suites, and provider room lifecycle tests passed. Native CallKit/PushKit device QA remains an accepted external blocker.

Evidence: `docs/production-hardening/`, frozen at `4786a68`.

## Stage B outcome (sealed)

Stage B delivered a **provider-neutral UniLiveRTC foundation** and **UniLive developer platform packages** under `lib/unilives-*`:

- RTC contracts, orchestrators (call/live/seat/PK), client/server, LiveKit adapter, fake provider, QoE
- Platform control plane, SDK, MCP, CLI, capability boundaries (auth/database/storage/realtime/deploy/git/observe/ui)
- `/api/v1/*` platform API mounted in `artifacts/api-server/src/routes/uniliveV1.ts`
- Reference app facade at `artifacts/instacollab/src/lib/unilive-rtc/` — **no UI redesign**
- `scripts/test-stage-b.mjs` — **16/16 PASS**; CI gate in `.github/workflows/ci.yml`

Evidence: `docs/rtc-platform/FINAL-STAGE-B-REPORT.md`, `docs/rtc-platform/FINAL-STAGE-B-STATUS.json`.

## Stage C mission

Stage C **productizes** the Stage B foundation into a coherent external developer platform:

1. **Package readiness** — classify, document, and harden each `@unilives/*` package for reuse (see `02-PACKAGE-MAP.md`).
2. **Public API stability** — stabilize `/v1/*` shapes, auth middleware, and SDK parity.
3. **Reference app migration** — complete UniLiveRTC attach path; monotonically reduce `livekit-client` import offenders.
4. **Persistence** — Postgres control plane adapter (replacing in-memory store).
5. **License + publish path** — explicit license decision before any public npm publish (see `LICENSE-DECISION.md`, `24-UNRESOLVED.md`).
6. **UI lock held** — platform work is backend/facade/tooling only.

## Invariants (carry forward)

- No UI/UX redesign (`uiUxChanged: false`).
- Canonical user identity is UniLive truth; provider identity is a mapping.
- Gift/PK scores from **authoritative settled events** only.
- Call domain states preserve Stage A lifecycle (including stale-accept guard).
- `livekit-client` imports only in `@unilives/rtc-livekit` + `livekitCompatibilityBoundary.ts`.

## Validation baseline (must stay green)

```bash
node scripts/test-stage-b.mjs          # Stage B unit suite — 16/16 PASS
pnpm run test:stage-b                  # CI equivalent
```

Stage A regression suites remain required on every Stage C slice that touches RTC, gifts, calls, or PK.

## Related documentation

| Location | Scope |
|---|---|
| `docs/stage-c/` | Stage C productization (this set) |
| `docs/rtc-platform/` | Stage B RTC specs (sealed reference) |
| `docs/platform/` | Platform architecture (Stage B) |
| `docs/production-hardening/` | Stage A acceptance evidence |
