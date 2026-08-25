# FINAL RTC MAP

```
Feature/UI
  → UniLiveRTC (contracts + client)
    → LiveKitRTCProvider (@unilives/rtc-livekit)
      → LiveKit Cloud

Compatibility bridge only:
  artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts
```

Production health asserts:
- `productionRtcApi: UniLiveRTC`
- `productionMediaProvider: LiveKit`

CI: `scripts/real-device-mapping-gate.mjs` + Stage B LiveKit import allowlist.
