# 04 — SDK (`@unilives/sdk`)

Primary application integration entry: `createUniLive(options)`.

## Package

- Path: `lib/unilives-sdk`
- Name: `@unilives/sdk` v0.1.0 (private workspace)
- Types: `index.d.ts` ships alongside `index.mjs`

## Options

```javascript
createUniLive({
  projectId,              // required
  credentialPublicId,     // for authorize()
  controlPlane,           // optional injected store
  provider,               // UniLivesRTCProvider instance
  roomType,               // default RTC room type
})
```

## Returned surface

| Namespace | Stage B status | Stage C target |
|---|---|---|
| `rtc` | Active when `provider` passed | Wire default from registry |
| `events` / `observe` | Trace + audit + usage metrics | **IMPLEMENTED** |
| `controlPlane` | Direct store access | Postgres-backed |
| `registry` | Provider registry | **IMPLEMENTED** |
| `usageMeter` | RTC usage meter | **IMPLEMENTED** |
| `projectGraph` | App graph builder | **FOUNDATION** |
| `authorize(scope)` | Credential scope check | **IMPLEMENTED** |
| `auth` | Throws `AUTH_ADAPTER_REQUIRED` | Wire `@unilives/auth` |
| `database` | Throws `DATABASE_ADAPTER_REQUIRED` | Wire `@unilives/database` |
| `storage` | Throws `STORAGE_ADAPTER_REQUIRED` | Wire `@unilives/storage` |
| `realtime` | Throws `REALTIME_ADAPTER_REQUIRED` | Wire `@unilives/realtime` |
| `functions` | Throws `FUNCTIONS_ADAPTER_REQUIRED` | Foundation only |

## RTC usage pattern

```javascript
import { createUniLive } from '@unilives/sdk';
import { createFakeRTCProvider } from '@unilives/rtc-fake';

const app = createUniLive({
  projectId: 'proj_xxx',
  provider: createFakeRTCProvider({ identity: userId }),
  roomType: 'LIVE',
});

const room = await app.rtc.joinRoom({
  roomId, token, url, canonicalUserId: userId, role: 'host',
});
```

## Re-exports

Also exports `createControlPlaneStore`, `createProviderRegistry`, `createProjectGraph` for tooling.

## Stage C productization

- [ ] README with install + quickstart
- [ ] Wire capability adapters (remove stub throws where adapters exist)
- [ ] Semver policy documented
- [ ] Example app snippet in docs (fake provider + livekit paths)

## Reference app

Prefer `artifacts/instacollab/src/lib/unilive-rtc/` which re-exports rtc packages + `createReferenceRtcProvider()`.

## Evidence

`scripts/test-stage-b.mjs` → `control_plane_and_sdk`
