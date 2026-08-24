# SDK Architecture

`@unilives/sdk` exposes `createUniLive(options)` — the primary application integration entry.

## Options

```javascript
createUniLive({
  projectId,           // required
  credentialPublicId,  // for authorize()
  controlPlane,        // optional injected store
  provider,            // UniLivesRTCProvider instance
  roomType,            // default RTC room type
})
```

## Returned surface

| Namespace | Status |
|---|---|
| `auth` | Stub — throws `AUTH_ADAPTER_REQUIRED` until wired |
| `database` | Stub — throws `DATABASE_ADAPTER_REQUIRED` |
| `storage` | Stub — throws `STORAGE_ADAPTER_REQUIRED` |
| `realtime` | Stub — throws `REALTIME_ADAPTER_REQUIRED` |
| `functions` | Stub — throws `FUNCTIONS_ADAPTER_REQUIRED` |
| `rtc` | Active when `provider` passed; else throws `RTC_PROVIDER_REQUIRED` |
| `events` / `observe` | Trace + audit logs + usage metrics |
| `controlPlane` | Direct store access (advanced) |
| `registry` | Provider registry |
| `usageMeter` | RTC usage meter |
| `projectGraph` | App graph builder |
| `authorize(scope)` | Credential scope check |

## RTC usage pattern

```javascript
import { createUniLive } from '@unilives/sdk';
import { createFakeRTCProvider } from '@unilives/rtc-fake';

const app = createUniLive({
  projectId: 'proj_xxx',
  provider: createFakeRTCProvider({ identity: userId }),
  roomType: 'LIVE',
});

const room = await app.rtc.joinRoom({ roomId, token, url, canonicalUserId: userId, role: 'host' });
```

## Type definitions

`index.d.ts` ships alongside `index.mjs` for TypeScript consumers.

## Re-exports

Also exports `createControlPlaneStore`, `createProviderRegistry`, `createProjectGraph` for tooling.

## Reference app

Prefer `artifacts/instacollab/src/lib/unilive-rtc/` which re-exports rtc packages + `createReferenceRtcProvider()` helper.
