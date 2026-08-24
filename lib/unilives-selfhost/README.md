# @unilives/selfhost

Production-like **self-host** helpers for UniLive: compose generation, config init, health status, backup/restore, and upgrade preflight.

## Components

Reference single-node stack includes:

- Postgres
- Auth
- Realtime
- Storage
- API
- MCP
- Studio
- LiveKit
- Observability

Compose template lives at `compose/docker-compose.yml`.

## TLS

This package does **not** implement TLS. Terminate HTTPS with **Caddy** or another reverse proxy in front of `api`, `studio`, and LiveKit. See [Caddy reverse proxy quick-start](https://caddyserver.com/docs/quick-starts/reverse-proxy).

## Library API

| Function | Purpose |
| --- | --- |
| `initSelfHost` | Create config, placeholder env, compose file, seeded postgres fixture |
| `getSelfHostStatus` | Human-readable or `--json` status |
| `backupSelfHost` | Export postgres dump + platform config |
| `restoreSelfHost` | Restore isolated instance state from backup |
| `upgradePreflight` | Blockers/warnings before upgrade |
| `generateComposeTemplate` | Render compose with generation header |

No default production secrets are written — only `CHANGE_ME_*` placeholders.

```js
import { initSelfHost, getSelfHostStatus, backupSelfHost, restoreSelfHost } from '@unilives/selfhost';

await initSelfHost({ dataDir: './.unilives-selfhost' });
console.log(await getSelfHostStatus({ dataDir: './.unilives-selfhost' }));
```

## Tests

```bash
pnpm --filter @unilives/selfhost test
```

Restore tests create data, backup, destroy state, restore, and verify records.
