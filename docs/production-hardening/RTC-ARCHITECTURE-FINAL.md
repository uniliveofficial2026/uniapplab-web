# RTC-ARCHITECTURE-FINAL

**Stage B status:** NOT STARTED (Stage A gate not passed).

Current production media path remains:

```
Feature → LiveKit SDK (direct) → LiveKit SFU
```

Stage A prepared provider-neutral foundations without migrating features:

- `roomTopologyPolicy` (LIVE / MULTI_GUEST / PK / CALL_* caps)
- `networkQoEGovernor` + publish profile resolver
- `realtimeReplayPolicy`
- `callLifecycleState` mapping
- LiveKit ensureRoom topology-aware `maxParticipants`

Target Stage B shape (deferred):

```
Feature → UniLiveRTC → LiveKitRTCProvider → LiveKit
```

Packages `@unilives/rtc-*` were **not** created in this pass.
