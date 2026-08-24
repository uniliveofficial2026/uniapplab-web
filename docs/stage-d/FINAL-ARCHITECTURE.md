# FINAL Architecture — Stage D

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  InstaCollab production app (unchanged visuals)         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  @unilives/sdk · @unilives/ui · @unilives/rtc-*         │
│  UniLiveRTC → LiveKit (production media)                │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Stage D platform services (library MVP)                │
│  cloud · marketplace · ai-builder · selfhost · release  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Stage B/C foundations                                  │
│  platform-core · deploy · project-graph · builder · cli │
└─────────────────────────────────────────────────────────┘
```

## Managed cloud MVP

In-process control plane — not a deployed multi-tenant cluster. Bridges to `@unilives/platform-core` for project creation.

## Self-host reference

Docker compose single-node: Postgres, auth, realtime, storage, API, MCP, studio, LiveKit, observability. TLS via external reverse proxy.

## Data persistence

| Component | Persistence |
| --- | --- |
| Cloud MVP | In-memory (tests) |
| Self-host | Local `dataDir` + postgres fixture |
| Production app | Unchanged (Supabase/etc.) |
