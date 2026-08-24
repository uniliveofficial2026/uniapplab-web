# 21 — Reference App

`artifacts/instacollab` is the UniLive reference application — production UI for live, calls, PK, shop, games, messaging.

## RTC facade

Primary entry: `src/lib/unilive-rtc/`

| File | Role |
|---|---|
| `index.ts` | Re-exports packages + `createReferenceRtcProvider()` |
| `callDomain.ts` | Singleton call orchestrator wrappers |
| `pkDomain.ts` | PkOrchestrator mirror for gift settle |
| `eventLanes.ts` | Likes/gifts via `@unilives/realtime` |

## Provider selection

```typescript
createReferenceRtcProvider({ identity, roomType, preferFake })
```

1. If `preferFake` → `@unilives/rtc-fake`
2. Else try `@unilives/rtc-livekit`
3. Catch → fake fallback (dev/tests)

## Stage B integration (no UI redesign)

- `connectLiveKitRoom` uses `createLiveKitRTCProvider`
- `demoCallBus` mirrors signals into `CallOrchestrator`
- Gift settle mirrors into `PkOrchestrator` via lifecycle-settle route
- `livekit-client` static imports: only `livekitCompatibilityBoundary.ts` (+ dynamic import in adapter)

## Legacy paths (migration — Stage C continues)

Still active:

- `src/lib/livekit/*` — publish, room bus, telemetry
- `src/lib/rtc/livekitCompatibilityBoundary.ts` — typed re-exports
- smule-rooms hooks/components with direct LiveKit room attach
- `hostLiveKitRoom` via compatibility boundary (interim attach path)

**UI unchanged** — only import path and join authority migrate.

## API consumption

Reference app can adopt `/v1/rtc/tokens` for grant minting; today many flows use legacy `/livekit` routes and client-side config.

## Assets

`src/lib/unilives-assets/` — stickers, gifts, brand resolution (separate from RTC platform packages).

## Smule rooms

Live room chrome (v15 approved UI), gift overlay, PK sheets, beauty/voice sheets — Stage A visual lock applies.

## Testing

| Suite | Scope |
|---|---|
| Stage A smokes | live base, PK lifecycle, multiguest, shop, calls dual-party, reconnect |
| Stage B unit | `node scripts/test-stage-b.mjs` — orchestrators independent of UI |
| Visual lock | 22/22 baselines |

## Target end state (Stage C)

All RTC join/publish through `createUniLiveRTC` + server grants; delete compatibility boundary and legacy livekit lib shims when import scan hits zero offenders outside allowlist.

## Classification

Reference app remains **proprietary** — not published as `@unilives/*`. See `19-OPEN-SOURCE-BOUNDARIES.md`.
