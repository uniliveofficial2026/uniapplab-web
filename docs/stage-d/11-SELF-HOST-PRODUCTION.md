# Production Self-Host Distribution

## Package

`@unilives/selfhost` — `lib/unilives-selfhost/`

## Reference stack (`compose/docker-compose.yml`)

Single-node compose with: Postgres, auth, realtime, storage, API, MCP, studio, LiveKit, observability.

Container images reference `ghcr.io/unilives/*` and `livekit/livekit-server` — **reference placeholders**; image publish/pull was not verified in Stage D.

## TLS

Package does **not** terminate TLS. Use Caddy or another reverse proxy in front of API, studio, and LiveKit.

## Library API

| Function | Purpose |
| --- | --- |
| `initSelfHost` | Config + placeholder env + compose + postgres fixture |
| `getSelfHostStatus` | Component health summary |
| `backupSelfHost` | Postgres dump + platform config export |
| `restoreSelfHost` | Restore from backup |
| `upgradePreflight` | Blockers/warnings before upgrade |
| `generateComposeTemplate` | Render compose with generation header |
| `destroySelfHostState` | Tear down local state (DR tests) |

## Secrets

Only `CHANGE_ME_*` placeholders written at init — no default production secrets.

## Example

`examples/self-host/index.mjs`

## Classification

**PRODUCTION_READY** distribution scaffolding. Live production cluster operation: operator responsibility, not auto-deployed in Stage D.
