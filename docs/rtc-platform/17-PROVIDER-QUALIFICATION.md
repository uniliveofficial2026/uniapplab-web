# 17 — Provider Qualification

Before a media provider is marked **active** in the registry, it must pass qualification gates.

## RTC provider checklist

| Gate | Requirement |
|---|---|
| Contract | Full `UniLivesRTCProvider` implementation |
| Join/leave | Stable session + participant mapping |
| Publish | Camera + mic tracks with replace/unpublish |
| Data lanes | Reliable + loss-tolerant send |
| Stats | `getStats` returns usable QoE inputs |
| Connection | State machine maps to `RtcConnectionState` |
| Webhooks | Normalization mapping documented |
| Token mint | Server grant → provider JWT path |
| Tests | Stage B matrix cases pass with adapter |
| No leak | Zero provider types in contracts/core/client |

## LiveKit (current active)

- Adapter: `@unilives/rtc-livekit`
- Server SDK: `@workspace/livekit`, `livekit-server-sdk` in legacy routes
- Status: **qualified for production media**; client import migration incomplete in reference app

## Fake provider (CI)

- `@unilives/rtc-fake` — qualified for **business logic and MCP** only, not production media

## Non-RTC providers

| Kind | Qualification |
|---|---|
| auth | Maps to canonicalUserId; session refresh |
| database | Query health; no Supabase id in public API |
| storage | Upload/download/signedUrl via driver |
| deploy | Records git SHA lifecycle |

## Promotion process

1. Implement adapter package under `lib/unilives-*`
2. Register in `createProviderRegistry()`
3. Run `scripts/test-stage-b.mjs` + provider-specific integration
4. Update `PROVIDER-COUPLING-MANIFEST.md`
5. Owner sign-off before `productionRtcCutover`

## Disqualifiers

- Direct `livekit-client` import outside allowed paths
- Business logic branching on provider-specific event shapes
- Client-side grant minting for elevated roles
