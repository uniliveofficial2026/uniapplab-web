# Provider Architecture

Providers are pluggable adapters behind a stable UniLive capability kind.

## Registry

`createProviderRegistry()` in platform-core:

```javascript
registry.resolve('rtc')   // → { provider: 'livekit', adapterPackage: '@unilives/rtc-livekit', status: 'active' }
registry.list()           // all registered providers
registry.register(entry)  // add or override
```

## Capability kinds

`rtc | database | auth | storage | realtime | functions | deployment | git | notification | ai`

## Adapter packages

| Kind | Default | Package |
|---|---|---|
| rtc | livekit | `@unilives/rtc-livekit` |
| auth | supabase | `@unilives/auth` |
| database | supabase | `@unilives/database` |
| storage | cloudflare-r2 | `@unilives/storage` |
| realtime | supabase | `@unilives/realtime` |
| deployment | vercel | `@unilives/deploy` |
| git | github | `@unilives/git` |
| functions | vercel | foundation only |

## Connection model

`connectProvider({ projectId, environmentId, kind, provider, secretRef, config })`:

- Stores `secretRef` (e.g. `secret://cred_xxx`), not secret value
- Updates environment's `providers[kind]` pointer

## API

`GET /v1/providers` — public list (no secrets)

MCP `inspect_provider_health` — status + adapter package names

## RTC special case

Media provider implements `UniLivesRTCProvider`. Business orchestrators never import provider SDKs. See `docs/rtc-platform/15-PROVIDER-INDEPENDENCE.md`.

## Fake adapters

RTC fake provider is for tests/MCP — not registered as production `active` media.

## Legacy coupling

Reference app and api-server still contain direct Firebase/Supabase/LiveKit imports. Stage B adds boundaries; full migration tracked in `PROVIDER-COUPLING-MANIFEST.md`.
