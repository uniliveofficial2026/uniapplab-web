# Reference App

`artifacts/instacollab` is the UniLive reference application — production UI for live, calls, PK, shop, games, messaging.

## RTC facade

Primary entry: `src/lib/unilive-rtc/`

| File | Role |
|---|---|
| `index.ts` | Re-exports packages + `createReferenceRtcProvider()` |
| `callDomain.ts` | Singleton call orchestrator wrappers |
| `eventLanes.ts` | Likes/gifts via `@unilives/realtime` |

## Provider selection

```typescript
createReferenceRtcProvider({ identity, roomType, preferFake })
```

1. If `preferFake` → `@unilives/rtc-fake`
2. Else try `@unilives/rtc-livekit`
3. Catch → fake fallback (dev/tests)

## Legacy paths (migration)

Still active during Stage B:

- `src/lib/livekit/*` — publish, room bus, telemetry
- `src/lib/rtc/livekitCompatibilityBoundary.ts` — typed re-exports
- smule-rooms hooks/components with direct LiveKit room attach

**UI unchanged** — only import and join authority migrate.

## API consumption

Reference app can adopt `/v1/rtc/tokens` for grant minting; today many flows use legacy `/livekit` routes and client-side config.

## Assets

`src/lib/unilives-assets/` — stickers, gifts, brand resolution (separate from RTC platform packages).

## Smule rooms

Live room chrome (v15 approved UI), gift overlay, PK sheets, beauty/voice sheets — Stage A visual lock applies.

## Testing

Stage A smokes: live base, PK lifecycle, multiguest, shop, calls dual-party, reconnect.

Stage B: `node scripts/test-stage-b.mjs` validates orchestrators independent of UI.

## Target end state

All RTC join/publish through `createUniLiveRTC` + server grants; delete compatibility boundary and legacy livekit lib shims.
